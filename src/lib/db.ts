import Database from 'better-sqlite3'
import path from 'path'

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'aiya.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initDatabase()
  }
  return db
}

function initDatabase() {
  // 유저 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('child', 'parent')),
      parentId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 대화 기록 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      childId TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('child', 'ai')),
      text TEXT,
      audioUrl TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (childId) REFERENCES users(id)
    )
  `)

  // 부모 설정 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS parentSettings (
      id TEXT PRIMARY KEY,
      childId TEXT NOT NULL UNIQUE,
      dailyLimitMinutes INTEGER DEFAULT 60,
      allowedStartTime TEXT DEFAULT '09:00',
      allowedEndTime TEXT DEFAULT '20:00',
      blockedTopics TEXT,
      enabledCategories TEXT DEFAULT 'education,play,emotion,habits',
      voicePreference TEXT DEFAULT 'mom',
      enabled BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (childId) REFERENCES users(id)
    )
  `)
}

export default getDb
