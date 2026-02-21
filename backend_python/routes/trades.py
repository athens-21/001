"""
Trading Journal - Trades Routes
แปลงจาก: backend/src/routes/trades.js
"""
from flask import Blueprint, request, session, jsonify
from functools import wraps
import sqlite3
import os
from datetime import datetime

trades_bp = Blueprint('journal_trades', __name__, url_prefix='/api/trading-journal/trades')

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), '../../../data/accounts.db')

def get_db():
    """Get database connection with Row factory"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def login_required(f):
    """Decorator to require login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@trades_bp.route('', methods=['GET'])
@login_required
def get_trades():
    """
    GET /api/trading-journal/trades
    Get all trades for the authenticated user with filters
    """
    user_id = session.get('user_id')
    
    try:
        # Get query parameters
        status = request.args.get('status')
        pair = request.args.get('pair')
        account_id = request.args.get('account_id')
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Build query
        query = 'SELECT * FROM journal_trades WHERE user_id = ?'
        params = [user_id]
        
        if account_id:
            query += ' AND account_id = ?'
            params.append(account_id)
        
        if status:
            query += ' AND status = ?'
            params.append(status)
        
        if pair:
            query += ' AND pair = ?'
            params.append(pair)
        
        if start_date:
            query += ' AND trade_date >= ?'
            params.append(start_date)
        
        if end_date:
            query += ' AND trade_date <= ?'
            params.append(end_date)
        
        query += ' ORDER BY open_time DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        trades = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify(trades)
        
    except Exception as e:
        print(f'❌ Get trades error: {e}')
        return jsonify({'error': 'Failed to fetch trades'}), 500

