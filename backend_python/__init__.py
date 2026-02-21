"""
Trading Journal - Python Backend Module
Integration package for the main TDJTT system

Usage in main app (D:\TDJTT\3406v3\app\core\app_factory.py):
    
    from trading_journal import init_trading_journal
    
    app = create_app()
    init_trading_journal(app)
"""
from flask import Blueprint
from .routes import accounts_bp, trades_bp, analytics_bp, settings_bp
from .database import init_journal_tables, check_tables_exist

__version__ = '1.0.0'

def init_trading_journal(app):
    """
    Initialize Trading Journal blueprints and database
    
    Args:
        app: Flask application instance
        
    Returns:
        Flask app with Trading Journal routes registered
    """
    # Check if tables exist, initialize if needed
    if not check_tables_exist():
        print('[TRADING_JOURNAL] Tables not found, initializing...')
        init_journal_tables()
    
    # Register blueprints
    app.register_blueprint(accounts_bp)
    app.register_blueprint(trades_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(settings_bp)
    
    print('[TRADING_JOURNAL] ✅ Routes registered:')
    print('  - /api/trading-journal/accounts')
    print('  - /api/trading-journal/trades')
    print('  - /api/trading-journal/analytics')
    print('  - /api/trading-journal/settings')
    
    return app

__all__ = ['init_trading_journal', 'init_journal_tables', 'check_tables_exist']
