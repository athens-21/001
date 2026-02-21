//+------------------------------------------------------------------+
//|                                            JournalConnector.mq5  |
//|                         Trading Journal - MT5 Auto Sync          |
//|                              http://127.0.0.1:3002               |
//+------------------------------------------------------------------+
#property copyright "Trading Journal POC"
#property link      "http://127.0.0.1:3002"
#property version   "1.00"
#property description "Automatically sends closed trades to Trading Journal Backend"

//--- Input Parameters
input string   InpServerURL = "http://127.0.0.1:3002/api/journal/trades";  // Backend API URL
input int      InpTimeoutMS = 5000;                                         // Request Timeout (ms)
input bool     InpShowAlerts = true;                                        // Show Alert on Send
input bool     InpDebugMode = true;                                         // Debug Mode (Print JSON)

//--- Global Variables
datetime lastProcessedTime = 0;
ulong    lastProcessedDeal = 0;
datetime lastBalanceUpdate = 0;
double   lastBalance = 0;
bool     isUpdatingBalance = false;  // Prevent concurrent balance updates

//+------------------------------------------------------------------+
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 JournalConnector EA Initialized");
   Print("📡 Server URL: ", InpServerURL);
   
   // Check if WebRequest is allowed
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("⚠️ Warning: Automated trading is disabled");
   }
   
   // Register account with backend
   RegisterAccount();
   
   // Sync historical trades on startup
   SyncHistoricalTrades();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("🛑 JournalConnector EA Removed");
}

//+------------------------------------------------------------------+
//| Expert tick function (not used, but required)                      |
//+------------------------------------------------------------------+
void OnTick()
{
   // Skip if already updating balance to prevent blocking
   if(isUpdatingBalance)
      return;
   
   // Update balance every 10 seconds if changed
   datetime currentTime = TimeCurrent();
   if(currentTime - lastBalanceUpdate >= 10)
   {
      double currentBalance = AccountInfoDouble(ACCOUNT_BALANCE);
      if(MathAbs(currentBalance - lastBalance) > 0.01) // Check if balance changed
      {
         isUpdatingBalance = true;
         UpdateAccountBalance(currentBalance);
         lastBalance = currentBalance;
         isUpdatingBalance = false;
      }
      lastBalanceUpdate = currentTime;
   }
}

//+------------------------------------------------------------------+
//| TradeTransaction function - Detects OPEN and CLOSE trades          |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   // Only process DEAL_ADD transactions (when a deal is added to history)
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;
   
   // Get the deal ticket
   ulong dealTicket = trans.deal;
   
   // Skip if already processed
   if(dealTicket == lastProcessedDeal)
      return;
   
   // Select the deal from history
   if(!HistoryDealSelect(dealTicket))
      return;
   
   // Get deal entry type
   ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   
   // Mark as processed
   lastProcessedDeal = dealTicket;
   
   // Process both OPEN (IN) and CLOSE (OUT) deals
   if(dealEntry == DEAL_ENTRY_IN)
   {
      // Position opened - send ORDER_OPEN event
      ProcessOpenDeal(dealTicket);
   }
   else if(dealEntry == DEAL_ENTRY_OUT || dealEntry == DEAL_ENTRY_INOUT)
   {
      // Position closed - send ORDER_CLOSE event
      ProcessClosedDeal(dealTicket);
   }
}

//+------------------------------------------------------------------+
//| Process an opened deal and send to backend                         |
//+------------------------------------------------------------------+
void ProcessOpenDeal(ulong dealTicket)
{
   // Get deal information
   string   symbol     = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   double   entryPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   double   volume     = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   datetime openTime   = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
   long     dealType   = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   long     positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   
   // Determine direction
   string direction = "";
   if(dealType == DEAL_TYPE_BUY)
      direction = "LONG";   // Opening a LONG position
   else if(dealType == DEAL_TYPE_SELL)
      direction = "SHORT";  // Opening a SHORT position
   else
      return; // Skip non-trade deals
   
   // Format datetime for JSON (ISO 8601)
   string tradeDate = TimeToISO8601(openTime);
   
   // Build JSON payload for ORDER_OPEN
   string json = BuildOpenJsonPayload(
      symbol,
      direction,
      entryPrice,
      tradeDate,
      GetSessionFromTime(openTime),
      volume,
      positionId,
      dealTicket
   );
   
   if(InpDebugMode)
   {
      Print("📤 OPEN JSON Payload: ", json);
   }
   
   // Send to backend
   bool success = SendToBackend(json);
   
   if(success)
   {
      string msg = StringFormat("🟢 OPEN synced: %s %s %.2f @ %.5f", 
                                symbol, direction, volume, entryPrice);
      Print(msg);
      if(InpShowAlerts)
         Alert(msg);
   }
   else
   {
      int error = GetLastError();
      string msg = StringFormat("❌ Failed to sync OPEN: %s %s (Error: %d)", symbol, direction, error);
      Print(msg);
      if(error == 4014)
         Print("💡 Add http://127.0.0.1:3002 to WebRequest allowed URLs");
      if(InpShowAlerts)
         Alert(msg);
   }
}

