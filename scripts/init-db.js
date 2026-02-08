const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'data', 'aiya.db')

console.log(`데이터베이스 초기화: ${dbPath}`)

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

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

// 초기 사용자 데이터 삽입
db.exec(`
  INSERT OR IGNORE INTO users (id, name, role) VALUES
  ('default-child', '아이', 'child');
`)

// 초기 부모 설정 삽입
db.exec(`
  INSERT OR IGNORE INTO parentSettings (id, childId, dailyLimitMinutes, allowedStartTime, allowedEndTime)
  VALUES ('parent-default', 'default-child', 60, '09:00', '20:00');
`)

console.log('✅ 데이터베이스 초기화 완료')
db.close()
