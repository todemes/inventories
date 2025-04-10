import sqlite3
import os

def update_db_schema():
    # Check if backup exists
    if not os.path.exists('uniform_inventory_backup.db'):
        print("Backup file not found. Please create a backup first.")
        return
    
    # Connect to the database
    conn = sqlite3.connect('uniform_inventory.db')
    cursor = conn.cursor()
    
    # Drop existing tables
    print("Dropping existing tables...")
    cursor.execute("DROP TABLE IF EXISTS staff_assignments")
    cursor.execute("DROP TABLE IF EXISTS stock_movements")
    cursor.execute("DROP TABLE IF EXISTS staff")
    cursor.execute("DROP TABLE IF EXISTS uniforms")
    
    # Create uniforms table
    print("Creating uniforms table...")
    cursor.execute('''
    CREATE TABLE uniforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        size TEXT NOT NULL,
        color TEXT NOT NULL,
        current_stock INTEGER DEFAULT 0
    )
    ''')
    
    # Create staff table
    print("Creating staff table...")
    cursor.execute('''
    CREATE TABLE staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department TEXT NOT NULL
    )
    ''')
    
    # Create stock_movements table
    print("Creating stock_movements table...")
    cursor.execute('''
    CREATE TABLE stock_movements (
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
    print("Creating staff_assignments table...")
    cursor.execute('''
    CREATE TABLE staff_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_id INTEGER,
        uniform_id INTEGER,
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        returned_date TIMESTAMP,
        status TEXT DEFAULT 'assigned',
        notes TEXT,
        FOREIGN KEY (staff_id) REFERENCES staff (id),
        FOREIGN KEY (uniform_id) REFERENCES uniforms (id)
    )
    ''')
    
    # Commit changes and close connection
    conn.commit()
    conn.close()
    
    print("Database schema updated successfully!")

if __name__ == "__main__":
    update_db_schema() 