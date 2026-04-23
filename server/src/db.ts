import Database from 'better-sqlite3'

let instance: Database.Database | null = null

export function initDb(path: string = './data/scheduler.db'): Database.Database {
  if (instance) {
    instance.close()
    instance = null
  }
  instance = new Database(path)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')

  instance.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wa_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('individual', 'group')),
      is_favorite INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL CHECK(content_type IN ('text', 'image', 'video', 'document')),
      text TEXT,
      media_id TEXT,
      scheduled_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
      error TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  return instance
}

export function getDb(): Database.Database {
  if (!instance) throw new Error('DB not initialized — call initDb() first')
  return instance
}