//+------------------------------------------------------------------+
//| Process a closed deal and send to backend                          |
//+------------------------------------------------------------------+
void ProcessClosedDeal(ulong dealTicket)
{
   // Get deal information
   string   symbol     = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   double   profit     = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
   double   commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   double   swap       = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
   double   exitPrice  = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   double   volume     = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   datetime closeTime  = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
   long     dealType   = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   long     positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   
   // Calculate total P/L (including commission and swap)
   double totalPL = profit + commission + swap;
   
   // Determine direction (opposite of exit deal type)
   string direction = "";
   if(dealType == DEAL_TYPE_BUY)
      direction = "SHORT";  // Closing a SHORT position
   else if(dealType == DEAL_TYPE_SELL)
      direction = "LONG";   // Closing a LONG position
   else
      return; // Skip non-trade deals (balance, credit, etc.)
   
   // Get entry price from the opening deal
   double entryPrice = GetEntryPriceFromPosition(positionId);
   
   // Format datetime for JSON (ISO 8601)
   string tradeDate = TimeToISO8601(closeTime);
   
   // Build JSON payload for ORDER_CLOSE
   string json = BuildCloseJsonPayload(
      symbol,
      direction,
      entryPrice,
      exitPrice,
      totalPL,
      tradeDate,
      GetSessionFromTime(closeTime),
      volume,
      positionId,
      dealTicket
   );
   
   if(InpDebugMode)
   {
      Print("📤 JSON Payload: ", json);
   }
   
   // Send to backend
   bool success = SendToBackend(json);
   
   if(success)
   {
      string msg = StringFormat("🔴 CLOSE synced: %s %s %.2f (P/L: %.2f)", 
                                symbol, direction, volume, totalPL);
      Print(msg);
      if(InpShowAlerts)
         Alert(msg);
   }
   else
   {
      int error = GetLastError();
      string msg = StringFormat("❌ Failed to sync CLOSE: %s %s (Error: %d)", symbol, direction, error);
      Print(msg);
      if(error == 4014)
         Print("💡 Add http://127.0.0.1:3002 to WebRequest allowed URLs");
      if(InpShowAlerts)
         Alert(msg);
   }
}

//+------------------------------------------------------------------+
//| Get entry price from position history                              |
//+------------------------------------------------------------------+
double GetEntryPriceFromPosition(long positionId)
{
   // Select deals for this position
   if(!HistorySelectByPosition(positionId))
      return 0;
   
   int totalDeals = HistoryDealsTotal();
   
   for(int i = 0; i < totalDeals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      
      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket, DEAL_ENTRY);
      
      // Find the entry deal
      if(entry == DEAL_ENTRY_IN)
      {
         return HistoryDealGetDouble(ticket, DEAL_PRICE);
      }
   }
   
   return 0;
}

//+------------------------------------------------------------------+
//| Build JSON payload for ORDER_OPEN event                            |
//+------------------------------------------------------------------+
string BuildOpenJsonPayload(string symbol, string direction, double entry,
                           string openTime, string session, double volume,
                           long positionId, ulong dealTicket)
{
   // Escape special characters in strings
   symbol = EscapeJsonString(symbol);
   direction = EscapeJsonString(direction);
   session = EscapeJsonString(session);
   
   // Get account number
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   
   // Format pair name (e.g., EURUSD -> EUR/USD)
   string pair = FormatPairName(symbol);
   
   // Build JSON string for OPEN event
   string json = "{";
   json += "\"event\":\"ORDER_OPEN\",";
   json += "\"accountNumber\":" + IntegerToString(accountNumber) + ",";
   json += "\"mt5Ticket\":" + IntegerToString((long)dealTicket) + ",";
   json += "\"pair\":\"" + pair + "\",";
   json += "\"direction\":\"" + direction + "\",";
   json += "\"entryPrice\":" + DoubleToString(entry, 5) + ",";
   json += "\"openTime\":\"" + openTime + "\",";
   json += "\"tradeDate\":\"" + openTime + "\",";
   json += "\"session\":\"" + session + "\",";
   json += "\"volume\":" + DoubleToString(volume, 2) + ",";
   json += "\"positionId\":" + IntegerToString(positionId) + ",";
   json += "\"source\":\"MT5\"";
   json += "}";
   
   return json;
}

