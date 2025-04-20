import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

let db: sqlite3.Database | null = null;

export interface DatabaseResult {
  lastID?: number;
  changes?: number;
}

export async function initializeDatabase(): Promise<void> {
  if (db) return;

  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(process.cwd(), 'uniform_inventory.db');
    console.log('Database path:', dbPath);

    // Check if we're in production (Vercel)
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      console.log('Running in production mode - database will be read-only');
      // In production, we'll use a read-only connection
      db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('Error connecting to database:', err);
          reject(err);
          return;
        }
        console.log('Connected to the SQLite database in read-only mode.');
        resolve();
      });
    } else {
      // In development, we'll use a read-write connection
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error connecting to database:', err);
          reject(err);
          return;
        }
        console.log('Connected to the SQLite database in read-write mode.');
        
        // Create tables if they don't exist
        db!.serialize(() => {
          // Uniforms table
          db!.run(`CREATE TABLE IF NOT EXISTS uniforms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            size TEXT NOT NULL,
            color TEXT NOT NULL,
            current_stock INTEGER NOT NULL DEFAULT 0
          )`);

          // Stock history table
          db!.run(`CREATE TABLE IF NOT EXISTS stock_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uniform_id INTEGER NOT NULL,
            quantity_change INTEGER NOT NULL,
            date TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (uniform_id) REFERENCES uniforms(id)
          )`);

          resolve();
        });
      });
    }
  });
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
    // Check if we're in production
    if (process.env.NODE_ENV === 'production') {
      reject(new Error('Database is in read-only mode in production. Please use a different database solution for production environments.'));
      return;
    }
    
    getDb().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
} 