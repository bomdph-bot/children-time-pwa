const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'children.db');

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

function initDb() {
  const db = getDb();
  
  db.exec(`
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
      updated_at TEXT NOT NULL,
      FOREIGN KEY (child_id) REFERENCES children(id)
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
      updated_at TEXT NOT NULL,
      FOREIGN KEY (child_id) REFERENCES children(id)
    );
  `);

  // Seed default data if empty
  const today = new Date().toISOString().split('T')[0];
  
  db.get("SELECT COUNT(*) as count FROM children", (err, row) => {
    if (row.count === 0) {
      const now = new Date().toISOString();
      const children = [
        { id: 'child_1', name: '大宝', avatar: '👦', theme: 'starry', sort_order: 0 },
        { id: 'child_2', name: '二宝', avatar: '👧', theme: 'starry', sort_order: 1 }
      ];
      
      children.forEach(c => {
        db.run(
          "INSERT INTO children (id, name, avatar, theme, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [c.id, c.name, c.avatar, c.theme, c.sort_order, now]
        );
      });

      const templates = [
        { child_id: 'child_1', title: '上学', type: 'fixed', category: 'school', color: '#4A90D9', icon: '🏫', duration_minutes: null, fixed_start_minutes: 8 * 60, fixed_end_minutes: 17.5 * 60, sort_order: 0 },
        { child_id: 'child_1', title: '写作业', type: 'flexible', category: 'study', color: '#7B68EE', icon: '✏️', duration_minutes: 60, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 1 },
        { child_id: 'child_1', title: '运动打卡', type: 'flexible', category: 'activity', color: '#32CD32', icon: '🏃', duration_minutes: 20, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 2 },
        { child_id: 'child_1', title: '收拾书包', type: 'flexible', category: 'life', color: '#FF8C00', icon: '🎒', duration_minutes: 10, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 3 },
        { child_id: 'child_1', title: '洗澡', type: 'flexible', category: 'life', color: '#00CED1', icon: '🚿', duration_minutes: 20, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 4 },
        { child_id: 'child_1', title: '刷牙洗脸', type: 'flexible', category: 'life', color: '#87CEEB', icon: '🪥', duration_minutes: 5, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 5 },
        { child_id: 'child_1', title: '阅读课外书', type: 'flexible', category: 'study', color: '#9370DB', icon: '📚', duration_minutes: 30, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 6 },
        { child_id: 'child_1', title: '背单词', type: 'flexible', category: 'study', color: '#FF69B4', icon: '🔤', duration_minutes: 20, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 7 },
        { child_id: 'child_2', title: '上幼儿园', type: 'fixed', category: 'school', color: '#FFB6C1', icon: '🏫', duration_minutes: null, fixed_start_minutes: 8 * 60, fixed_end_minutes: 17 * 60, sort_order: 0 },
        { child_id: 'child_2', title: '讲故事', type: 'flexible', category: 'activity', color: '#FFA500', icon: '📖', duration_minutes: 20, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 1 },
        { child_id: 'child_2', title: '玩玩具', type: 'flexible', category: 'activity', color: '#90EE90', icon: '🧸', duration_minutes: 30, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 2 },
        { child_id: 'child_2', title: '喝水吃水果', type: 'flexible', category: 'life', color: '#00FFFF', icon: '🍎', duration_minutes: 10, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 3 },
        { child_id: 'child_2', title: '刷牙', type: 'flexible', category: 'life', color: '#FF6347', icon: '🪥', duration_minutes: 5, fixed_start_minutes: null, fixed_end_minutes: null, sort_order: 4 },
      ];

      templates.forEach(t => {
        db.run(
          "INSERT INTO task_templates (id, child_id, title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
          [t.child_id + '_' + t.sort_order, t.child_id, t.title, t.type, t.category, t.color, t.icon, t.duration_minutes, t.fixed_start_minutes, t.fixed_end_minutes, t.sort_order, now, now]
        );
      });

      // Create daily tasks from templates
      db.all("SELECT * FROM task_templates", (err, allTemplates) => {
        allTemplates.forEach(tmpl => {
          db.run(
            "INSERT INTO daily_tasks (id, child_id, template_id, date, title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, completed, completed_at, overdue, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, ?, ?)",
            [tmpl.id + '_' + today, tmpl.child_id, tmpl.id, today, tmpl.title, tmpl.type, tmpl.category, tmpl.color, tmpl.icon, tmpl.duration_minutes, tmpl.fixed_start_minutes, tmpl.fixed_end_minutes, tmpl.sort_order, now, now]
          );
        });
      });
    }
  });

  return db;
}

module.exports = { getDb, initDb };
