import Database from 'better-sqlite3';
import dotenv from 'dotenv';
dotenv.config();

const db = new Database(process.env.DATABASE_PATH || './data.db');

db.pragma('journal_mode = WAL');

// Tables
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS exercises(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- translation | speaking | writing | reading | listening | mock
  payload TEXT NOT NULL,
  score REAL,
  feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

// Seed demo user
const upsertDemo = db.prepare("INSERT OR IGNORE INTO users(username) VALUES(?)");
upsertDemo.run('demo');

export default db;
