import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env.ts';

let dbInstance: Database.Database | null = null;

export function getDb(customPath?: string): Database.Database {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const targetPath = customPath || ENV.DATABASE_PATH;
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(targetPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

export function setDbForTesting(db: Database.Database) {
  dbInstance = db;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
