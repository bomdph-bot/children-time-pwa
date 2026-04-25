/**
 * 后端服务入口
 * Node.js + Express + better-sqlite3
 */

const express = require('express');
const dbModule = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化数据库
dbModule.init();

// 中间件
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
    const today = new Date().toISOString().split('T')[0];

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
    const today = new Date().toISOString().split('T')[0];
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
// 启动服务
// =====================

app.listen(PORT, () => {
  console.log(`[Server] 运行在 http://localhost:${PORT}`);
  console.log(`[Server] 前端静态文件: frontend/`);
});

module.exports = app;