-- Cloudflare D1 Database Schema for DichTruyenPro / EDITHANGLOAT

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  genre TEXT,
  toneGuidance TEXT,
  model TEXT DEFAULT 'gemini-2.0-flash',
  characters TEXT DEFAULT '[]',
  terms TEXT DEFAULT '[]',
  pronounMatrix TEXT DEFAULT '[]',
  settings TEXT DEFAULT '{}',
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  title TEXT,
  chapterIndex INTEGER DEFAULT 0,
  originalText TEXT,
  translatedTitle TEXT,
  translatedText TEXT,
  status TEXT DEFAULT 'pending',
  summary TEXT,
  qaReport TEXT DEFAULT '{}',
  issues TEXT DEFAULT '[]',
  chineseCharCount INTEGER DEFAULT 0,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(projectId, chapterIndex);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);
