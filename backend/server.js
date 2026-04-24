const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDbAsync, getDb, queryAll, queryOne, run, generateDailyTasks } = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Children ─────────────────────────────────────────────────────────────────
app.get('/api/children', (req, res) => {
  const children = queryAll(
    'SELECT id, name, avatar, theme FROM children ORDER BY sort_order'
  );
  // sql.js returns snake_case columns; map to camelCase for API
  const result = children.map(c => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    theme: c.theme,
  }));
  res.json(result);
});

// ── Today's tasks for a child ────────────────────────────────────────────────
app.get('/api/children/:childId/today', (req, res) => {
  const { childId } = req.params;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Verify child exists
  const child = queryOne('SELECT id FROM children WHERE id = ?', [childId]);
  if (!child) {
    return res.status(404).json({ error: 'Child not found' });
  }

  // Check if daily tasks exist for today
  let tasks = queryAll(
    'SELECT * FROM daily_tasks WHERE child_id = ? AND date = ? ORDER BY sort_order',
    [childId, today]
  );

  // If no tasks for today, generate them
  if (tasks.length === 0) {
    generateDailyTasks(childId, today);
    tasks = queryAll(
      'SELECT * FROM daily_tasks WHERE child_id = ? AND date = ? ORDER BY sort_order',
      [childId, today]
    );
  }

  // Map snake_case → camelCase
  const result = tasks.map(t => ({
    id: t.id,
    childId: t.child_id,
    templateId: t.template_id,
    date: t.date,
    title: t.title,
    type: t.type,
    category: t.category,
    color: t.color,
    icon: t.icon,
    durationMinutes: t.duration_minutes,
    fixedStartMinutes: t.fixed_start_minutes,
    fixedEndMinutes: t.fixed_end_minutes,
    sortOrder: t.sort_order,
    completed: !!t.completed,
    completedAt: t.completed_at,
    overdue: !!t.overdue,
  }));

  res.json(result);
});

// ── Complete a task ──────────────────────────────────────────────────────────
app.post('/api/tasks/:taskId/complete', (req, res) => {
  const { taskId } = req.params;
  const now = new Date().toISOString();

  // Check task exists first
  const task = queryOne('SELECT id FROM daily_tasks WHERE id = ?', [taskId]);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  run(
    'UPDATE daily_tasks SET completed = 1, completed_at = ?, updated_at = ? WHERE id = ?',
    [now, now, taskId]
  );
  res.json({ success: true });
});

// ── Uncomplete a task ────────────────────────────────────────────────────────
app.post('/api/tasks/:taskId/uncomplete', (req, res) => {
  const { taskId } = req.params;
  const now = new Date().toISOString();

  // Check task exists first
  const task = queryOne('SELECT id FROM daily_tasks WHERE id = ?', [taskId]);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  run(
    'UPDATE daily_tasks SET completed = 0, completed_at = NULL, updated_at = ? WHERE id = ?',
    [now, taskId]
  );
  res.json({ success: true });
});

// ── Reset today's tasks for a child ─────────────────────────────────────────
app.post('/api/children/:childId/today/reset', (req, res) => {
  const { childId } = req.params;
  const today = new Date().toISOString().split('T')[0];

  const child = queryOne('SELECT id FROM children WHERE id = ?', [childId]);
  if (!child) {
    return res.status(404).json({ error: 'Child not found' });
  }

  generateDailyTasks(childId, today);
  res.json({ success: true });
});

// ── Reorder tasks for a child ─────────────────────────────────────────────────
app.post('/api/children/:childId/tasks/reorder', (req, res) => {
  const { childId } = req.params;
  const { taskIds } = req.body; // array of task IDs in new order

  if (!Array.isArray(taskIds)) {
    return res.status(400).json({ error: 'taskIds must be an array' });
  }

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  let updated = 0;
  for (let i = 0; i < taskIds.length; i++) {
    const info = run(
      'UPDATE daily_tasks SET sort_order = ?, updated_at = ? WHERE id = ? AND child_id = ? AND date = ?',
      [i, now, taskIds[i], childId, today]
    );
    if (info.changes > 0) updated++;
  }

  res.json({ success: true, updated });
});

// ── Static files (frontend) ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Start ────────────────────────────────────────────────────────────────────
async function start() {
  await initDbAsync();

  app.listen(PORT, () => {
    console.log(`[Server] children-time-pwa backend running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
