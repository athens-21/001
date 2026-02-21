"""
Trading Journal - Settings Routes
แปลงจาก: backend/src/routes/settings.js
"""
from flask import Blueprint, request, session, jsonify
from functools import wraps
import sqlite3
import os
import json

settings_bp = Blueprint('journal_settings', __name__, url_prefix='/api/trading-journal/settings')

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

@settings_bp.route('', methods=['GET'])
@login_required
def get_settings():
    """
    GET /api/trading-journal/settings
    Get all settings for user
    """
    user_id = session.get('user_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT setting_key, setting_value, setting_type 
            FROM journal_settings 
            WHERE user_id = ?
        ''', (user_id,))
        
        settings = cursor.fetchall()
        conn.close()
        
        # Convert to key-value object
        settings_obj = {}
        for s in settings:
            value = s['setting_value']
            
            # Convert based on type
            if s['setting_type'] == 'number':
                try:
                    value = float(value)
                except:
                    value = 0
            elif s['setting_type'] == 'boolean':
                value = value.lower() == 'true' if isinstance(value, str) else bool(value)
            elif s['setting_type'] == 'json':
                try:
                    value = json.loads(value)
                except:
                    value = {}
            
            settings_obj[s['setting_key']] = value
        
        return jsonify(settings_obj)
        
    except Exception as e:
        print(f'❌ Get settings error: {e}')
        return jsonify({'error': 'Failed to fetch settings'}), 500

@settings_bp.route('', methods=['PUT'])
@login_required
def update_settings():
    """
    PUT /api/trading-journal/settings
    Update settings (upsert)
    """
    user_id = session.get('user_id')
    settings = request.json
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        for key, value in settings.items():
            setting_value = value
            setting_type = 'string'
            
            # Determine type
            if isinstance(value, bool):
                setting_type = 'boolean'
                setting_value = str(value)
            elif isinstance(value, (int, float)):
                setting_type = 'number'
                setting_value = str(value)
            elif isinstance(value, (dict, list)):
                setting_type = 'json'
                setting_value = json.dumps(value)
            else:
                setting_value = str(value)
            
            # Upsert
            cursor.execute('''
                INSERT INTO journal_settings (user_id, setting_key, setting_value, setting_type)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (user_id, setting_key) 
                DO UPDATE SET setting_value = ?, setting_type = ?
            ''', (user_id, key, setting_value, setting_type, setting_value, setting_type))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Settings updated successfully'})
        
    except Exception as e:
        print(f'❌ Update settings error: {e}')
        return jsonify({'error': 'Failed to update settings'}), 500

@settings_bp.route('/columns', methods=['GET'])
@login_required
def get_columns():
    """
    GET /api/trading-journal/settings/columns
    Get custom columns configuration
    """
    user_id = session.get('user_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM journal_custom_columns 
            WHERE user_id = ?
            ORDER BY display_order ASC
        ''', (user_id,))
        
        columns = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify(columns)
        
    except Exception as e:
        print(f'❌ Get columns error: {e}')
        return jsonify({'error': 'Failed to fetch columns'}), 500

@settings_bp.route('/columns', methods=['POST'])
@login_required
def create_column():
    """
    POST /api/trading-journal/settings/columns
    Create new custom column
    """
    user_id = session.get('user_id')
    data = request.json
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        column_options = data.get('column_options')
        if isinstance(column_options, list):
            column_options = json.dumps(column_options)
        
        cursor.execute('''
            INSERT INTO journal_custom_columns 
            (user_id, column_name, column_label, column_type, column_options, is_visible, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            data.get('column_name'),
            data.get('column_label'),
            data.get('column_type', 'text'),
            column_options,
            1 if data.get('is_visible', True) else 0,
            data.get('display_order', 0)
        ))
        
        conn.commit()
        column_id = cursor.lastrowid
        
        cursor.execute('SELECT * FROM journal_custom_columns WHERE id = ?', (column_id,))
        result = dict(cursor.fetchone())
        conn.close()
        
        return jsonify(result), 201
        
    except Exception as e:
        print(f'❌ Create column error: {e}')
        return jsonify({'error': 'Failed to create column'}), 500

@settings_bp.route('/columns/<int:column_id>', methods=['PUT'])
@login_required
def update_column(column_id):
    """
    PUT /api/trading-journal/settings/columns/<column_id>
    Update custom column
    """
    user_id = session.get('user_id')
    data = request.json
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Build dynamic update query
        updates = []
        params = []
        
        if 'column_label' in data:
            updates.append('column_label = ?')
            params.append(data['column_label'])
        
        if 'is_visible' in data:
            updates.append('is_visible = ?')
            params.append(1 if data['is_visible'] else 0)
        
        if 'display_order' in data:
            updates.append('display_order = ?')
            params.append(data['display_order'])
        
        if not updates:
            conn.close()
            return jsonify({'error': 'No fields to update'}), 400
        
        params.extend([column_id, user_id])
        
        cursor.execute(f'''
            UPDATE journal_custom_columns 
            SET {', '.join(updates)}
            WHERE id = ? AND user_id = ?
        ''', params)
        
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Column not found'}), 404
        
        # Fetch updated column
        cursor.execute('SELECT * FROM journal_custom_columns WHERE id = ?', (column_id,))
        result = dict(cursor.fetchone())
        conn.close()
        
        return jsonify(result)
        
    except Exception as e:
        print(f'❌ Update column error: {e}')
        return jsonify({'error': 'Failed to update column'}), 500

@settings_bp.route('/columns/<int:column_id>', methods=['DELETE'])
@login_required
def delete_column(column_id):
    """
    DELETE /api/trading-journal/settings/columns/<column_id>
    Delete custom column
    """
    user_id = session.get('user_id')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM journal_custom_columns 
            WHERE id = ? AND user_id = ?
        ''', (column_id, user_id))
        
        conn.commit()
        deleted_count = cursor.rowcount
        conn.close()
        
        if deleted_count == 0:
            return jsonify({'error': 'Column not found'}), 404
        
        return jsonify({'message': 'Column deleted successfully'})
        
    except Exception as e:
        print(f'❌ Delete column error: {e}')
        return jsonify({'error': 'Failed to delete column'}), 500
