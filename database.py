import sqlite3
from datetime import datetime
import os

def init_db():
    conn = sqlite3.connect('uniform_inventory.db')
    cursor = conn.cursor()
    
    # Create uniforms table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS uniforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        size TEXT NOT NULL,
        color TEXT NOT NULL,
        current_stock INTEGER DEFAULT 0
    )
    ''')
    
    # Create staff table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department TEXT NOT NULL
    )
    ''')
    
    # Create stock_movements table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uniform_id INTEGER,
        movement_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (uniform_id) REFERENCES uniforms (id)
    )
    ''')
    
    # Create staff_assignments table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS staff_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_id INTEGER,
        uniform_id INTEGER,
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        returned_date TIMESTAMP,
        status TEXT DEFAULT 'assigned',
        FOREIGN KEY (staff_id) REFERENCES staff (id),
        FOREIGN KEY (uniform_id) REFERENCES uniforms (id)
    )
    ''')
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000))) 