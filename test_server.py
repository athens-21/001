"""
Trading Journal - Standalone Test Server
Run this file to test the Trading Journal backend independently
"""
from flask import Flask, session, jsonify, send_from_directory
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import trading journal
from backend_python import init_trading_journal

# Create Flask app
app = Flask(__name__, 
            static_folder='frontend/dist',
            static_url_path='')
app.secret_key = 'test-secret-key-change-in-production'
app.config['SESSION_TYPE'] = 'filesystem'

# Initialize Trading Journal
init_trading_journal(app)

# ============================================
# Test Routes
# ============================================

@app.route('/')
def index():
    """Serve frontend"""
    return send_from_directory('frontend/dist', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    """Serve static files"""
    return send_from_directory('frontend/dist', path)

@app.route('/test-login')
def test_login():
    """Mock login - sets session"""
    session['user_id'] = '1'
    session['username'] = 'testuser'
    return jsonify({
        'message': 'Logged in successfully',
        'user_id': '1',
        'username': 'testuser'
    })

@app.route('/test-logout')
def test_logout():
    """Mock logout"""
    session.clear()
    return jsonify({'message': 'Logged out successfully'})

@app.route('/test-status')
def test_status():
    """Check login status"""
    if 'user_id' in session:
        return jsonify({
            'logged_in': True,
            'user_id': session['user_id'],
            'username': session.get('username', 'Unknown')
        })
    else:
        return jsonify({'logged_in': False})

# ============================================
# Run Server
# ============================================

if __name__ == '__main__':
    print('=' * 60)
    print('Trading Journal - Test Server')
    print('=' * 60)
    print()
    print('Server running at: http://localhost:5001')
    print()
    print('Test endpoints:')
    print('  - GET  http://localhost:5001/test-login')
    print('  - GET  http://localhost:5001/test-logout')
    print('  - GET  http://localhost:5001/test-status')
    print()
    print('API endpoints:')
    print('  - GET  http://localhost:5001/api/trading-journal/accounts')
    print('  - GET  http://localhost:5001/api/trading-journal/trades')
    print('  - GET  http://localhost:5001/api/trading-journal/analytics/summary')
    print('  - GET  http://localhost:5001/api/trading-journal/settings')
    print()
    print('Frontend:')
    print('  - http://localhost:5001/')
    print()
    print('Usage:')
    print('1. Visit http://localhost:5001/test-login to login')
    print('2. Test API endpoints with browser or curl')
    print('3. Visit http://localhost:5001/ for frontend')
    print()
    print('Press Ctrl+C to stop')
    print('=' * 60)
    
    app.run(host='0.0.0.0', port=5001, debug=True)