@trades_bp.route('/<int:trade_id>', methods=['GET'])
@login_required
def get_trade(trade_id):
    """
    GET /api/trading-journal/trades/<trade_id>
    Get specific trade
    """
    user_id = session.get('user_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM journal_trades 
            WHERE id = ? AND user_id = ?
        ''', (trade_id, user_id))
        
        trade = cursor.fetchone()
        conn.close()
        
        if not trade:
            return jsonify({'error': 'Trade not found'}), 404
        
        return jsonify(dict(trade))
        
    except Exception as e:
        print(f'❌ Get trade error: {e}')
        return jsonify({'error': 'Failed to fetch trade'}), 500

@trades_bp.route('', methods=['POST'])
def create_trade():
    """
    POST /api/trading-journal/trades
    Create new trade (manual or via MT5 EA webhook)
    Supports both JWT and accountNumber authentication
    """
    try:
        data = request.json
        account_number = data.get('accountNumber')
        
        # Authenticate via session or accountNumber
        user_id = None
        account_id = None
        
        if 'user_id' in session:
            # Authenticated via session
            user_id = session['user_id']
            account_id = data.get('account_id')  # Must be provided
            
            if not account_id:
                return jsonify({'error': 'account_id required'}), 400
                
        elif account_number:
            # Authenticate via accountNumber (EA webhook)
            conn = get_db()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, user_id FROM mt5_accounts 
                WHERE account_number = ?
            ''', (account_number,))
            
            account = cursor.fetchone()
            conn.close()
            
            if not account:
                return jsonify({'error': 'MT5 account not found'}), 404
            
            user_id = account['user_id']
            account_id = account['id']
        else:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Extract trade data
        event = data.get('event')
        mt5_ticket = data.get('mt5Ticket') or data.get('ticket')
        position_id = data.get('positionId') or data.get('mt5_position_id')
        pair = data.get('pair')
        direction = data.get('direction')
        volume = data.get('volume')
        entry_price = data.get('entryPrice') or data.get('entry_price')
        exit_price = data.get('exitPrice') or data.get('exit_price')
        stop_loss = data.get('stopLoss') or data.get('stop_loss')
        take_profit = data.get('takeProfit') or data.get('take_profit')
        profit_loss = data.get('profitLoss') or data.get('profit_loss')
        commission = data.get('commission', 0)
        swap = data.get('swap', 0)
        open_time = data.get('openTime') or data.get('open_time')
        close_time = data.get('closeTime') or data.get('close_time')
        trade_date = data.get('tradeDate') or data.get('trade_date')
        session_name = data.get('session')
        notes = data.get('notes', '')
        tags = data.get('tags', '')
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Handle MT5 EA events
        if event == 'ORDER_OPEN':
            # Check if trade already exists
            if mt5_ticket:
                cursor.execute('''
                    SELECT id FROM journal_trades 
                    WHERE mt5_ticket = ? AND account_id = ?
                ''', (mt5_ticket, account_id))
                
                existing_trade = cursor.fetchone()
                
                if existing_trade:
                    # Update existing trade
                    cursor.execute('''
                        UPDATE journal_trades SET
                            pair = ?, direction = ?, volume = ?, entry_price = ?,
                            stop_loss = ?, take_profit = ?, open_time = ?, 
                            trade_date = ?, session = ?, status = 'OPEN', source = 'MT5',
                            updated_at = ?
                        WHERE id = ?
                    ''', (pair, direction, volume, entry_price, stop_loss, take_profit,
                          open_time, trade_date, session_name, datetime.now().isoformat(),
                          existing_trade['id']))
                    
                    conn.commit()
                    
                    cursor.execute('SELECT * FROM journal_trades WHERE id = ?', (existing_trade['id'],))
                    result = dict(cursor.fetchone())
                    conn.close()
                    
                    return jsonify(result), 200
            
            # Create new OPEN trade
            cursor.execute('''
                INSERT INTO journal_trades (
                    account_id, user_id, mt5_ticket, mt5_position_id, pair, direction, volume,
                    entry_price, stop_loss, take_profit, open_time, trade_date, session,
                    status, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 'MT5')
            ''', (account_id, user_id, mt5_ticket, position_id, pair, direction, volume,
                  entry_price, stop_loss, take_profit, open_time, trade_date, session_name))
            
            conn.commit()
            trade_id = cursor.lastrowid
            
            cursor.execute('SELECT * FROM journal_trades WHERE id = ?', (trade_id,))
            result = dict(cursor.fetchone())
            conn.close()
            
            return jsonify(result), 201
            
        elif event == 'ORDER_CLOSE':
            # Find and update OPEN trade to CLOSED
            if position_id:
                cursor.execute('''
                    SELECT id FROM journal_trades 
                    WHERE mt5_position_id = ? AND account_id = ? AND status = 'OPEN'
                ''', (position_id, account_id))
                
                existing_trade = cursor.fetchone()
                
                if existing_trade:
                    # Update to CLOSED
                    cursor.execute('''
                        UPDATE journal_trades SET
                            exit_price = ?, close_time = ?, profit_loss = ?,
                            commission = ?, swap = ?, status = 'CLOSED',
                            updated_at = ?
                        WHERE id = ?
                    ''', (exit_price, close_time, profit_loss, commission or 0, 
                          swap or 0, datetime.now().isoformat(), existing_trade['id']))
                    
                    conn.commit()
                    
                    cursor.execute('SELECT * FROM journal_trades WHERE id = ?', (existing_trade['id'],))
                    result = dict(cursor.fetchone())
                    conn.close()
                    
                    return jsonify(result), 200
                else:
                    # No matching OPEN trade found
                    conn.close()
                    print(f'⚠️ Skipping ORDER_CLOSE for position {position_id} - no matching OPEN trade')
                    return jsonify({
                        'message': 'CLOSE event skipped - no matching OPEN trade',
                        'positionId': position_id,
                        'note': 'Will be handled by historical sync'
                    }), 200
        
        # Manual trade creation
        status = 'CLOSED' if exit_price else 'OPEN'
        
        cursor.execute('''
            INSERT INTO journal_trades (
                account_id, user_id, pair, direction, volume, entry_price, exit_price,
                stop_loss, take_profit, open_time, close_time, trade_date, session,
                profit_loss, commission, swap, notes, tags, status, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL')
        ''', (account_id, user_id, pair, direction, volume, entry_price, exit_price,
              stop_loss, take_profit, open_time, close_time, trade_date, session_name,
              profit_loss, commission, swap, notes, tags, status))
        
        conn.commit()
        trade_id = cursor.lastrowid
        
        cursor.execute('SELECT * FROM journal_trades WHERE id = ?', (trade_id,))
        result = dict(cursor.fetchone())
        conn.close()
        
        return jsonify(result), 201
        
    except Exception as e:
        print(f'❌ Create trade error: {e}')
        return jsonify({'error': 'Failed to create trade'}), 500

