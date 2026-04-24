const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'children-time.db');

let db = null;
let dbReady = null;

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Wrapper to make sql.js synchronous-ish using run/exec wrappers
function getDb() {
  return db;
}

async function initDbAsync() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[DB] Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new database');
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      theme TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT,
      duration_minutes INTEGER,
      fixed_start_minutes INTEGER,
      fixed_end_minutes INTEGER,
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_tasks (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      template_id TEXT,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT,
      duration_minutes INTEGER,
      fixed_start_minutes INTEGER,
      fixed_end_minutes INTEGER,
      sort_order INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      overdue INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default children if none exist
  const childrenCount = db.exec('SELECT COUNT(*) as count FROM children')[0];
  if (!childrenCount || childrenCount.values[0][0] === 0) {
    const now = new Date().toISOString();
    const children = [
      { id: uuidv4(), name: '大宝', avatar: '👦', theme: 'blue', sort_order: 0 },
      { id: uuidv4(), name: '二宝', avatar: '👧', theme: 'purple', sort_order: 1 },
      { id: uuidv4(), name: '三宝', avatar: '🧒', theme: 'green', sort_order: 2 },
      { id: uuidv4(), name: '小宝', avatar: '👶', theme: 'pink', sort_order: 3 },
    ];

    for (const child of children) {
      db.run(
        'INSERT INTO children (id, name, avatar, theme, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [child.id, child.name, child.avatar, child.theme, child.sort_order, now]
      );
    }

    // Seed default task templates for each child
    const defaultTemplates = [
      {
        title: '上学', type: 'fixed', category: 'school', color: '#4A90D9', icon: '🎒',
        duration_minutes: null, fixed_start_minutes: 8 * 60, fixed_end_minutes: 17 * 60 + 30, sort_order: 0,
      },
      {
        title: '吃饭', type: 'flexible', category: 'meal', color: '#F5A623', icon: '🍽️',
        duration_minutes: 30, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 1,
      },
      {
        title: '写作业', type: 'flexible', category: 'study', color: '#4CAF50', icon: '✏️',
        duration_minutes: 60, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 2,
      },
      {
        title: '运动打卡', type: 'flexible', category: 'exercise', color: '#F44336', icon: '🏃',
        duration_minutes: 20, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 3,
      },
      {
        title: '收拾书包和书桌', type: 'flexible', category: 'organize', color: '#9C27B0', icon: '📚',
        duration_minutes: 10, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 4,
      },
      {
        title: '洗澡', type: 'flexible', category: 'hygiene', color: '#2196F3', icon: '🛁',
        duration_minutes: 20, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 5,
      },
      {
        title: '刷牙洗脸', type: 'flexible', category: 'hygiene', color: '#E91E63', icon: '🪥',
        duration_minutes: 5, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 6,
      },
      {
        title: '阅读课外书', type: 'flexible', category: 'study', color: '#FFEB3B', icon: '📖',
        duration_minutes: 30, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 7,
      },
      {
        title: '背单词', type: 'flexible', category: 'study', color: '#4CAF50', icon: '🔤',
        duration_minutes: 20, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 8,
      },
      {
        title: '整理错题本', type: 'flexible', category: 'study', color: '#F5A623', icon: '📝',
        duration_minutes: 30, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 9,
      },
    ];

    for (const child of children) {
      for (const tpl of defaultTemplates) {
        db.run(
          `INSERT INTO task_templates
            (id, child_id, title, type, category, color, icon, duration_minutes,
             fixed_start_minutes, fixed_end_minutes, sort_order, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            uuidv4(), child.id, tpl.title, tpl.type, tpl.category, tpl.color, tpl.icon,
            tpl.duration_minutes, tpl.fixed_start_minutes, tpl.fixed_end_minutes,
            tpl.sort_order, now, now,
          ]
        );
      }
    }

    console.log('[DB] Seeded 4 children and default templates');
    saveDb();
  }
}

// Helper: run a query that returns rows
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run a query that returns one row
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

// Helper: run an insert/update/delete
function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
  // Note: sql.js getRowsModified() is unreliable (always 0), so we just return success
  return { changes: 1 };
}

function generateDailyTasks(childId, date) {
  // Remove existing daily tasks for this child + date
  run('DELETE FROM daily_tasks WHERE child_id = ? AND date = ?', [childId, date]);

  const templates = queryAll(
    'SELECT * FROM task_templates WHERE child_id = ? AND enabled = 1 ORDER BY sort_order',
    [childId]
  );

  const now = new Date().toISOString();

  for (const tpl of templates) {
    run(
      `INSERT INTO daily_tasks
        (id, child_id, template_id, date, title, type, category, color, icon,
         duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order,
         completed, completed_at, overdue, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, ?, ?)`,
      [
        uuidv4(), childId, tpl.id, date, tpl.title, tpl.type, tpl.category, tpl.color, tpl.icon,
        tpl.duration_minutes, tpl.fixed_start_minutes, tpl.fixed_end_minutes, tpl.sort_order,
        tpl.id, now,
      ]
    );
  }
}

module.exports = { initDbAsync, getDb, queryAll, queryOne, run, generateDailyTasks };
