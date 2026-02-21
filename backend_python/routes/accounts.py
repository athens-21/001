"""
Trading Journal - Accounts Routes
แปลงจาก: backend/src/routes/accounts.js
"""
from flask import Blueprint, request, session, jsonify
from functools import wraps
import sqlite3
import os

accounts_bp = Blueprint('journal_accounts', __name__, url_prefix='/api/trading-journal/accounts')

# Database path - adjust based on deployment
DB_PATH = os.path.join(os.path.dirname(__file__), '../../../data/accounts.db')

# Database helper
def get_db():
    """Get database connection with Row factory"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Auth decorator - ใช้ session จากระบบหลัก
def login_required(f):
    """Decorator to require login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@accounts_bp.route('', methods=['GET'])
@login_required
def get_accounts():
    """
    GET /api/trading-journal/accounts
    Get all MT5 accounts for the user
    """
    user_id = session.get('user_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, account_number, account_name, broker, account_type, currency, 
                   initial_balance, current_balance, is_active, created_at
            FROM mt5_accounts 
            WHERE user_id = ?
            ORDER BY created_at DESC
        ''', (user_id,))
        
        accounts = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify(accounts)
    except Exception as e:
        print(f'❌ Get accounts error: {e}')
        return jsonify({'error': 'Failed to fetch accounts'}), 500

@accounts_bp.route('/<account_id>', methods=['GET'])
@login_required
def get_account(account_id):
    """
    GET /api/trading-journal/accounts/<account_id>
    Get specific account details
    """
    user_id = session.get('user_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM mt5_accounts 
            WHERE id = ? AND user_id = ?
        ''', (account_id, user_id))
        
        account = cursor.fetchone()
        conn.close()
        
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        return jsonify(dict(account))
    except Exception as e:
        print(f'❌ Get account error: {e}')
        return jsonify({'error': 'Failed to fetch account'}), 500