//+------------------------------------------------------------------+
//| Build JSON payload for ORDER_CLOSE event                           |
//+------------------------------------------------------------------+
string BuildCloseJsonPayload(string symbol, string direction, double entry,
                            double exit, double pl, string closeTime,
                            string session, double volume, long positionId, ulong dealTicket)
{
   // Escape special characters in strings
   symbol = EscapeJsonString(symbol);
   direction = EscapeJsonString(direction);
   session = EscapeJsonString(session);
   
   // Get account number
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   
   // Format pair name (e.g., EURUSD -> EUR/USD)
   string pair = FormatPairName(symbol);
   
   // Build JSON string for CLOSE event
   string json = "{";
   json += "\"event\":\"ORDER_CLOSE\",";
   json += "\"accountNumber\":" + IntegerToString(accountNumber) + ",";
   json += "\"mt5Ticket\":" + IntegerToString((long)dealTicket) + ",";
   json += "\"pair\":\"" + pair + "\",";
   json += "\"direction\":\"" + direction + "\",";
   json += "\"entryPrice\":" + DoubleToString(entry, 5) + ",";
   json += "\"exitPrice\":" + DoubleToString(exit, 5) + ",";
   json += "\"profitLoss\":" + DoubleToString(pl, 2) + ",";
   json += "\"closeTime\":\"" + closeTime + "\",";
   json += "\"tradeDate\":\"" + closeTime + "\",";
   json += "\"session\":\"" + session + "\",";
   json += "\"volume\":" + DoubleToString(volume, 2) + ",";
   json += "\"positionId\":" + IntegerToString(positionId) + ",";
   json += "\"source\":\"MT5\"";
   json += "}";
   
   return json;
}

//+------------------------------------------------------------------+
//| Escape special characters for JSON string                          |
//+------------------------------------------------------------------+
string EscapeJsonString(string str)
{
   StringReplace(str, "\\", "\\\\");
   StringReplace(str, "\"", "\\\"");
   StringReplace(str, "\n", "\\n");
   StringReplace(str, "\r", "\\r");
   StringReplace(str, "\t", "\\t");
   return str;
}

//+------------------------------------------------------------------+
//| Format pair name (EURUSD -> EUR/USD)                               |
//+------------------------------------------------------------------+
string FormatPairName(string symbol)
{
   // Remove suffix if exists (e.g., EURUSDm -> EURUSD)
   int len = StringLen(symbol);
   if(len > 6)
   {
      // Check common suffixes
      string suffix = StringSubstr(symbol, len - 1, 1);
      if(suffix == "m" || suffix == "." || suffix == "#")
         symbol = StringSubstr(symbol, 0, len - 1);
   }
   
   len = StringLen(symbol);
   
   // Standard forex pair (6 chars) -> add slash
   if(len == 6)
   {
      return StringSubstr(symbol, 0, 3) + "/" + StringSubstr(symbol, 3, 3);
   }
   
   // Crypto/Index/Commodity - return as is
   return symbol;
}

//+------------------------------------------------------------------+
//| Convert datetime to ISO 8601 format                                |
//+------------------------------------------------------------------+
string TimeToISO8601(datetime time)
{
   MqlDateTime dt;
   TimeToStruct(time, dt);
   
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02d.000Z",
                       dt.year, dt.mon, dt.day,
                       dt.hour, dt.min, dt.sec);
}