@trades_bp.route('/<int:trade_id>', methods=['PUT'])
@login_required
def update_trade(trade_id):
    """
    PUT /api/trading-journal/trades/<trade_id>
    Update existing trade
    """
    user_id = session.get('user_id')
    data = request.json
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Build dynamic update query
        updates = []
        params = []
        
        fields = ['pair', 'direction', 'volume', 'entry_price', 'exit_price',
                  'stop_loss', 'take_profit', 'open_time', 'close_time', 'trade_date',
                  'session', 'profit_loss', 'commission', 'swap', 'notes', 'tags', 'status']
        
        for field in fields:
            if field in data:
                updates.append(f'{field} = ?')
                params.append(data[field])
        
        if not updates:
            conn.close()
            return jsonify({'error': 'No fields to update'}), 400
        
        # Add updated_at
        updates.append('updated_at = ?')
        params.append(datetime.now().isoformat())
        
        params.extend([trade_id, user_id])
        
        cursor.execute(f'''
            UPDATE journal_trades 
            SET {', '.join(updates)}
            WHERE id = ? AND user_id = ?
        ''', params)
        
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Trade not found'}), 404
        
        # Fetch updated trade
        cursor.execute('SELECT * FROM journal_trades WHERE id = ?', (trade_id,))
        result = dict(cursor.fetchone())
        conn.close()
        
        return jsonify(result)
        
    except Exception as e:
        print(f'❌ Update trade error: {e}')
        return jsonify({'error': 'Failed to update trade'}), 500

