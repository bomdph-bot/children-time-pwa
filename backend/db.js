/**
 * 数据库初始化、Schema、帮助函数
 * 使用 better-sqlite3 + SQLite
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'children_time.db');

// 本地日期 helper（避免 UTC 偏移导致日期错误）
function getTodayDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 备份旧数据库（如果存在）
if (fs.existsSync(DB_PATH)) {
  const backupPath = `${DB_PATH}.backup.${Date.now()}`;
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`[DB] 备份旧数据库到: ${backupPath}`);
}

// 连接数据库
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// =====================
// Schema 初始化
// =====================
function initSchema() {
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
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (template_id) REFERENCES task_templates(id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_tasks_child_date ON daily_tasks(child_id, date);
    CREATE INDEX IF NOT EXISTS idx_task_templates_child ON task_templates(child_id);
  `);
  console.log('[DB] Schema 初始化完成');
}

// =====================
// 默认数据初始化
// =====================
function initDefaultData() {
  const now = new Date().toISOString();

  // 检查是否已有孩子数据
  const existingChildren = db.prepare('SELECT COUNT(*) as count FROM children').get();
  if (existingChildren.count > 0) {
    console.log('[DB] 数据已存在，跳过默认数据初始化');
    return;
  }

  // 4 个孩子
  const children = [
    { id: 'child_1', name: '大宝', avatar: '🧒', theme: 'blue', sort_order: 0 },
    { id: 'child_2', name: '二宝', avatar: '👧', theme: 'pink', sort_order: 1 },
    { id: 'child_3', name: '三宝', avatar: '👧', theme: 'purple', sort_order: 2 },
    { id: 'child_4', name: '小宝', avatar: '👶', theme: 'green', sort_order: 3 },
  ];

  const insertChild = db.prepare(
    'INSERT INTO children (id, name, avatar, theme, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const child of children) {
    insertChild.run(child.id, child.name, child.avatar, child.theme, child.sort_order, now);
  }
  console.log('[DB] 4 个孩子初始化完成');

  // 默认任务模板
  const templates = [
    // 固定任务：上学
    { title: '上学', type: 'fixed', category: 'school', color: '#4A90D9', icon: '🏫', duration_minutes: null, fixed_start_minutes: 60, fixed_end_minutes: 630, sort_order: 0 },
    // 弹性任务
    { title: '吃饭', type: 'flexible', category: 'life', color: '#FF8C42', icon: '🍚', duration_minutes: 30, sort_order: 1 },
    { title: '写作业', type: 'flexible', category: 'study', color: '#5C7AEA', icon: '✏️', duration_minutes: 60, sort_order: 2 },
    { title: '运动打卡', type: 'flexible', category: 'health', color: '#2ECC71', icon: '🏃', duration_minutes: 20, sort_order: 3 },
    { title: '收拾书包和书桌', type: 'flexible', category: 'life', color: '#9B59B6', icon: '🎒', duration_minutes: 10, sort_order: 4 },
    { title: '洗澡', type: 'flexible', category: 'life', color: '#3498DB', icon: '🛁', duration_minutes: 20, sort_order: 5 },
    { title: '刷牙洗脸', type: 'flexible', category: 'life', color: '#E91E63', icon: '🪥', duration_minutes: 5, sort_order: 6 },
    { title: '阅读', type: 'flexible', category: 'study', color: '#8E44AD', icon: '📚', duration_minutes: 30, sort_order: 7 },
    { title: '背单词', type: 'flexible', category: 'study', color: '#16A085', icon: '🔤', duration_minutes: 20, sort_order: 8 },
    { title: '整理错题本', type: 'flexible', category: 'study', color: '#C0392B', icon: '📝', duration_minutes: 30, sort_order: 9 },
  ];

  const insertTemplate = db.prepare(`
    INSERT INTO task_templates (id, child_id, title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let templateIndex = 0;
  for (const child of children) {
    for (const tmpl of templates) {
      templateIndex++;
      insertTemplate.run(
        `tmpl_${child.id}_${templateIndex}`,
        child.id,
        tmpl.title,
        tmpl.type,
        tmpl.category,
        tmpl.color,
        tmpl.icon,
        tmpl.duration_minutes || null,
        tmpl.fixed_start_minutes || null,
        tmpl.fixed_end_minutes || null,
        tmpl.sort_order,
        1,
        now,
        now
      );
    }
  }
  console.log('[DB] 默认任务模板初始化完成');
}

// =====================
// 辅助函数
// =====================

/**
 * 生成今日任务（如果当天不存在）
 * @param {string} childId
 * @returns {Array} 今日任务列表
 */
function generateTodayTasks(childId) {
  const today = getTodayDate();
  const now = new Date().toISOString();

  // 检查是否已有今日任务
  const existing = db.prepare(
    'SELECT * FROM daily_tasks WHERE child_id = ? AND date = ?'
  ).all(childId, today);

  if (existing.length > 0) {
    return existing;
  }

  // 从模板生成
  const templates = db.prepare(
    'SELECT * FROM task_templates WHERE child_id = ? AND enabled = 1 ORDER BY sort_order'
  ).all(childId);

  const insertTask = db.prepare(`
    INSERT INTO daily_tasks (id, child_id, template_id, date, title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, completed, overdue, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tasks = [];
  const generateId = () => `task_${childId}_${today}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  for (const tmpl of templates) {
    const taskId = generateId();
    insertTask.run(
      taskId,
      childId,
      tmpl.id,
      today,
      tmpl.title,
      tmpl.type,
      tmpl.category,
      tmpl.color,
      tmpl.icon,
      tmpl.duration_minutes,
      tmpl.fixed_start_minutes,
      tmpl.fixed_end_minutes,
      tmpl.sort_order,
      0,
      0,
      now,
      now
    );
    tasks.push({
      id: taskId,
      child_id: childId,
      template_id: tmpl.id,
      date: today,
      title: tmpl.title,
      type: tmpl.type,
      category: tmpl.category,
      color: tmpl.color,
      icon: tmpl.icon,
      duration_minutes: tmpl.duration_minutes,
      fixed_start_minutes: tmpl.fixed_start_minutes,
      fixed_end_minutes: tmpl.fixed_end_minutes,
      sort_order: tmpl.sort_order,
      completed: 0,
      completed_at: null,
      overdue: 0,
      created_at: now,
      updated_at: now,
    });
  }

  return tasks;
}

/**
 * 根据当前时间计算任务的 overdue 状态
 * @param {Object} task
 * @returns {number} 1 表示 overdue，0 表示正常
 */
function calculateOverdue(task) {
  if (task.completed) return 0;

  const now = new Date();
  const today = getTodayDate();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 固定任务：根据固定时间判断
  if (task.type === 'fixed') {
    if (task.fixed_end_minutes && currentMinutes > task.fixed_end_minutes) {
      return 1;
    }
    return 0;
  }

  // 弹性任务：如果当前时间超过 21:00 则 overdue
  if (currentMinutes > 21 * 60) {
    return 1;
  }

  return 0;
}

/**
 * 初始化数据库
 */
function init() {
  initSchema();
  initDefaultData();
  console.log('[DB] 数据库初始化完成');
}

module.exports = {
  db,
  init,
  generateTodayTasks,
  calculateOverdue,
};