//+------------------------------------------------------------------+
//| Determine trading session from time                                |
//+------------------------------------------------------------------+
string GetSessionFromTime(datetime time)
{
   MqlDateTime dt;
   TimeToStruct(time, dt);
   
   int hour = dt.hour; // Server time (usually UTC or broker time)
   
   // Approximate session times (adjust based on your broker's server time)
   if(hour >= 0 && hour < 7)
      return "Asian";
   else if(hour >= 7 && hour < 12)
      return "London";
   else if(hour >= 12 && hour < 21)
      return "New York";
   else
      return "Sydney";
}

//+------------------------------------------------------------------+
//| Send JSON data to backend via HTTP POST                            |
//+------------------------------------------------------------------+
bool SendToBackend(string json)
{
   char   postData[];
   char   result[];
   string headers = "Content-Type: application/json\r\nX-MT5-EA: JournalConnector";
   string resultHeaders;
   
   // Convert string to char array
   StringToCharArray(json, postData, 0, StringLen(json), CP_UTF8);
   
   // Resize to remove null terminator if added
   ArrayResize(postData, StringLen(json));
   
   // Make HTTP POST request
   int responseCode = WebRequest(
      "POST",                    // Method
      InpServerURL,              // URL
      headers,                   // Headers
      InpTimeoutMS,              // Timeout
      postData,                  // POST data
      result,                    // Response data
      resultHeaders              // Response headers
   );
   
   if(responseCode == -1)
   {
      int error = GetLastError();
      Print("❌ WebRequest failed. Error Code: ", error);
      
      // Detailed error messages
      if(error == 4014)
         Print("💡 Error 4014: URL not allowed. Go to Tools -> Options -> Expert Advisors -> Allow WebRequest");
      else if(error == 5200)
         Print("💡 Error 5200: Invalid URL format");
      else if(error == 4060)
         Print("💡 Error 4060: Function not confirmed by user");
      
      Print("   URL to add: http://127.0.0.1:3002");
      return false;
   }
   
   // Always print response for debugging
   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   Print("📥 Response Code: ", responseCode);
   Print("📥 Response Body: ", response);
   
   if(InpDebugMode)
   {
      Print("📥 Response Headers: ", resultHeaders);
   }
   
   // Success if response code is 200 or 201
   bool isSuccess = (responseCode == 200 || responseCode == 201);
   
   if(!isSuccess)
   {
      Print("⚠️ Unexpected response code: ", responseCode, " (Expected 200 or 201)");
   }
   
   return isSuccess;
}

//+------------------------------------------------------------------+
//| Manual sync - Process all trades from today (for testing)          |
//+------------------------------------------------------------------+
void SyncTodaysTrades()
{
   datetime startOfDay = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   
   if(!HistorySelect(startOfDay, TimeCurrent()))
   {
      Print("❌ Failed to select history");
      return;
   }
   
   int totalDeals = HistoryDealsTotal();
   int syncedCount = 0;
   
   for(int i = 0; i < totalDeals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      
      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket, DEAL_ENTRY);
      
      if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
      {
         ProcessClosedDeal(ticket);
         syncedCount++;
         Sleep(100); // Small delay between requests
      }
   }
   
   Print("📊 Manual sync complete: ", syncedCount, " trades synced");
}

//+------------------------------------------------------------------+
//| Register account with backend on EA initialization                |
//+------------------------------------------------------------------+
void RegisterAccount()
{
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   string accountName = AccountInfoString(ACCOUNT_NAME);
   string accountServer = AccountInfoString(ACCOUNT_SERVER);
   double accountBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   string accountCurrency = AccountInfoString(ACCOUNT_CURRENCY);
   
   // Determine account type
   string accountType = "Live";
   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO)
      accountType = "Demo";
   else if(AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_CONTEST)
      accountType = "Contest";
   
   // Extract broker name from server (e.g., "Exness-MT5Trial7" -> "Exness")
   string broker = accountServer;
   int dashPos = StringFind(broker, "-");
   if(dashPos > 0)
      broker = StringSubstr(broker, 0, dashPos);
   
   // Build JSON payload
   string json = "{";
   json += "\"accountNumber\":" + IntegerToString(accountNumber) + ",";
   json += "\"accountName\":\"" + EscapeJsonString(accountName) + "\",";
   json += "\"broker\":\"" + EscapeJsonString(broker) + "\",";
   json += "\"accountType\":\"" + accountType + "\",";
   json += "\"currency\":\"" + accountCurrency + "\",";
   json += "\"initialBalance\":" + DoubleToString(accountBalance, 2) + ",";
   json += "\"currentBalance\":" + DoubleToString(accountBalance, 2);
   json += "}";
   
   Print("📝 Registering account: ", accountNumber);
   if(InpDebugMode)
   {
      Print("📤 Account JSON: ", json);
   }
   
   // Send to backend
   char postData[];
   char result[];
   string headers = "Content-Type: application/json\r\nX-MT5-EA: JournalConnector";
   string resultHeaders;
   
   StringToCharArray(json, postData, 0, StringLen(json), CP_UTF8);
   ArrayResize(postData, StringLen(json));
   
   string registerURL = "http://127.0.0.1:3002/api/accounts/register";
   
   int responseCode = WebRequest(
      "POST",
      registerURL,
      headers,
      InpTimeoutMS,
      postData,
      result,
      resultHeaders
   );
   
   if(responseCode == 201 || responseCode == 200)
   {
      string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("✅ Account registered successfully");
      if(InpDebugMode)
      {
         Print("📥 Response: ", response);
      }
   }
   else if(responseCode == -1)
   {
      int error = GetLastError();
      Print("❌ Account registration failed. Error: ", error);
   }
   else
   {
      string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("⚠️ Account registration response code: ", responseCode);
      Print("📥 Response: ", response);
   }
}

