"""
Trading Journal - Analytics Routes
Provides statistical analysis and reporting
"""
from flask import Blueprint, request, session, jsonify
from functools import wraps
import sqlite3
import os
from datetime import datetime, timedelta

analytics_bp = Blueprint('journal_analytics', __name__, url_prefix='/api/trading-journal/analytics')

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

@analytics_bp.route('/summary', methods=['GET'])
@login_required
def get_summary():
    """
    GET /api/trading-journal/analytics/summary
    Get overall trading summary for user
    """
    user_id = session.get('user_id')
    account_id = request.args.get('account_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
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
            WHERE user_id = ?
        '''
        
        params = [user_id]
        
        if account_id:
            query += ' AND account_id = ?'
            params.append(account_id)
        
        cursor.execute(query, params)
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
        print(f'❌ Get summary error: {e}')
        return jsonify({'error': 'Failed to fetch summary'}), 500

@analytics_bp.route('/by-pair', methods=['GET'])
@login_required
def get_by_pair():
    """
    GET /api/trading-journal/analytics/by-pair
    Get statistics grouped by trading pair
    """
    user_id = session.get('user_id')
    account_id = request.args.get('account_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT 
                pair,
                COUNT(*) as total_trades,
                SUM(CASE WHEN status = 'CLOSED' AND net_profit > 0 THEN 1 ELSE 0 END) as winning_trades,
                SUM(CASE WHEN status = 'CLOSED' THEN net_profit ELSE 0 END) as total_profit
            FROM journal_trades
            WHERE user_id = ?
        '''
        
        params = [user_id]
        
        if account_id:
            query += ' AND account_id = ?'
            params.append(account_id)
        
        query += ' GROUP BY pair ORDER BY total_profit DESC'
        
        cursor.execute(query, params)
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        # Calculate win rate for each pair
        for result in results:
            total = result['total_trades']
            wins = result['winning_trades']
            result['winRate'] = round((wins / total * 100) if total > 0 else 0, 2)
        
        return jsonify(results)
        
    except Exception as e:
        print(f'❌ Get by pair error: {e}')
        return jsonify({'error': 'Failed to fetch pair statistics'}), 500

@analytics_bp.route('/by-date', methods=['GET'])
@login_required
def get_by_date():
    """
    GET /api/trading-journal/analytics/by-date
    Get daily profit/loss data
    """
    user_id = session.get('user_id')
    account_id = request.args.get('account_id')
    days = int(request.args.get('days', 30))
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT 
                trade_date,
                COUNT(*) as trades,
                SUM(CASE WHEN status = 'CLOSED' THEN net_profit ELSE 0 END) as profit
            FROM journal_trades
            WHERE user_id = ?
        '''
        
        params = [user_id]
        
        if account_id:
            query += ' AND account_id = ?'
            params.append(account_id)
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        query += ' AND trade_date >= ? AND trade_date <= ?'
        params.extend([start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')])
        
        query += ' GROUP BY trade_date ORDER BY trade_date ASC'
        
        cursor.execute(query, params)
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify(results)
        
    except Exception as e:
        print(f'❌ Get by date error: {e}')
        return jsonify({'error': 'Failed to fetch date statistics'}), 500

@analytics_bp.route('/performance', methods=['GET'])
@login_required
def get_performance():
    """
    GET /api/trading-journal/analytics/performance
    Get performance metrics including drawdown, consecutive wins/losses
    """
    user_id = session.get('user_id')
    account_id = request.args.get('account_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT 
                net_profit,
                trade_date,
                close_time
            FROM journal_trades
            WHERE user_id = ? AND status = 'CLOSED'
        '''
        
        params = [user_id]
        
        if account_id:
            query += ' AND account_id = ?'
            params.append(account_id)
        
        query += ' ORDER BY close_time ASC'
        
        cursor.execute(query, params)
        trades = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        if not trades:
            return jsonify({
                'maxDrawdown': 0,
                'maxConsecutiveWins': 0,
                'maxConsecutiveLosses': 0,
                'currentStreak': 0,
                'equityCurve': []
            })
        
        # Calculate metrics
        equity = 0
        max_equity = 0
        max_drawdown = 0
        
        consecutive_wins = 0
        consecutive_losses = 0
        max_consecutive_wins = 0
        max_consecutive_losses = 0
        current_streak = 0
        
        equity_curve = []
        
        for trade in trades:
            profit = trade['net_profit'] or 0
            equity += profit
            
            # Track max equity for drawdown calculation
            if equity > max_equity:
                max_equity = equity
            
            drawdown = max_equity - equity
            if drawdown > max_drawdown:
                max_drawdown = drawdown
            
            # Track consecutive wins/losses
            if profit > 0:
                consecutive_wins += 1
                consecutive_losses = 0
                current_streak = consecutive_wins
                if consecutive_wins > max_consecutive_wins:
                    max_consecutive_wins = consecutive_wins
            elif profit < 0:
                consecutive_losses += 1
                consecutive_wins = 0
                current_streak = -consecutive_losses
                if consecutive_losses > max_consecutive_losses:
                    max_consecutive_losses = consecutive_losses
            
            # Add to equity curve
            equity_curve.append({
                'date': trade['trade_date'],
                'equity': round(equity, 2)
            })
        
        return jsonify({
            'maxDrawdown': round(max_drawdown, 2),
            'maxConsecutiveWins': max_consecutive_wins,
            'maxConsecutiveLosses': max_consecutive_losses,
            'currentStreak': current_streak,
            'equityCurve': equity_curve
        })
        
    except Exception as e:
        print(f'❌ Get performance error: {e}')
        return jsonify({'error': 'Failed to fetch performance metrics'}), 500
