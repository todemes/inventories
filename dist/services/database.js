"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
exports.getDb = getDb;
exports.dbAll = dbAll;
exports.dbGet = dbGet;
exports.dbRun = dbRun;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
let db = null;
async function initializeDatabase() {
    if (db)
        return;
    return new Promise((resolve, reject) => {
        const dbPath = path_1.default.resolve(process.cwd(), 'uniform_inventory.db');
        console.log('Database path:', dbPath);
        db = new sqlite3_1.default.Database(dbPath, (err) => {
            if (err) {
                console.error('Error connecting to database:', err);
                reject(err);
                return;
            }
            console.log('Connected to the SQLite database.');
            // Create tables if they don't exist
            db.serialize(() => {
                // Uniforms table
                db.run(`CREATE TABLE IF NOT EXISTS uniforms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          size TEXT NOT NULL,
          color TEXT NOT NULL,
          current_stock INTEGER NOT NULL DEFAULT 0
        )`);
                // Stock history table
                db.run(`CREATE TABLE IF NOT EXISTS stock_history (
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
    });
}
function getDb() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}
// Promisified database methods
async function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
}
async function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
}
async function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
async function withTransaction(fn) {
    const db = getDb();
    await dbRun('BEGIN TRANSACTION');
    try {
        const result = await fn();
        await dbRun('COMMIT');
        return result;
    }
    catch (err) {
        await dbRun('ROLLBACK');
        throw err;
    }
}
