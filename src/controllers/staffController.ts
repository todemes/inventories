import { Database, RunResult } from 'sqlite3';
import { getDb } from '../services/database';
import { formatDateForCsv } from './uniformController';

interface Staff {
  id?: number;
  name: string;
  department: string;
  full_name?: string | null;
  starting_date?: string | null;
  birthday?: string | null;
  status?: 'active' | 'inactive';
}

const STAFF_ALLOWED_VESSELS = new Set(['yin', 'yang']);

function normalizeAssignmentVessel(value: string | undefined): 'yin' | 'yang' {
  const normalized = (value || 'yin').trim().toLowerCase();
  if (!STAFF_ALLOWED_VESSELS.has(normalized)) {
    throw new Error('Vessel must be Yin or Yang');
  }
  return normalized as 'yin' | 'yang';
}

function normalizeAssignmentStorageLocation(value: string | undefined): string {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    throw new Error('Storage location is required');
  }
  if (trimmed.length > 100) {
    throw new Error('Storage location is too long');
  }
  return trimmed;
}

interface StaffAssignment {
  id?: number;
  staff_id: number;
  uniform_id: number;
  assigned_date: string;
  returned_date?: string;
  status: 'assigned' | 'returned' | 'discarded';
  assigned_condition?: 'New' | 'Good' | 'Fair' | 'Poor';
  returned_condition?: string | null;
  quantity: number;
  assigned_by?: string | null;
  vessel?: 'yin' | 'yang';
  storage_location?: string;
  notes?: string | null;
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
    const {
      name,
      department,
      full_name = null,
      starting_date = null,
      birthday = null,
      status = 'active'
    } = staff;

    if (!name?.trim()) {
      throw new Error('Name is required');
    }
    if (!department?.trim()) {
      throw new Error('Department is required');
    }

    const normalizedStatus = status === 'inactive' ? 'inactive' : 'active';

