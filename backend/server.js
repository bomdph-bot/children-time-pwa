/**
 * 后端服务入口
 * Node.js + Express + better-sqlite3
 */

const express = require('express');
const cors = require('cors');
const dbModule = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化数据库
dbModule.init();

// 中间件
app.use(cors({
  origin: (origin, callback) => {
    // 允许同源（前后端同端口部署时 origin 为 undefined）
    if (!origin) return callback(null, true);
    // 允许所有 localhost 变体
    if (/^https?:\/\/(localhost|127\.0\.0\.1|0{0,2}1::1?):\d+$/.test(origin)) {
      return callback(null, true);
    }
    // 允许所有局域网 IP（192.168.x.x, 10.x.x.x, 172.16-31.x.x）
    if (/^https?:\/\/(192\.168\.|10\.|172\.\d{1,3}\.)\d+\.\d+/.test(origin)) {
      return callback(null, true);
    }
    // 其他 origin 拒绝（生产环境可进一步放开）
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());

// 静态文件服务（前端）
app.use(express.static('frontend'));

// =====================
// API 路由
// =====================

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取所有孩子
app.get('/api/children', (req, res) => {
  try {
    const children = dbModule.db.prepare('SELECT * FROM children ORDER BY sort_order').all();
    res.json(children);
  } catch (err) {
    console.error('[API] GET /api/children error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 获取某个孩子今天的任务
app.get('/api/children/:childId/today', (req, res) => {
  try {
    const { childId } = req.params;

    // 检查孩子是否存在
    const child = dbModule.db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // 生成或获取今日任务
    const tasks = dbModule.generateTodayTasks(childId);

    // 更新每个任务的 overdue 状态
    const updatedTasks = tasks.map(task => {
      const overdue = dbModule.calculateOverdue(task);
      if (task.overdue !== overdue) {
        dbModule.db.prepare('UPDATE daily_tasks SET overdue = ? WHERE id = ?').run(overdue, task.id);
        task.overdue = overdue;
      }
      return task;
    });

    res.json(updatedTasks);
  } catch (err) {
    console.error('[API] GET /api/children/:childId/today error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 完成某个任务
app.post('/api/tasks/:taskId/complete', (req, res) => {
  try {
    const { taskId } = req.params;

    const task = dbModule.db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const now = new Date().toISOString();
    const overdue = dbModule.calculateOverdue(task);

    dbModule.db.prepare(`
      UPDATE daily_tasks SET completed = 1, completed_at = ?, overdue = ?, updated_at = ? WHERE id = ?
    `).run(now, overdue, now, taskId);

    const updatedTask = dbModule.db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(taskId);
    res.json(updatedTask);
  } catch (err) {
    console.error('[API] POST /api/tasks/:taskId/complete error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 取消完成某个任务
app.post('/api/tasks/:taskId/uncomplete', (req, res) => {
  try {
    const { taskId } = req.params;

    const task = dbModule.db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const now = new Date().toISOString();

    dbModule.db.prepare(`
      UPDATE daily_tasks SET completed = 0, completed_at = NULL, overdue = 0, updated_at = ? WHERE id = ?
    `).run(now, taskId);

    const updatedTask = dbModule.db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(taskId);
    res.json(updatedTask);
  } catch (err) {
    console.error('[API] POST /api/tasks/:taskId/uncomplete error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 重置某个孩子今天的任务
app.post('/api/children/:childId/today/reset', (req, res) => {
  try {
    const { childId } = req.params;
    const today = dbModule.getTodayDate();

    // 检查孩子是否存在
    const child = dbModule.db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // 删除该孩子今天的所有任务
    dbModule.db.prepare('DELETE FROM daily_tasks WHERE child_id = ? AND date = ?').run(childId, today);

    // 重新生成
    const tasks = dbModule.generateTodayTasks(childId);

    res.json(tasks);
  } catch (err) {
    console.error('[API] POST /api/children/:childId/today/reset error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 重新排序任务
app.post('/api/children/:childId/tasks/reorder', (req, res) => {
  try {
    const { childId } = req.params;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds must be an array' });
    }

    // 检查孩子是否存在
    const child = dbModule.db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // 更新每个任务的 sort_order
    const updateStmt = dbModule.db.prepare('UPDATE daily_tasks SET sort_order = ?, updated_at = ? WHERE id = ? AND child_id = ?');
    const now = new Date().toISOString();

    const transaction = dbModule.db.transaction(() => {
      taskIds.forEach((taskId, index) => {
        updateStmt.run(index, now, taskId, childId);
      });
    });

    transaction();

    // 返回更新后的任务
    const today = dbModule.getTodayDate();
    const tasks = dbModule.db.prepare(
      'SELECT * FROM daily_tasks WHERE child_id = ? AND date = ? ORDER BY sort_order'
    ).all(childId, today);

    res.json(tasks);
  } catch (err) {
    console.error('[API] POST /api/children/:childId/tasks/reorder error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// =====================
// PIN 验证中间件（简单验证，hardcode PIN=1234）
// =====================
const ADMIN_PIN = '1234';

// 简单验证：header 中带 X-Admin-Pin: 1234 即通过
function adminAuth(req, res, next) {
  const pin = req.headers['x-admin-pin'];
  if (pin === ADMIN_PIN) {
    next();
  } else {
    res.status(401).json({ error: '未授权，请先登录' });
  }
}

// =====================
// 家长后台 API
// =====================

// PIN 登录
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) {
    res.json({ success: true, message: '登录成功' });
  } else {
    res.status(401).json({ success: false, error: 'PIN 错误' });
  }
});

// 获取孩子列表（需认证）
app.get('/api/admin/children', adminAuth, (req, res) => {
  try {
    const children = dbModule.db.prepare('SELECT * FROM children ORDER BY sort_order').all();
    res.json(children);
  } catch (err) {
    console.error('[API] GET /api/admin/children error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 新增孩子（需认证）
app.post('/api/admin/children', adminAuth, (req, res) => {
  try {
    const { name, avatar, theme } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name 是必填项' });
    }
    const now = new Date().toISOString();
    const maxOrder = dbModule.db.prepare('SELECT MAX(sort_order) as max_order FROM children').get();
    const sortOrder = (maxOrder.max_order || 0) + 1;
    const id = `child_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    dbModule.db.prepare(
      'INSERT INTO children (id, name, avatar, theme, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, avatar || '🧒', theme || 'blue', sortOrder, now);
    const child = dbModule.db.prepare('SELECT * FROM children WHERE id = ?').get(id);
    res.status(201).json(child);
  } catch (err) {
    console.error('[API] POST /api/admin/children error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 更新孩子（需认证）
app.put('/api/admin/children/:childId', adminAuth, (req, res) => {
  try {
    const { childId } = req.params;
    const { name, avatar, theme } = req.body;
    const child = dbModule.db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    if (!child) {
      return res.status(404).json({ error: '孩子不存在' });
    }
    const now = new Date().toISOString();
    dbModule.db.prepare(
      'UPDATE children SET name = COALESCE(NULLIF(?, \'\'), name), avatar = COALESCE(NULLIF(?, \'\'), avatar), theme = COALESCE(NULLIF(?, \'\'), theme), updated_at = ? WHERE id = ?'
    ).run(name || '', avatar || '', theme || '', now, childId);
    const updated = dbModule.db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    res.json(updated);
  } catch (err) {
    console.error('[API] PUT /api/admin/children/:childId error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 删除孩子（需认证）
app.delete('/api/admin/children/:childId', adminAuth, (req, res) => {
  try {
    const { childId } = req.params;
    const child = dbModule.db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    if (!child) {
      return res.status(404).json({ error: '孩子不存在' });
    }
    // 删除关联的任务模板和每日任务
    dbModule.db.prepare('DELETE FROM daily_tasks WHERE child_id = ?').run(childId);
    dbModule.db.prepare('DELETE FROM task_templates WHERE child_id = ?').run(childId);
    dbModule.db.prepare('DELETE FROM children WHERE id = ?').run(childId);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[API] DELETE /api/admin/children/:childId error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 获取某个孩子的任务模板列表（需认证）
app.get('/api/admin/children/:childId/templates', adminAuth, (req, res) => {
  try {
    const { childId } = req.params;
    const child = dbModule.db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    if (!child) {
      return res.status(404).json({ error: '孩子不存在' });
    }
    const templates = dbModule.db.prepare(
      'SELECT * FROM task_templates WHERE child_id = ? ORDER BY sort_order'
    ).all(childId);
    res.json(templates);
  } catch (err) {
    console.error('[API] GET /api/admin/children/:childId/templates error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 新增任务模板（需认证）
app.post('/api/admin/children/:childId/templates', adminAuth, (req, res) => {
  try {
    const { childId } = req.params;
    const child = dbModule.db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    if (!child) {
      return res.status(404).json({ error: '孩子不存在' });
    }
    const { title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order } = req.body;
    if (!title || !type) {
      return res.status(400).json({ error: 'title 和 type 是必填项' });
    }
    const now = new Date().toISOString();
    const maxOrder = dbModule.db.prepare('SELECT MAX(sort_order) as max_order FROM task_templates WHERE child_id = ?').get(childId);
    const order = sort_order !== undefined ? sort_order : (maxOrder.max_order || 0) + 1;
    const id = `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    dbModule.db.prepare(`
      INSERT INTO task_templates (id, child_id, title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, childId, title, type, category || 'life', color || '#4A90D9', icon || '📋', duration_minutes || null, fixed_start_minutes || null, fixed_end_minutes || null, order, 1, now, now);
    const template = dbModule.db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id);
    res.status(201).json(template);
  } catch (err) {
    console.error('[API] POST /api/admin/children/:childId/templates error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 更新任务模板（需认证）
app.put('/api/admin/templates/:templateId', adminAuth, (req, res) => {
  try {
    const { templateId } = req.params;
    const template = dbModule.db.prepare('SELECT * FROM task_templates WHERE id = ?').get(templateId);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }
    const { title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, enabled } = req.body;
    const now = new Date().toISOString();
    const enabledInt = enabled ? 1 : 0;
    dbModule.db.prepare(`
      UPDATE task_templates SET
        title = COALESCE(NULLIF(?, ''), title),
        type = COALESCE(NULLIF(?, ''), type),
        category = COALESCE(NULLIF(?, ''), category),
        color = COALESCE(NULLIF(?, ''), color),
        icon = COALESCE(NULLIF(?, ''), icon),
        duration_minutes = ?,
        fixed_start_minutes = ?,
        fixed_end_minutes = ?,
        sort_order = ?,
        enabled = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      title !== undefined ? title : '',
      type !== undefined ? type : '',
      category !== undefined ? category : '',
      color !== undefined ? color : '',
      icon !== undefined ? icon : '',
      duration_minutes !== undefined ? duration_minutes : template.duration_minutes,
      fixed_start_minutes !== undefined ? fixed_start_minutes : template.fixed_start_minutes,
      fixed_end_minutes !== undefined ? fixed_end_minutes : template.fixed_end_minutes,
      sort_order !== undefined ? sort_order : template.sort_order,
      enabled !== undefined ? enabledInt : template.enabled,
      now,
      templateId
    );
    const updated = dbModule.db.prepare('SELECT * FROM task_templates WHERE id = ?').get(templateId);
    res.json(updated);
  } catch (err) {
    console.error('[API] PUT /api/admin/templates/:templateId error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 删除任务模板（需认证）
app.delete('/api/admin/templates/:templateId', adminAuth, (req, res) => {
  try {
    const { templateId } = req.params;
    const template = dbModule.db.prepare('SELECT * FROM task_templates WHERE id = ?').get(templateId);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }
    dbModule.db.prepare('DELETE FROM task_templates WHERE id = ?').run(templateId);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[API] DELETE /api/admin/templates/:templateId error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// =====================
// 启动服务
// =====================

app.listen(PORT, () => {
  console.log(`[Server] 运行在 http://localhost:${PORT}`);
  console.log(`[Server] 前端静态文件: frontend/`);
});

module.exports = app;