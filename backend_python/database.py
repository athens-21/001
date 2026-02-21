"""
Trading Journal - Database Manager
Handles database initialization and connections
"""
import sqlite3
import os

# Database path - will be adjusted based on deployment
DB_PATH = os.path.join(os.path.dirname(__file__), '../../data/accounts.db')

def init_journal_tables():
    """
    Initialize Trading Journal tables in existing database
    Run this once during integration
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Read and execute schema
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = f.read()
        
        cursor.executescript(schema)
        conn.commit()
        conn.close()
        
        print('[TRADING_JOURNAL] ✅ Database tables initialized successfully')
        return True
        
    except Exception as e:
        print(f'[TRADING_JOURNAL] ❌ Database initialization error: {e}')
        return False

def get_journal_db():
    """
    Get database connection with Row factory
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def check_tables_exist():
    """
    Check if Trading Journal tables exist in database
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name LIKE 'journal_%'
        ''')
        
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        required_tables = [
            'journal_trades',
            'journal_settings',
            'journal_custom_columns',
            'journal_command_history'
        ]
        
        return all(table in tables for table in required_tables)
        
    except Exception as e:
        print(f'[TRADING_JOURNAL] ❌ Error checking tables: {e}')
        return False

def migrate_database():
    """
    Run any necessary database migrations
    Add migration logic here as needed
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Example migration: Add new column if it doesn't exist
        # cursor.execute('''
        #     ALTER TABLE journal_trades 
        #     ADD COLUMN new_field TEXT DEFAULT NULL
        # ''')
        
        conn.commit()
        conn.close()
        
        print('[TRADING_JOURNAL] ✅ Database migrations completed')
        return True
        
    except Exception as e:
        # If the column already exists, that's fine
        if 'duplicate column name' in str(e).lower():
            return True
        print(f'[TRADING_JOURNAL] ❌ Migration error: {e}')
        return False

if __name__ == '__main__':
    """
    Run this file directly to initialize the database
    """
    print('[TRADING_JOURNAL] Initializing database...')
    
    if not os.path.exists(DB_PATH):
        print(f'[TRADING_JOURNAL] ❌ Database not found at: {DB_PATH}')
        print('[TRADING_JOURNAL] Please ensure the main database exists first')
    else:
        if init_journal_tables():
            print('[TRADING_JOURNAL] ✅ Setup complete!')
        else:
            print('[TRADING_JOURNAL] ❌ Setup failed')