//+------------------------------------------------------------------+
//| Update account balance in backend                                  |
//+------------------------------------------------------------------+
void UpdateAccountBalance(double balance)
{
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   
   // Build JSON payload
   string json = "{";
   json += "\"accountNumber\":" + IntegerToString(accountNumber) + ",";
   json += "\"currentBalance\":" + DoubleToString(balance, 2);
   json += "}";
   
   if(InpDebugMode)
   {
      Print("💰 Updating balance: $", DoubleToString(balance, 2));
   }
   
   // Send to backend
   char postData[];
   char result[];
   string headers = "Content-Type: application/json\r\nX-MT5-EA: JournalConnector";
   string resultHeaders;
   
   StringToCharArray(json, postData, 0, StringLen(json), CP_UTF8);
   ArrayResize(postData, StringLen(json));
   
   string updateURL = "http://127.0.0.1:3002/api/accounts/update-balance";
   
   int responseCode = WebRequest(
      "POST",
      updateURL,
      headers,
      2000,  // Reduced timeout to 2 seconds
      postData,
      result,
      resultHeaders
   );
   
   if(responseCode == 200)
   {
      if(InpDebugMode)
      {
         Print("✅ Balance updated successfully");
      }
   }
   else if(responseCode == -1)
   {
      // Don't print error - just skip silently to avoid spam
      ResetLastError();
   }
}