@trades_bp.route('/<int:trade_id>', methods=['DELETE'])
@login_required
def delete_trade(trade_id):
    """
    DELETE /api/trading-journal/trades/<trade_id>
    Delete trade
    """
    user_id = session.get('user_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM journal_trades 
            WHERE id = ? AND user_id = ?
        ''', (trade_id, user_id))
        
        conn.commit()
        deleted_count = cursor.rowcount
        conn.close()
        
        if deleted_count == 0:
            return jsonify({'error': 'Trade not found'}), 404
        
        return jsonify({'message': 'Trade deleted successfully'})
        
    except Exception as e:
        print(f'❌ Delete trade error: {e}')
        return jsonify({'error': 'Failed to delete trade'}), 500

@trades_bp.route('/bulk-delete', methods=['POST'])
@login_required
def bulk_delete_trades():
    """
    POST /api/trading-journal/trades/bulk-delete
    Bulk delete trades
    """
    user_id = session.get('user_id')
    data = request.json
    ids = data.get('ids', [])
    
    if not ids or not isinstance(ids, list) or len(ids) == 0:
        return jsonify({'error': 'Trade IDs required'}), 400
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Create placeholders for IN clause
        placeholders = ','.join('?' * len(ids))
        
        cursor.execute(f'''
            DELETE FROM journal_trades 
            WHERE user_id = ? AND id IN ({placeholders})
        ''', [user_id] + ids)
        
        conn.commit()
        deleted_count = cursor.rowcount
        conn.close()
        
        return jsonify({
            'message': 'Trades deleted successfully',
            'deletedCount': deleted_count
        })
        
    except Exception as e:
        print(f'❌ Bulk delete error: {e}')
        return jsonify({'error': 'Failed to delete trades'}), 500

@trades_bp.route('/sync', methods=['POST'])
def sync_trades():
    """
    POST /api/trading-journal/trades/sync
    Sync multiple trades from MT5 (for initial sync or recovery)
    Supports accountNumber authentication
    """
    try:
        data = request.json
        account_number = data.get('accountNumber')
        trades = data.get('trades', [])
        
        if not account_number:
            return jsonify({'error': 'Account number required'}), 400
        
        if not trades or not isinstance(trades, list) or len(trades) == 0:
            return jsonify({'error': 'Trades array required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Find account by accountNumber
        cursor.execute('''
            SELECT id, user_id FROM mt5_accounts 
            WHERE account_number = ?
        ''', (account_number,))
        
        account = cursor.fetchone()
        
        if not account:
            conn.close()
            return jsonify({'error': 'Account not found'}), 404
        
        account_id = account['id']
        user_id = account['user_id']
        
        synced_count = 0
        error_count = 0
        
        for trade in trades:
            try:
                ticket = trade.get('ticket')
                
                if not ticket:
                    error_count += 1
                    continue
                
                # Check if trade already exists
                cursor.execute('''
                    SELECT id FROM journal_trades 
                    WHERE mt5_ticket = ? AND account_id = ?
                ''', (ticket, account_id))
                
                existing = cursor.fetchone()
                
                exit_price = trade.get('exitPrice')
                status = 'CLOSED' if exit_price else 'OPEN'
                
                if existing:
                    # Update existing trade
                    cursor.execute('''
                        UPDATE journal_trades SET
                            exit_price = COALESCE(?, exit_price),
                            close_time = COALESCE(?, close_time),
                            profit_loss = COALESCE(?, profit_loss),
                            commission = COALESCE(?, commission),
                            swap = COALESCE(?, swap),
                            status = ?,
                            updated_at = ?
                        WHERE id = ?
                    ''', (exit_price, trade.get('closeTime'), trade.get('profitLoss'),
                          trade.get('commission'), trade.get('swap'), status,
                          datetime.now().isoformat(), existing['id']))
                else:
                    # Insert new trade
                    cursor.execute('''
                        INSERT INTO journal_trades (
                            account_id, user_id, mt5_ticket, mt5_position_id, pair, direction, volume,
                            entry_price, exit_price, stop_loss, take_profit,
                            open_time, close_time, trade_date, session,
                            profit_loss, commission, swap,
                            notes, tags, status, source
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MT5')
                    ''', (account_id, user_id, ticket, ticket, trade.get('pair'),
                          trade.get('direction'), trade.get('volume'), trade.get('entryPrice'),
                          exit_price, trade.get('stopLoss'), trade.get('takeProfit'),
                          trade.get('openTime'), trade.get('closeTime'), trade.get('tradeDate'),
                          trade.get('session'), trade.get('profitLoss'), trade.get('commission'),
                          trade.get('swap'), trade.get('notes', ''), trade.get('tags', ''), status))
                
                synced_count += 1
                
            except Exception as trade_error:
                print(f'❌ Error syncing trade: {trade_error}')
                error_count += 1
        
        conn.commit()
        conn.close()
        
        print(f'✅ Sync completed for account {account_number}: {synced_count} synced, {error_count} errors')
        
        return jsonify({
            'message': 'Sync completed',
            'syncedCount': synced_count,
            'errorCount': error_count,
            'totalProcessed': len(trades)
        })
        
    except Exception as e:
        print(f'❌ Sync error: {e}')
        return jsonify({'error': 'Failed to sync trades'}), 500

@trades_bp.route('/clear-mt5', methods=['DELETE'])
def clear_mt5_trades():
    """
    DELETE /api/trading-journal/trades/clear-mt5
    Delete all MT5 trades (for testing/reset)
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM journal_trades WHERE source = 'MT5'")
        
        conn.commit()
        deleted_count = cursor.rowcount
        conn.close()
        
        print(f'🗑️ Deleted {deleted_count} MT5 trades')
        
        return jsonify({
            'message': 'MT5 trades cleared',
            'deletedCount': deleted_count
        })
        
    except Exception as e:
        print(f'❌ Clear error: {e}')
        return jsonify({'error': 'Failed to clear trades'}), 500