    const trimmedName = name.trim();
    const trimmedDepartment = department.trim();
    const trimmedFullName = full_name ? full_name.trim() : null;
    const normalizedName = trimmedName.toLowerCase();
    const normalizedFullName = (trimmedFullName || '').toLowerCase();
    const normalizedDepartmentKey = trimmedDepartment.toLowerCase();

    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT id FROM staff
         WHERE lower(name) = ?
           AND lower(TRIM(COALESCE(full_name, ''))) = ?
           AND lower(department) = ?
         LIMIT 1`,
        [normalizedName, normalizedFullName, normalizedDepartmentKey],
        (lookupErr: Error | null, existing: any) => {
          if (lookupErr) {
            reject(lookupErr);
            return;
          }
          if (existing) {
            reject(new Error('A staff member with the same name and department already exists.'));
            return;
          }

          this.db.run(
            'INSERT INTO staff (name, full_name, department, starting_date, birthday, status) VALUES (?, ?, ?, ?, ?, ?)',
            [trimmedName, trimmedFullName, trimmedDepartment, starting_date, birthday, normalizedStatus],
            function(this: RunResult, err: Error | null) {
              if (err) {
                reject(err);
                return;
              }
              resolve({
                id: this.lastID,
                name: trimmedName,
                department: trimmedDepartment,
                full_name: trimmedFullName,
                starting_date,
                birthday,
                status: normalizedStatus
              });
            }
          );
        }
      );
    });
  }

  async updateStaff(id: number, updates: Partial<Omit<Staff, 'id'>>): Promise<Staff> {
    if (!Number.isInteger(id) || id < 1) {
      throw new Error('Invalid staff id');
    }

    const allowedFields: (keyof Omit<Staff, 'id'>)[] = ['name', 'full_name', 'department', 'starting_date', 'birthday', 'status'];
    const entries = Object.entries(updates).filter(([key, value]) => allowedFields.includes(key as keyof Omit<Staff, 'id'>) && value !== undefined);

    if (entries.length === 0) {
      const existing = await this.getStaffById(id);
      if (!existing) {
        throw new Error('Staff not found');
      }
      return existing;
    }

    const setters: string[] = [];
    const params: any[] = [];
    let pendingStatus: 'active' | 'inactive' | null = null;
    for (const [key, rawValue] of entries) {
      if (key === 'status') {
        const normalized = rawValue === 'inactive' ? 'inactive' : 'active';
        setters.push(`${key} = ?`);
        params.push(normalized);
        pendingStatus = normalized;
      } else if (key === 'name' || key === 'department') {
        const trimmed = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
        if (!trimmed) {
          throw new Error(`${key === 'name' ? 'Name' : 'Department'} is required`);
        }
        setters.push(`${key} = ?`);
        params.push(trimmed);
      } else {
        setters.push(`${key} = ?`);
        params.push(rawValue ?? null);
      }
    }

    if (pendingStatus === 'inactive') {
      const hasAssignments = await this.hasActiveAssignments(id);
      if (hasAssignments) {
        throw new Error('This staff member cannot be set to Inactive while uniforms are still assigned.');
      }
    }

    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE staff SET ${setters.join(', ')} WHERE id = ?`,
        [...params, id],
        async (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          try {
            const updated = await this.getStaffById(id);
            if (!updated) {
              reject(new Error('Staff not found'));
              return;
            }
            resolve(updated);
          } catch (fetchErr) {
            reject(fetchErr);
          }
        }
      );
    });
  }

  private async hasActiveAssignments(staffId: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM staff_assignments WHERE staff_id = ? AND status = "assigned"',
        [staffId],
        (err: Error | null, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(Number(row?.count || 0) > 0);
        }
      );
    });
  }

  private async getStaffById(id: number): Promise<Staff | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM staff WHERE id = ?',
        [id],
        (err: Error | null, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? (row as Staff) : null);
        }
      );
    });
  }

  async getActiveStaff(): Promise<Staff[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM staff WHERE status = ? ORDER BY name', ['active'], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows as Staff[]);
      });
    });
  }

  async assignUniform(assignment: Omit<StaffAssignment, 'id' | 'returned_date' | 'returned_condition'>): Promise<StaffAssignment> {
    const quantity = assignment.quantity && assignment.quantity > 0 ? assignment.quantity : 1;
    const assignedCondition = assignment.assigned_condition || 'New';
    const assignedDate = assignment.assigned_date || new Date().toISOString();
    const assignedBy = (assignment.assigned_by || '').trim() || null;
    const vessel = normalizeAssignmentVessel(assignment.vessel);
    const storageLocation = normalizeAssignmentStorageLocation(assignment.storage_location);

    return new Promise((resolve, reject) => {
      const db = this.db;

      const rollback = (error: Error) => {
        db.run('ROLLBACK', () => reject(error));
      };

      const updateUniformTotal = (uniformId: number, done: (err?: Error | null) => void) => {
        db.get(
          'SELECT COALESCE(SUM(quantity), 0) as total FROM stock_locations WHERE uniform_id = ?',
          [uniformId],
          (sumErr: Error | null, totalRow: any) => {
            if (sumErr) {
              done(sumErr);
              return;
            }
            db.run(
              'UPDATE uniforms SET current_stock = ? WHERE id = ?',
              [totalRow?.total || 0, uniformId],
              done
            );
          }
        );
      };

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr: Error | null) => {
          if (beginErr) {
            reject(beginErr);
            return;
          }

          db.get('SELECT status FROM staff WHERE id = ?', [assignment.staff_id], (staffErr: Error | null, staffRow: any) => {
            if (staffErr) {
              rollback(staffErr);
              return;
            }
            if (!staffRow) {
              rollback(new Error('Staff member not found'));
              return;
            }
            if (staffRow.status !== 'active') {
              rollback(new Error('Cannot assign uniform to inactive staff member'));
              return;
            }

            db.get(
              `SELECT id, quantity FROM stock_locations
               WHERE uniform_id = ? AND vessel = ? AND lower(trim(storage_location)) = lower(trim(?))`,
              [assignment.uniform_id, vessel, storageLocation],
              (locationErr: Error | null, location: any) => {
                if (locationErr) {
                  rollback(locationErr);
                  return;
                }
                const availableAtLocation = Number(location?.quantity || 0);
                if (!location || availableAtLocation < quantity) {
                  rollback(new Error('Cannot assign more uniforms than available in the selected location'));
                  return;
                }

                db.get(
                  `SELECT id, quantity FROM staff_assignments
                   WHERE staff_id = ? AND uniform_id = ? AND status = 'assigned'
                     AND assigned_condition = ? AND DATE(assigned_date) = DATE(?)
                     AND vessel = ? AND lower(trim(storage_location)) = lower(trim(?))
                   LIMIT 1`,
                  [assignment.staff_id, assignment.uniform_id, assignedCondition, assignedDate, vessel, storageLocation],
                  (findErr: Error | null, existing: any) => {
                    if (findErr) {
                      rollback(findErr);
                      return;
                    }

                    const finalize = (targetId: number, totalQuantity: number) => {
                      db.run(
                        'UPDATE stock_locations SET quantity = quantity - ?, updated_at = ? WHERE id = ?',
                        [quantity, new Date().toISOString(), location.id],
                        (locationUpdateErr: Error | null) => {
                          if (locationUpdateErr) {
                            rollback(locationUpdateErr);
                            return;
                          }

                          updateUniformTotal(assignment.uniform_id, (totalErr?: Error | null) => {
                            if (totalErr) {
                              rollback(totalErr);
                              return;
                            }

                            db.run('COMMIT', (commitErr: Error | null) => {
                              if (commitErr) {
                                rollback(commitErr);
                                return;
                              }
                              resolve({
                                id: targetId,
                                ...assignment,
                                assigned_by: assignedBy,
                                assigned_date: assignedDate,
                                assigned_condition: assignedCondition,
                                quantity: totalQuantity,
                                status: 'assigned',
                                vessel,
                                storage_location: storageLocation
                              });
                            });
                          });
                        }
                      );
                    };

                    if (existing) {
                      const newTotal = existing.quantity + quantity;
                      db.run(
                        'UPDATE staff_assignments SET quantity = ?, assigned_by = COALESCE(assigned_by, ?) WHERE id = ?',
                        [newTotal, assignedBy, existing.id],
                        (updateErr: Error | null) => {
                          if (updateErr) {
                            rollback(updateErr);
                            return;
                          }
                          finalize(existing.id, newTotal);
                        }
                      );
                    } else {
                      db.run(
                        'INSERT INTO staff_assignments (staff_id, uniform_id, assigned_date, status, assigned_condition, quantity, assigned_by, vessel, storage_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [assignment.staff_id, assignment.uniform_id, assignedDate, 'assigned', assignedCondition, quantity, assignedBy, vessel, storageLocation],
                        function(this: RunResult, insertErr: Error | null) {
                          if (insertErr) {
                            rollback(insertErr);
                            return;
                          }
                          finalize(this.lastID, quantity);
                        }
                      );
                    }
                  }
                );
              }
            );
          });
        });
      });
    });
  }

  async returnUniform(
    assignmentId: number,
    returnStatus: 'returned' | 'discarded',
    condition: string,
    quantity: number,
    reason: string | null = null
  ): Promise<void> {
    const returnQuantity = quantity > 0 ? quantity : 0;
    const normalizedCondition = (condition || '').trim() || 'Good';
    const normalizedReason = (reason || '').trim() || null;

    return new Promise((resolve, reject) => {
      const db = this.db;

      const rollback = (error: Error) => {
        db.run('ROLLBACK', () => reject(error));
      };

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr: Error | null) => {
          if (beginErr) {
            reject(beginErr);
            return;
          }

          db.get(
            `SELECT staff_id, uniform_id, quantity, status, assigned_date, assigned_condition, assigned_by, vessel, storage_location
             FROM staff_assignments WHERE id = ?`,
            [assignmentId],
            (fetchErr: Error | null, assignment: any) => {
              if (fetchErr) {
                rollback(fetchErr);
                return;
              }

              if (!assignment) {
                rollback(new Error('Assignment not found'));
                return;
              }

              const assignmentAssignedBy: string | null = assignment.assigned_by || null;

              if (assignment.status !== 'assigned') {
                rollback(new Error('Only active assignments can be returned'));
                return;
              }

              const availableQuantity = assignment.quantity ?? 0;
              if (returnQuantity < 1) {
                rollback(new Error('Invalid return quantity'));
                return;
              }

              const assignmentCondition =
                (assignment.assigned_condition as 'New' | 'Good' | 'Fair' | 'Poor' | null) || 'New';

              interface ReturnCandidate {
                assignmentId: number;
                quantity: number;
                assigned_date: string;
                assigned_condition: 'New' | 'Good' | 'Fair' | 'Poor';
                assigned_by?: string | null;
                vessel: 'yin' | 'yang';
                storage_location: string;
              }

              interface ReturnOperation extends ReturnCandidate {
                takeQuantity: number;
              }

              const baseCandidate: ReturnCandidate = {
                assignmentId,
                quantity: availableQuantity,
                assigned_date: assignment.assigned_date,
                assigned_condition: assignmentCondition,
                assigned_by: assignmentAssignedBy,
                vessel: normalizeAssignmentVessel(assignment.vessel),
                storage_location: normalizeAssignmentStorageLocation(assignment.storage_location)
              };

              const candidates: ReturnCandidate[] = [baseCandidate];

              const applyReturnedStock = (operations: ReturnOperation[], done: () => void) => {
                if (returnStatus !== 'returned') {
                  done();
                  return;
                }

                const applyOne = (index: number) => {
                  if (index >= operations.length) {
                    db.get(
                      'SELECT COALESCE(SUM(quantity), 0) as total FROM stock_locations WHERE uniform_id = ?',
                      [assignment.uniform_id],
                      (sumErr: Error | null, totalRow: any) => {
                        if (sumErr) {
                          rollback(sumErr);
                          return;
                        }
                        db.run(
                          'UPDATE uniforms SET current_stock = ? WHERE id = ?',
                          [totalRow?.total || 0, assignment.uniform_id],
                          (uniformErr: Error | null) => {
                            if (uniformErr) {
                              rollback(uniformErr);
                              return;
                            }
                            done();
                          }
                        );
                      }
                    );
                    return;
                  }

                  const operation = operations[index];
                  db.get(
                    `SELECT id FROM stock_locations
                     WHERE uniform_id = ? AND vessel = ? AND lower(trim(storage_location)) = lower(trim(?))`,
                    [assignment.uniform_id, operation.vessel, operation.storage_location],
                    (locationErr: Error | null, location: any) => {
                      if (locationErr) {
                        rollback(locationErr);
                        return;
                      }
                      const timestamp = new Date().toISOString();
                      if (location) {
                        db.run(
                          'UPDATE stock_locations SET quantity = quantity + ?, updated_at = ? WHERE id = ?',
                          [operation.takeQuantity, timestamp, location.id],
                          (updateErr: Error | null) => {
                            if (updateErr) {
                              rollback(updateErr);
                              return;
                            }
                            applyOne(index + 1);
                          }
                        );
                      } else {
                        db.run(
                          `INSERT INTO stock_locations (uniform_id, vessel, storage_location, quantity, updated_at)
                           VALUES (?, ?, ?, ?, ?)`,
                          [assignment.uniform_id, operation.vessel, operation.storage_location, operation.takeQuantity, timestamp],
                          (insertErr: Error | null) => {
                            if (insertErr) {
                              rollback(insertErr);
                              return;
                            }
                            applyOne(index + 1);
                          }
                        );
                      }
                    }
                  );
                };

                applyOne(0);
              };

              const finish = () => {
                db.run('COMMIT', (commitErr: Error | null) => {
                  if (commitErr) {
                    rollback(commitErr);
                    return;
                  }
                  resolve();
                });
              };

              const processOperations = (operations: ReturnOperation[]) => {
                const runOperation = (index: number) => {
                  if (index >= operations.length) {
                    applyReturnedStock(operations, finish);
                    return;
                  }

                  const operation = operations[index];
                  if (operation.takeQuantity === operation.quantity) {
                    db.run(
                      'UPDATE staff_assignments SET status = ?, returned_date = datetime("now"), returned_condition = ?, notes = ? WHERE id = ?',
                      [returnStatus, normalizedCondition, normalizedReason, operation.assignmentId],
                      (updateErr: Error | null) => {
                        if (updateErr) {
                          rollback(updateErr);
                          return;
                        }
                        runOperation(index + 1);
                      }
                    );
                  } else {
                    const remainingQuantity = operation.quantity - operation.takeQuantity;
                    db.run(
                      'UPDATE staff_assignments SET quantity = ?, notes = NULL, returned_condition = NULL, returned_date = NULL WHERE id = ?',
                      [remainingQuantity, operation.assignmentId],
                      (updateErr: Error | null) => {
                        if (updateErr) {
                          rollback(updateErr);
                          return;
                        }

                        db.run(
                          'INSERT INTO staff_assignments (staff_id, uniform_id, assigned_date, returned_date, status, assigned_condition, returned_condition, quantity, notes, assigned_by, vessel, storage_location) VALUES (?, ?, ?, datetime("now"), ?, ?, ?, ?, ?, ?, ?, ?)',
                          [
                            assignment.staff_id,
                            assignment.uniform_id,
                            operation.assigned_date,
                            returnStatus,
                            operation.assigned_condition,
                            normalizedCondition,
                            operation.takeQuantity,
                            normalizedReason,
                            operation.assigned_by,
                            operation.vessel,
                            operation.storage_location
                          ],
                          (insertErr: Error | null) => {
                            if (insertErr) {
                              rollback(insertErr);
                              return;
                            }
                            runOperation(index + 1);
                          }
                        );
                      }
                    );
                  }
                };

                runOperation(0);
              };

              const buildOperations = (candidateList: ReturnCandidate[]) => {
                let remainingToReturn = returnQuantity;
                const operations: ReturnOperation[] = [];

                for (const candidate of candidateList) {
                  if (remainingToReturn <= 0) {
                    break;
                  }
                  const candidateQuantity = candidate.quantity ?? 0;
                  if (candidateQuantity <= 0) {
                    continue;
                  }
                  const takeQuantity = Math.min(candidateQuantity, remainingToReturn);
                  operations.push({
                    ...candidate,
                    takeQuantity
                  });
                  remainingToReturn -= takeQuantity;
                }

                if (remainingToReturn > 0) {
                  rollback(new Error('Invalid return quantity'));
                  return;
                }

                processOperations(operations);
              };

              if (returnQuantity <= availableQuantity) {
                buildOperations(candidates);
                return;
              }

              db.all(
                `SELECT id, quantity, assigned_date, assigned_condition, assigned_by, vessel, storage_location
                 FROM staff_assignments
                 WHERE staff_id = ? AND uniform_id = ? AND status = 'assigned'
                   AND assigned_condition = ? AND id != ?
                 ORDER BY assigned_date DESC, id DESC`,
                [assignment.staff_id, assignment.uniform_id, assignmentCondition, assignmentId],
                (extraErr: Error | null, rows: any[]) => {
                  if (extraErr) {
                    rollback(extraErr);
                    return;
                  }

                  let accumulated = availableQuantity;
                  const typedRows = rows as Array<{ id: number; quantity: number; assigned_date: string; assigned_condition?: 'New' | 'Good' | 'Fair' | 'Poor' | null; assigned_by?: string | null; vessel?: 'yin' | 'yang' | null; storage_location?: string | null; }>;
                  for (const row of typedRows) {
                    if (accumulated >= returnQuantity) {
                      break;
                    }
                    const rowQuantity = row.quantity ?? 0;
                    if (rowQuantity < 1) {
                      continue;
                    }
                    candidates.push({
                      assignmentId: row.id,
                      quantity: rowQuantity,
                      assigned_date: row.assigned_date,
                      assigned_condition: (row.assigned_condition as 'New' | 'Good' | 'Fair' | 'Poor' | null) || assignmentCondition,
                      assigned_by: row.assigned_by || null,
                      vessel: normalizeAssignmentVessel(row.vessel || assignment.vessel),
                      storage_location: normalizeAssignmentStorageLocation(row.storage_location || assignment.storage_location)
                    });
                    accumulated += rowQuantity;
                  }

                  if (accumulated < returnQuantity) {
                    rollback(new Error('Invalid return quantity'));
                    return;
                  }

                  buildOperations(candidates);
                }
              );
            }
          );
        });
      });
    });
  }

  async getStaffAssignments(staffId?: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const filters: string[] = [];
      const params: any[] = [];
      if (staffId) {
        filters.push('s.id = ?');
        params.push(staffId);
      }

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
          sa.status,
          sa.assigned_condition,
          sa.returned_condition,
          sa.quantity,
          sa.assigned_by,
          sa.vessel,
          sa.storage_location,
          sa.notes
        FROM staff_assignments sa
        JOIN staff s ON sa.staff_id = s.id
        JOIN uniforms u ON sa.uniform_id = u.id
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY sa.assigned_date DESC
      `;

      this.db.all(query, params, (err: Error | null, rows: any[]) => {
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
          sa.status,
          sa.assigned_condition,
          sa.returned_condition,
          sa.quantity,
          sa.vessel,
          sa.storage_location
        FROM staff_assignments sa
        JOIN staff s ON sa.staff_id = s.id
        JOIN uniforms u ON sa.uniform_id = u.id
        WHERE s.status = 'active'
        ORDER BY s.name, sa.assigned_date DESC
      `;

      this.db.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const headers = ['Staff Name', 'Department', 'Uniform Type', 'Size', 'Color', 'Vessel', 'Storage Location', 'Assigned Date', 'Status', 'Assigned Condition', 'Returned Condition', 'Quantity'];
        const csvRows = rows
          .filter(row => row.status === 'assigned')
          .map(row => [
            row.staff_name,
            row.department,
            row.uniform_type,
            row.uniform_size,
            row.uniform_color,
            row.vessel ? String(row.vessel).toUpperCase() : '',
            row.storage_location || '',
            formatDateForCsv(row.assigned_date),
            row.status,
            row.assigned_condition || 'New',
            row.returned_condition || '',
            row.quantity || 1
          ]);

        const csv = [
          headers.join(','),
          ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        resolve(csv);
      });
    });
  }

  // Fetch all staff with their assignments in a single query
  async getAllStaffWithAssignments(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.id as staff_id,
          s.name as staff_name,
          s.department,
          s.full_name,
          s.starting_date,
          s.birthday,
          s.status as staff_status,
          sa.id as assignment_id,
          u.id as uniform_id,
          u.type as uniform_type,
          u.size as uniform_size,
          u.color as uniform_color,
          sa.assigned_date,
          sa.returned_date,
          sa.status as assignment_status,
          sa.assigned_condition,
          sa.returned_condition,
          sa.quantity,
          sa.assigned_by,
          sa.vessel,
          sa.storage_location
        FROM staff s
        LEFT JOIN staff_assignments sa ON sa.staff_id = s.id
        LEFT JOIN uniforms u ON sa.uniform_id = u.id
        ORDER BY s.name, sa.assigned_date DESC
      `;
      this.db.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        // Group by staff
        const staffMap: { [key: number]: any } = {};
        rows.forEach(row => {
          if (!staffMap[row.staff_id]) {
            staffMap[row.staff_id] = {
              id: row.staff_id,
              name: row.staff_name,
              department: row.department,
              full_name: row.full_name,
              starting_date: row.starting_date,
              birthday: row.birthday,
              status: row.staff_status,
              assignments: []
            };
          }
          if (row.assignment_id) {
            staffMap[row.staff_id].assignments.push({
              assignment_id: row.assignment_id,
              staff_id: row.staff_id,
              uniform_id: row.uniform_id,
              uniform_type: row.uniform_type,
              uniform_size: row.uniform_size,
              uniform_color: row.uniform_color,
              assigned_date: row.assigned_date,
              returned_date: row.returned_date,
              status: row.assignment_status,
              assigned_condition: row.assigned_condition,
              returned_condition: row.returned_condition,
              quantity: row.quantity || 1,
              vessel: row.vessel || 'yin',
              storage_location: row.storage_location || 'Unspecified'
            });
          }
        });
        resolve(Object.values(staffMap));
      });
    });
  }
} 