//+------------------------------------------------------------------+
//| Sync historical trades on startup                                  |
//+------------------------------------------------------------------+
void SyncHistoricalTrades()
{
   Print("🔄 Starting historical trades sync...");
   
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   datetime now = TimeCurrent();
   datetime from = now - (90 * 24 * 60 * 60); // Last 90 days
   
   // Request history
   if(!HistorySelect(from, now))
   {
      Print("❌ Failed to select history");
      return;
   }
   
   int totalDeals = HistoryDealsTotal();
   Print("📊 Found ", totalDeals, " deals in history");
   
   // Group deals by position
   string tradesJson = "[";
   int tradesCount = 0;
   
   // Track processed positions
   ulong processedPositions[];
   ArrayResize(processedPositions, 0);
   
   for(int i = 0; i < totalDeals; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      
      // Get position ID
      ulong positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(positionId == 0) continue;
      
      // Skip if already processed
      bool alreadyProcessed = false;
      for(int j = 0; j < ArraySize(processedPositions); j++)
      {
         if(processedPositions[j] == positionId)
         {
            alreadyProcessed = true;
            break;
         }
      }
      if(alreadyProcessed) continue;
      
      // Get deal entry type
      ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      
      // Only process IN (entry) deals
      if(dealEntry != DEAL_ENTRY_IN) continue;
      
      // Get deal info
      string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      double volume = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
      double entryPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      datetime entryTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      
      // Determine direction
      string direction = (dealType == DEAL_TYPE_BUY) ? "LONG" : "SHORT";
      
      // Find corresponding exit deal
      double exitPrice = 0;
      datetime exitTime = 0;
      double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
      double swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
      double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
      
      // Look for exit deal
      for(int j = i + 1; j < totalDeals; j++)
      {
         ulong exitDealTicket = HistoryDealGetTicket(j);
         if(exitDealTicket == 0) continue;
         
         ulong exitPosId = HistoryDealGetInteger(exitDealTicket, DEAL_POSITION_ID);
         if(exitPosId != positionId) continue;
         
         ENUM_DEAL_ENTRY exitEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(exitDealTicket, DEAL_ENTRY);
         if(exitEntry == DEAL_ENTRY_OUT || exitEntry == DEAL_ENTRY_OUT_BY)
         {
            exitPrice = HistoryDealGetDouble(exitDealTicket, DEAL_PRICE);
            exitTime = (datetime)HistoryDealGetInteger(exitDealTicket, DEAL_TIME);
            commission += HistoryDealGetDouble(exitDealTicket, DEAL_COMMISSION);
            swap += HistoryDealGetDouble(exitDealTicket, DEAL_SWAP);
            profit += HistoryDealGetDouble(exitDealTicket, DEAL_PROFIT);
            break;
         }
      }
      
      // Calculate session
      string session = GetSessionFromTime(entryTime);
      
      // Add to JSON array
      if(tradesCount > 0) tradesJson += ",";
      
      tradesJson += "{";
      tradesJson += "\"ticket\":" + IntegerToString(positionId) + ",";
      tradesJson += "\"pair\":\"" + symbol + "\",";
      tradesJson += "\"direction\":\"" + direction + "\",";
      tradesJson += "\"volume\":" + DoubleToString(volume, 2) + ",";
      tradesJson += "\"entryPrice\":" + DoubleToString(entryPrice, 5) + ",";
      
      if(exitPrice > 0)
      {
         tradesJson += "\"exitPrice\":" + DoubleToString(exitPrice, 5) + ",";
         tradesJson += "\"closeTime\":\"" + TimeToString(exitTime, TIME_DATE|TIME_MINUTES) + "\",";
      }
      
      tradesJson += "\"openTime\":\"" + TimeToString(entryTime, TIME_DATE|TIME_MINUTES) + "\",";
      tradesJson += "\"tradeDate\":\"" + TimeToString(entryTime, TIME_DATE) + "\",";
      tradesJson += "\"session\":\"" + session + "\",";
      tradesJson += "\"commission\":" + DoubleToString(commission, 2) + ",";
      tradesJson += "\"swap\":" + DoubleToString(swap, 2) + ",";
      tradesJson += "\"netProfit\":" + DoubleToString(profit, 2);
      tradesJson += "}";
      
      tradesCount++;
      
      // Mark position as processed
      ArrayResize(processedPositions, ArraySize(processedPositions) + 1);
      processedPositions[ArraySize(processedPositions) - 1] = positionId;
      
      // Send in batches of 50
      if(tradesCount >= 50)
      {
         tradesJson += "]";
         SendSyncBatch(accountNumber, tradesJson);
         tradesJson = "[";
         tradesCount = 0;
      }
   }
   
   // Send remaining trades
   if(tradesCount > 0)
   {
      tradesJson += "]";
      SendSyncBatch(accountNumber, tradesJson);
   }
   
   Print("✅ Historical sync completed");
}

//+------------------------------------------------------------------+
//| Send sync batch to backend                                         |
//+------------------------------------------------------------------+
void SendSyncBatch(long accountNumber, string tradesJson)
{
   string json = "{";
   json += "\"accountNumber\":" + IntegerToString(accountNumber) + ",";
   json += "\"trades\":" + tradesJson;
   json += "}";
   
   if(InpDebugMode)
   {
      Print("📤 Syncing batch...");
   }
   
   char postData[];
   char result[];
   string headers = "Content-Type: application/json\r\nX-MT5-EA: JournalConnector";
   string resultHeaders;
   
   StringToCharArray(json, postData, 0, StringLen(json), CP_UTF8);
   ArrayResize(postData, StringLen(json));
   
   string syncURL = "http://127.0.0.1:3002/api/journal/trades/sync";
   
   int responseCode = WebRequest(
      "POST",
      syncURL,
      headers,
      InpTimeoutMS,
      postData,
      result,
      resultHeaders
   );
   
   if(responseCode == 200)
   {
      string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("✅ Batch synced: ", response);
   }
   else
   {
      Print("❌ Sync failed with code: ", responseCode);
   }
}
//+------------------------------------------------------------------+
