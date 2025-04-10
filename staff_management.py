import sqlite3
from datetime import datetime

class StaffManagement:
    def __init__(self):
        self.db_path = 'uniform_inventory.db'

    def add_staff(self, name, department):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO staff (name, department)
            VALUES (?, ?)
        ''', (name, department))
        conn.commit()
        conn.close()

    def edit_staff(self, staff_id, name, department):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE staff 
            SET name = ?, department = ?
            WHERE id = ?
        ''', (name, department, staff_id))
        conn.commit()
        conn.close()

    def delete_staff(self, staff_id):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # First check if staff has any active assignments
        cursor.execute('''
            SELECT COUNT(*) FROM staff_assignments 
            WHERE staff_id = ? AND status = 'assigned'
        ''', (staff_id,))
        active_assignments = cursor.fetchone()[0]
        
        if active_assignments > 0:
            conn.close()
            return False, "Cannot delete staff member with active uniform assignments"
        
        # If no active assignments, proceed with deletion
        cursor.execute('DELETE FROM staff WHERE id = ?', (staff_id,))
        conn.commit()
        conn.close()
        return True, "Staff member deleted successfully"

    def get_staff_by_id(self, staff_id):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, department
            FROM staff
            WHERE id = ?
        ''', (staff_id,))
        result = cursor.fetchone()
        conn.close()
        if result:
            return {
                'id': result[0],
                'name': result[1],
                'department': result[2]
            }
        return None

    def assign_uniform(self, staff_id, uniform_id, notes=""):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create assignment
        cursor.execute('''
            INSERT INTO staff_assignments (staff_id, uniform_id, notes)
            VALUES (?, ?, ?)
        ''', (staff_id, uniform_id, notes))
        
        # Update stock
        cursor.execute('''
            UPDATE uniforms 
            SET current_stock = current_stock - 1
            WHERE id = ?
        ''', (uniform_id,))
        
        # Record stock movement
        cursor.execute('''
            INSERT INTO stock_movements (uniform_id, movement_type, quantity, notes)
            VALUES (?, 'assignment', -1, ?)
        ''', (uniform_id, notes))
        
        conn.commit()
        conn.close()

    def return_uniform(self, assignment_id, discard=False, notes=""):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get assignment details
        cursor.execute('''
            SELECT staff_id, uniform_id 
            FROM staff_assignments 
            WHERE id = ?
        ''', (assignment_id,))
        staff_id, uniform_id = cursor.fetchone()
        
        # Update assignment status
        cursor.execute('''
            UPDATE staff_assignments 
            SET status = ?, returned_date = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', ('returned' if not discard else 'discarded', assignment_id))
        
        if not discard:
            # Update stock if not discarded
            cursor.execute('''
                UPDATE uniforms 
                SET current_stock = current_stock + 1
                WHERE id = ?
            ''', (uniform_id,))
            
            # Record stock movement
            cursor.execute('''
                INSERT INTO stock_movements (uniform_id, movement_type, quantity, notes)
                VALUES (?, 'return', 1, ?)
            ''', (uniform_id, notes))
        
        conn.commit()
        conn.close()

    def get_staff_assignments(self, staff_id=None, status=None):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = '''
            SELECT sa.id, s.name, s.department,
                   u.type, u.size, u.color, sa.assigned_date,
                   sa.returned_date, sa.status, sa.notes
            FROM staff_assignments sa
            JOIN staff s ON sa.staff_id = s.id
            JOIN uniforms u ON sa.uniform_id = u.id
        '''
        params = []
        
        if staff_id or status:
            query += ' WHERE'
            if staff_id:
                query += ' sa.staff_id = ?'
                params.append(staff_id)
            if status:
                if staff_id:
                    query += ' AND'
                query += ' sa.status = ?'
                params.append(status)
        
        query += ' ORDER BY sa.assigned_date DESC'
        
        cursor.execute(query, params)
        results = cursor.fetchall()
        conn.close()
        return results

    def get_staff_list(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, department
            FROM staff
            ORDER BY name
        ''')
        results = cursor.fetchall()
        
        # Convert results to list of dictionaries
        staff_list = []
        for row in results:
            staff_id = row[0]
            
            # Get assigned uniforms for this staff member
            cursor.execute('''
                SELECT u.type, u.size, u.color, sa.assigned_date, sa.status
                FROM staff_assignments sa
                JOIN uniforms u ON sa.uniform_id = u.id
                WHERE sa.staff_id = ? AND sa.status = 'assigned'
                ORDER BY sa.assigned_date DESC
            ''', (staff_id,))
            uniforms = cursor.fetchall()
            
            # Convert uniforms to list of dictionaries
            assigned_uniforms = []
            for uniform in uniforms:
                assigned_uniforms.append({
                    'type': uniform[0],
                    'size': uniform[1],
                    'color': uniform[2],
                    'assigned_date': uniform[3],
                    'status': uniform[4]
                })
            
            staff_list.append({
                'id': staff_id,
                'name': row[1],
                'department': row[2],
                'assigned_uniforms': assigned_uniforms
            })
        
        conn.close()
        return staff_list 