@accounts_bp.route('/register', methods=['POST'])
def register_account():
    """
    POST /api/trading-journal/accounts/register
    Register MT5 account (no authentication required - for EA webhook)
    """
    try:
        data = request.json
        
        account_number = data.get('accountNumber')
        account_name = data.get('accountName')
        broker = data.get('broker', 'Unknown')
        account_type = data.get('accountType', 'Live')
        currency = data.get('currency', 'USD')
        initial_balance = data.get('initialBalance', 0)
        current_balance = data.get('currentBalance', initial_balance)
        
        if not account_number:
            return jsonify({'error': 'Account number is required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if account already exists
        cursor.execute('''
            SELECT id, account_number FROM mt5_accounts 
            WHERE account_number = ?
        ''', (account_number,))
        
        existing = cursor.fetchone()
        
        if existing:
            conn.close()
            print(f'✅ Account {account_number} already registered')
            return jsonify({
                'success': True,
                'message': 'Account already registered',
                'accountId': existing['id'],
                'accountNumber': existing['account_number']
            })
        
        # Create new account with default user (assume first user or default)
        # You may need to adjust this based on your system
        cursor.execute('''
            INSERT INTO mt5_accounts 
            (user_id, account_number, account_name, broker, account_type, 
             currency, initial_balance, current_balance, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        ''', (
            '1',  # Default user - adjust based on your system
            account_number,
            account_name or f'Account {account_number}',
            broker,
            account_type,
            currency,
            initial_balance,
            current_balance
        ))
        
        conn.commit()
        account_id = cursor.lastrowid
        conn.close()
        
        print(f'✅ Account registered: {account_number} - {account_name}')
        
        return jsonify({
            'success': True,
            'message': 'Account registered successfully',
            'accountId': account_id,
            'accountNumber': account_number,
            'accountName': account_name
        }), 201
        
    except Exception as e:
        print(f'❌ Register account error: {e}')
        return jsonify({'error': 'Failed to register account'}), 500

@accounts_bp.route('/<account_id>/stats', methods=['GET'])
@login_required
def get_account_stats(account_id):
    """
    GET /api/trading-journal/accounts/<account_id>/stats
    Get trading statistics for an account
    """
    user_id = session.get('user_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                COUNT(*) as total_trades,
                SUM(CASE WHEN status = 'CLOSED' AND net_profit > 0 THEN 1 ELSE 0 END) as winning_trades,
                SUM(CASE WHEN status = 'CLOSED' AND net_profit < 0 THEN 1 ELSE 0 END) as losing_trades,
                SUM(CASE WHEN status = 'CLOSED' THEN net_profit ELSE 0 END) as total_profit_loss,
                AVG(CASE WHEN status = 'CLOSED' AND net_profit > 0 THEN net_profit END) as avg_win,
                AVG(CASE WHEN status = 'CLOSED' AND net_profit < 0 THEN net_profit END) as avg_loss,
                MAX(net_profit) as best_trade,
                MIN(net_profit) as worst_trade,
                SUM(CASE WHEN status = 'CLOSED' AND net_profit > 0 THEN net_profit ELSE 0 END) as gross_profit,
                ABS(SUM(CASE WHEN status = 'CLOSED' AND net_profit < 0 THEN net_profit ELSE 0 END)) as gross_loss
            FROM journal_trades
            WHERE account_id = ? AND user_id = ?
        ''', (account_id, user_id))
        
        stats = dict(cursor.fetchone())
        conn.close()
        
        # Calculate derived metrics
        total_trades = int(stats.get('total_trades', 0) or 0)
        winning_trades = int(stats.get('winning_trades', 0) or 0)
        losing_trades = int(stats.get('losing_trades', 0) or 0)
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        gross_profit = float(stats.get('gross_profit', 0) or 0)
        gross_loss = float(stats.get('gross_loss', 0) or 0)
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else 0
        
        avg_win = float(stats.get('avg_win', 0) or 0)
        avg_loss = float(stats.get('avg_loss', 0) or 0)
        loss_rate = (losing_trades / total_trades * 100) if total_trades > 0 else 0
        expectancy = (win_rate / 100 * avg_win) - (loss_rate / 100 * abs(avg_loss))
        
        return jsonify({
            'totalTrades': total_trades,
            'winningTrades': winning_trades,
            'losingTrades': losing_trades,
            'winRate': round(win_rate, 2),
            'totalProfitLoss': float(stats.get('total_profit_loss', 0) or 0),
            'avgWin': avg_win,
            'avgLoss': avg_loss,
            'bestTrade': float(stats.get('best_trade', 0) or 0),
            'worstTrade': float(stats.get('worst_trade', 0) or 0),
            'grossProfit': gross_profit,
            'grossLoss': gross_loss,
            'profitFactor': round(profit_factor, 2),
            'expectancy': round(expectancy, 2),
        })
        
    except Exception as e:
        print(f'❌ Get stats error: {e}')
        return jsonify({'error': 'Failed to fetch statistics'}), 500

@accounts_bp.route('/<account_id>', methods=['PUT'])
@login_required
def update_account(account_id):
    """
    PUT /api/trading-journal/accounts/<account_id>
    Update account details
    """
    user_id = session.get('user_id')
    data = request.json
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Build dynamic update query
        updates = []
        params = []
        
        if 'account_name' in data:
            updates.append('account_name = ?')
            params.append(data['account_name'])
        if 'broker' in data:
            updates.append('broker = ?')
            params.append(data['broker'])
        if 'account_type' in data:
            updates.append('account_type = ?')
            params.append(data['account_type'])
        if 'currency' in data:
            updates.append('currency = ?')
            params.append(data['currency'])
        if 'current_balance' in data:
            updates.append('current_balance = ?')
            params.append(data['current_balance'])
        
        if not updates:
            return jsonify({'error': 'No fields to update'}), 400
        
        params.extend([account_id, user_id])
        
        cursor.execute(f'''
            UPDATE mt5_accounts 
            SET {', '.join(updates)}
            WHERE id = ? AND user_id = ?
        ''', params)
        
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Account not found'}), 404
        
        # Fetch updated account
        cursor.execute('SELECT * FROM mt5_accounts WHERE id = ?', (account_id,))
        result = dict(cursor.fetchone())
        conn.close()
        
        return jsonify(result)
        
    except Exception as e:
        print(f'❌ Update account error: {e}')
        return jsonify({'error': 'Failed to update account'}), 500

@accounts_bp.route('/update-balance', methods=['POST'])
def update_balance():
    """
    POST /api/trading-journal/accounts/update-balance
    Update account balance from MT5 EA
    """
    try:
        data = request.json
        
        account_number = data.get('accountNumber')
        current_balance = data.get('currentBalance')
        
        if not account_number or current_balance is None:
            return jsonify({'error': 'accountNumber and currentBalance are required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE mt5_accounts 
            SET current_balance = ?
            WHERE account_number = ?
        ''', (current_balance, account_number))
        
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Account not found'}), 404
        
        conn.close()
        
        print(f'💰 Balance updated for account: {account_number} → ${current_balance}')
        return jsonify({'success': True, 'balance': current_balance})
        
    except Exception as e:
        print(f'❌ Update balance error: {e}')
        return jsonify({'error': 'Failed to update balance'}), 500
