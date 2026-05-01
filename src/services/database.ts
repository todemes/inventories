import sqlite3 from 'sqlite3';
import path from 'path';

let db: sqlite3.Database | null = null;

export interface DatabaseResult {
  lastID?: number;
  changes?: number;
}

export async function initializeDatabase(): Promise<void> {
  if (db) return;

  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || 'uniform_inventory.db');
    console.log('Database path:', dbPath);

    db = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('Error connecting to database:', err);
        reject(err);
        return;
      }

      console.log('Connected to the SQLite database.');
      try {
        await dbRun(`CREATE TABLE IF NOT EXISTS uniforms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          size TEXT NOT NULL,
          color TEXT NOT NULL,
          current_stock INTEGER NOT NULL DEFAULT 0
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS stock_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uniform_id INTEGER NOT NULL,
          quantity_change INTEGER NOT NULL,
          date TEXT NOT NULL,
          notes TEXT,
          FOREIGN KEY (uniform_id) REFERENCES uniforms(id)
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS stock_locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uniform_id INTEGER NOT NULL,
          vessel TEXT NOT NULL CHECK(vessel IN ('yin', 'yang')),
          storage_location TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (uniform_id) REFERENCES uniforms(id) ON DELETE CASCADE
        )`);
        await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_locations_unique
          ON stock_locations(uniform_id, vessel, lower(trim(storage_location)))`);

        await ensureColumn('stock_history', 'previous_quantity', 'INTEGER');
        await ensureColumn('stock_history', 'new_quantity', 'INTEGER');
        await ensureColumn('stock_history', 'reason', 'TEXT');
        await ensureColumn('stock_history', 'updated_by', 'TEXT');
        await ensureColumn('stock_history', 'vessel', 'TEXT');
        await ensureColumn('stock_history', 'storage_location', 'TEXT');
        await backfillStockLocations();
        await normalizeDefaultStorageLocations();

        await ensureColumn('staff', 'full_name', 'TEXT');
        await ensureColumn('staff', 'starting_date', 'TEXT');
        await ensureColumn('staff', 'birthday', 'TEXT');
        await ensureColumn('staff', 'status', "TEXT NOT NULL DEFAULT 'active'");

        await ensureColumn('staff_assignments', 'assigned_condition', "TEXT DEFAULT 'New'");
        await ensureColumn('staff_assignments', 'returned_condition', 'TEXT');
        await ensureColumn('staff_assignments', 'quantity', 'INTEGER NOT NULL DEFAULT 1');
        await ensureColumn('staff_assignments', 'assigned_by', 'TEXT');
        await ensureColumn('staff_assignments', 'vessel', "TEXT DEFAULT 'yin'");
        await ensureColumn('staff_assignments', 'storage_location', "TEXT DEFAULT 'Unspecified'");
        await ensureColumn('staff_assignments', 'notes', 'TEXT');

        // Ensure legacy rows have a default assigned condition
        try {
          await dbRun(`UPDATE staff_assignments SET assigned_condition = 'New' WHERE assigned_condition IS NULL OR assigned_condition = ''`);
        } catch (error: any) {
          if (!error.message?.includes('no such table')) {
            throw error;
          }
          console.warn('Skipping staff_assignments update: table not found.');
        }
        try {
          await dbRun(`UPDATE staff_assignments SET quantity = 1 WHERE quantity IS NULL OR quantity < 1`);
          await dbRun(`UPDATE staff_assignments SET vessel = 'yin' WHERE vessel IS NULL OR vessel = ''`);
          await dbRun(`UPDATE staff_assignments SET storage_location = 'Storage' WHERE storage_location IS NULL OR storage_location = '' OR lower(trim(storage_location)) = 'unspecified'`);
        } catch (error: any) {
          if (!error.message?.includes('no such table')) {
            throw error;
          }
          console.warn('Skipping staff_assignments quantity update: table not found.');
        }

        try {
          await dbRun(`UPDATE staff SET status = 'active' WHERE status IS NULL OR status = ''`);
        } catch (error: any) {
          if (!error.message?.includes('no such table')) {
            throw error;
          }
          console.warn('Skipping staff status update: table not found.');
        }
        resolve();
      } catch (migrationError) {
        console.error('Database migration error:', migrationError);
        reject(migrationError);
      }
    });
  });
}


async function backfillStockLocations(): Promise<void> {
  const existing = await dbGet<{ count: number }>('SELECT COUNT(*) as count FROM stock_locations');
  if ((existing?.count || 0) > 0) {
    return;
  }

  const uniforms = await dbAll<{ id: number; current_stock: number }>('SELECT id, current_stock FROM uniforms WHERE current_stock > 0');
  const timestamp = new Date().toISOString();
  for (const uniform of uniforms) {
    await dbRun(
      `INSERT INTO stock_locations (uniform_id, vessel, storage_location, quantity, updated_at)
       VALUES (?, 'yin', 'Unspecified', ?, ?)`,
      [uniform.id, uniform.current_stock || 0, timestamp]
    );
  }
}

async function normalizeDefaultStorageLocations(): Promise<void> {
  const legacyLocations = await dbAll<{ id: number; uniform_id: number; vessel: string; quantity: number }>(
    `SELECT id, uniform_id, vessel, quantity
     FROM stock_locations
     WHERE lower(trim(storage_location)) = 'unspecified'`
  );
  const timestamp = new Date().toISOString();

  for (const legacy of legacyLocations) {
    const storage = await dbGet<{ id: number; quantity: number }>(
      `SELECT id, quantity
       FROM stock_locations
       WHERE uniform_id = ? AND vessel = ? AND lower(trim(storage_location)) = 'storage'`,
      [legacy.uniform_id, legacy.vessel]
    );

    if (storage) {
      await dbRun(
        'UPDATE stock_locations SET quantity = ?, updated_at = ? WHERE id = ?',
        [Number(storage.quantity || 0) + Number(legacy.quantity || 0), timestamp, storage.id]
      );
      await dbRun('DELETE FROM stock_locations WHERE id = ?', [legacy.id]);
    } else {
      await dbRun(
        `UPDATE stock_locations
         SET storage_location = 'Storage', updated_at = ?
         WHERE id = ?`,
        [timestamp, legacy.id]
      );
    }
  }

  try {
    await dbRun(
      `UPDATE staff_assignments
       SET storage_location = 'Storage'
       WHERE storage_location IS NULL OR storage_location = '' OR lower(trim(storage_location)) = 'unspecified'`
    );
  } catch (error: any) {
    if (!error.message?.includes('no such table')) {
      throw error;
    }
  }
}

export function getDb(): sqlite3.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

// Promisified database methods
export async function dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export async function dbGet<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export async function dbRun(sql: string, params: any[] = []): Promise<DatabaseResult> {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = getDb();
  await dbRun('BEGIN TRANSACTION');
  try {
    const result = await fn();
    await dbRun('COMMIT');
    return result;
  } catch (err) {
    await dbRun('ROLLBACK');
    throw err;
  }
}

async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  try {
    const columns = await dbAll<{ name: string }>(`PRAGMA table_info(${table})`);
    const exists = columns.some(col => col.name === column);
    if (exists) {
      return;
    }
    await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error: any) {
    // Ignore missing table errors but surface anything else
    if (error && typeof error.message === 'string' && error.message.includes('no such table')) {
      console.warn(`Skipping column migration for missing table ${table}.`);
      return;
    }
    throw error;
  }
}
