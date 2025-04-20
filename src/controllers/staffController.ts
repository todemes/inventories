import { Database, RunResult } from 'sqlite3';
import { getDb } from '../services/database';

interface Staff {
  id?: number;
  name: string;
  department: string;
}

interface StaffAssignment {
  id?: number;
  staff_id: number;
  uniform_id: number;
  assigned_date: string;
  returned_date?: string;
  status: 'assigned' | 'returned' | 'discarded';
}

export class StaffController {
  private db: Database;

  constructor() {
    this.db = getDb();
  }

  async getAllStaff(): Promise<Staff[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM staff ORDER BY name', (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows as Staff[]);
      });
    });
  }

  async addStaff(staff: Omit<Staff, 'id'>): Promise<Staff> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO staff (name, department) VALUES (?, ?)',
        [staff.name, staff.department],
        function(this: RunResult, err: Error | null) {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            id: this.lastID,
            ...staff
          });
        }
      );
    });
  }

  async assignUniform(assignment: Omit<StaffAssignment, 'id' | 'returned_date'>): Promise<StaffAssignment> {
    return new Promise((resolve, reject) => {
      const db = this.db;
      
      db.serialize(() => {
        // Check current stock
        db.get(
          'SELECT current_stock FROM uniforms WHERE id = ?',
          [assignment.uniform_id],
          (err: Error | null, row: any) => {
            if (err) {
              reject(err);
              return;
            }

            if (!row || row.current_stock <= 0) {
              reject(new Error('Cannot assign uniform with no stock available'));
              return;
            }

            // Begin transaction
            db.run('BEGIN TRANSACTION');

            // Update uniform stock
            db.run(
              'UPDATE uniforms SET current_stock = current_stock - 1 WHERE id = ?',
              [assignment.uniform_id],
              (err: Error | null) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                // Create assignment
                db.run(
                  'INSERT INTO staff_assignments (staff_id, uniform_id, assigned_date, status) VALUES (?, ?, ?, ?)',
                  [assignment.staff_id, assignment.uniform_id, assignment.assigned_date, assignment.status],
                  function(this: RunResult, err: Error | null) {
                    if (err) {
                      db.run('ROLLBACK');
                      reject(err);
                      return;
                    }

                    db.run('COMMIT', (err: Error | null) => {
                      if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                      }

                      resolve({
                        id: this.lastID,
                        ...assignment
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  async returnUniform(assignmentId: number, returnStatus: 'returned' | 'discarded', notes: string | null = null): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.db;
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Update assignment status and notes
        db.run(
          'UPDATE staff_assignments SET status = ?, returned_date = datetime("now"), notes = ? WHERE id = ?',
          [returnStatus, notes, assignmentId],
          (err: Error | null) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            // If returned (not discarded), increment uniform stock
            if (returnStatus === 'returned') {
              db.get(
                'SELECT uniform_id FROM staff_assignments WHERE id = ?',
                [assignmentId],
                (err: Error | null, row: any) => {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }

                  db.run(
                    'UPDATE uniforms SET current_stock = current_stock + 1 WHERE id = ?',
                    [row.uniform_id],
                    (err: Error | null) => {
                      if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                      }

                      db.run('COMMIT', (err: Error | null) => {
                        if (err) {
                          db.run('ROLLBACK');
                          reject(err);
                          return;
                        }
                        resolve();
                      });
                    }
                  );
                }
              );
            } else {
              db.run('COMMIT', (err: Error | null) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                resolve();
              });
            }
          }
        );
      });
    });
  }

  async getStaffAssignments(staffId?: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          sa.id as assignment_id,
          s.id as staff_id,
          s.name as staff_name,
          s.department,
          u.id as uniform_id,
          u.type as uniform_type,
          u.size as uniform_size,
          u.color as uniform_color,
          sa.assigned_date,
          sa.returned_date,
          sa.status
        FROM staff_assignments sa
        JOIN staff s ON sa.staff_id = s.id
        JOIN uniforms u ON sa.uniform_id = u.id
        ${staffId ? 'WHERE s.id = ?' : ''}
        ORDER BY sa.assigned_date DESC
      `;

      this.db.all(query, staffId ? [staffId] : [], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async deleteStaff(staffId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.db;
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // First check if staff has any active assignments
        db.get(
          'SELECT COUNT(*) as count FROM staff_assignments WHERE staff_id = ? AND status = "assigned"',
          [staffId],
          (err: Error | null, row: any) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            if (row.count > 0) {
              db.run('ROLLBACK');
              reject(new Error('Cannot delete staff member with active uniform assignments'));
              return;
            }

            // Delete staff member
            db.run(
              'DELETE FROM staff WHERE id = ?',
              [staffId],
              (err: Error | null) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                db.run('COMMIT', (err: Error | null) => {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  resolve();
                });
              }
            );
          }
        );
      });
    });
  }

  async exportToCSV(): Promise<string> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.name as staff_name,
          s.department,
          u.type as uniform_type,
          u.size as uniform_size,
          u.color as uniform_color,
          sa.assigned_date,
          sa.status
        FROM staff_assignments sa
        JOIN staff s ON sa.staff_id = s.id
        JOIN uniforms u ON sa.uniform_id = u.id
        ORDER BY s.name, sa.assigned_date DESC
      `;

      this.db.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const headers = ['Staff Name', 'Department', 'Uniform Type', 'Size', 'Color', 'Assigned Date', 'Status'];
        const csvRows = rows.map(row => [
          row.staff_name,
          row.department,
          row.uniform_type,
          row.uniform_size,
          row.uniform_color,
          row.assigned_date,
          row.status
        ]);

        const csv = [
          headers.join(','),
          ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        resolve(csv);
      });
    });
  }
} 