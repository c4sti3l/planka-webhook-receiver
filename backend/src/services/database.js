import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

let db = null;

export function initDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS smtp_settings (
      id INTEGER PRIMARY KEY,
      host TEXT NOT NULL DEFAULT '',
      port INTEGER DEFAULT 587,
      secure INTEGER DEFAULT 0,
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      from_email TEXT NOT NULL DEFAULT '',
      from_name TEXT DEFAULT 'Planka Notifications'
    );

    CREATE TABLE IF NOT EXISTS recipients (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS event_filters (
      id INTEGER PRIMARY KEY,
      event_type TEXT NOT NULL UNIQUE,
      enabled INTEGER DEFAULT 1,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS digest_settings (
      id INTEGER PRIMARY KEY,
      interval_minutes INTEGER DEFAULT 15,
      last_sent_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS event_queue (
      id INTEGER PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recipient_projects (
      id INTEGER PRIMARY KEY,
      recipient_id INTEGER NOT NULL,
      project_id TEXT NOT NULL,
      project_name TEXT,
      FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE CASCADE,
      UNIQUE(recipient_id, project_id)
    );
  `);

  // Initialize default data if not exists
  initDefaults();

  return db;
}

function initDefaults() {
  // Create admin if not exists
  const admin = db.prepare('SELECT id FROM admin LIMIT 1').get();
  if (!admin) {
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(initialPassword, 10);
    db.prepare('INSERT INTO admin (password_hash) VALUES (?)').run(hash);
    console.log('Admin user created with initial password');
  }

  // Create default SMTP settings if not exists
  const smtp = db.prepare('SELECT id FROM smtp_settings LIMIT 1').get();
  if (!smtp) {
    db.prepare('INSERT INTO smtp_settings (host, from_email) VALUES (?, ?)').run('', '');
  }

  // Create default digest settings if not exists
  const digest = db.prepare('SELECT id FROM digest_settings LIMIT 1').get();
  if (!digest) {
    db.prepare('INSERT INTO digest_settings (interval_minutes) VALUES (?)').run(15);
  }

  // Initialize default event filters
  const defaultEvents = [
    { type: 'cardCreate', description: 'Card created', enabled: 1 },
    { type: 'cardUpdate', description: 'Card updated', enabled: 1 },
    { type: 'cardDelete', description: 'Card deleted', enabled: 1 },
    { type: 'cardMembershipCreate', description: 'Member added to card', enabled: 1 },
    { type: 'cardMembershipDelete', description: 'Member removed from card', enabled: 0 },
    { type: 'cardLabelCreate', description: 'Label added to card', enabled: 0 },
    { type: 'commentCreate', description: 'Comment added', enabled: 1 },
    { type: 'attachmentCreate', description: 'Attachment added', enabled: 0 },
    { type: 'listCreate', description: 'List created', enabled: 0 },
    { type: 'listUpdate', description: 'List updated', enabled: 0 },
    { type: 'listDelete', description: 'List deleted', enabled: 0 },
    { type: 'notificationCreate', description: 'Notification created', enabled: 0 },
    { type: 'notificationUpdate', description: 'Notification updated', enabled: 0 },
    { type: 'webhookUpdate', description: 'Webhook updated', enabled: 0 },
    { type: 'webhookDelete', description: 'Webhook deleted', enabled: 0 },
    { type: 'userUpdate', description: 'User updated', enabled: 0 },
  ];

  const insertFilter = db.prepare(`
    INSERT OR IGNORE INTO event_filters (event_type, description, enabled)
    VALUES (?, ?, ?)
  `);

  for (const event of defaultEvents) {
    insertFilter.run(event.type, event.description, event.enabled);
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
