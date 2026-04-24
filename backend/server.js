const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize database
initDb();

// ============ CHILDREN API ============

// GET /api/children - List all children
app.get('/api/children', (req, res) => {
  const db = getDb();
  db.all("SELECT * FROM children ORDER BY sort_order", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// GET /api/children/:childId/today - Get today's tasks for a child
app.get('/api/children/:childId/today', (req, res) => {
  const { childId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  const db = getDb();
  
  db.all(
    "SELECT * FROM daily_tasks WHERE child_id = ? AND date = ? ORDER BY sort_order",
    [childId, today],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      // Ensure we have tasks for today (seed if needed)
      if (rows.length === 0) {
        seedDailyTasks(db, childId, today, () => {
          db.all(
            "SELECT * FROM daily_tasks WHERE child_id = ? AND date = ? ORDER BY sort_order",
            [childId, today],
            (err2, rows2) => {
              if (err2) {
                res.status(500).json({ error: err2.message });
                return;
              }
              res.json(rows2);
            }
          );
        });
      } else {
        res.json(rows);
      }
    }
  );
});

// POST /api/tasks/:taskId/complete - Mark task as complete
app.post('/api/tasks/:taskId/complete', (req, res) => {
  const { taskId } = req.params;
  const completedAt = new Date().toISOString();
  const db = getDb();
  
  db.run(
    "UPDATE daily_tasks SET completed = 1, completed_at = ?, updated_at = ? WHERE id = ?",
    [completedAt, completedAt, taskId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.json({ success: true });
    }
  );
});

// POST /api/tasks/:taskId/uncomplete - Mark task as incomplete
app.post('/api/tasks/:taskId/uncomplete', (req, res) => {
  const { taskId } = req.params;
  const updatedAt = new Date().toISOString();
  const db = getDb();
  
  db.run(
    "UPDATE daily_tasks SET completed = 0, completed_at = NULL, updated_at = ? WHERE id = ?",
    [updatedAt, taskId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.json({ success: true });
    }
  );
});

// POST /api/children/:childId/today/reset - Reset today's tasks
app.post('/api/children/:childId/today/reset', (req, res) => {
  const { childId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  const updatedAt = new Date().toISOString();
  const db = getDb();
  
  db.run(
    "UPDATE daily_tasks SET completed = 0, completed_at = NULL, overdue = 0, updated_at = ? WHERE child_id = ? AND date = ?",
    [updatedAt, childId, today],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, reset: this.changes });
    }
  );
});

// POST /api/children/:childId/tasks/reorder - Reorder tasks
app.post('/api/children/:childId/tasks/reorder', (req, res) => {
  const { childId } = req.params;
  const { orderedIds } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const updatedAt = new Date().toISOString();
  
  if (!Array.isArray(orderedIds)) {
    res.status(400).json({ error: 'orderedIds must be an array' });
    return;
  }
  
  const db = getDb();
  let completed = 0;
  
  orderedIds.forEach((taskId, index) => {
    db.run(
      "UPDATE daily_tasks SET sort_order = ?, updated_at = ? WHERE id = ? AND child_id = ? AND date = ?",
      [index, updatedAt, taskId, childId, today],
      function(err) {
        if (!err && this.changes > 0) completed++;
        if (index === orderedIds.length - 1) {
          res.json({ success: true, reordered: completed });
        }
      }
    );
  });
});

// ============ HELPERS ============

function seedDailyTasks(db, childId, today, callback) {
  db.all(
    "SELECT * FROM task_templates WHERE child_id = ? AND enabled = 1 ORDER BY sort_order",
    [childId],
    (err, templates) => {
      if (err || templates.length === 0) {
        callback();
        return;
      }
      const now = new Date().toISOString();
      let count = 0;
      templates.forEach((tmpl, i) => {
        const taskId = `${tmpl.id}_${today}`;
        db.run(
          `INSERT INTO daily_tasks (id, child_id, template_id, date, title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, completed, completed_at, overdue, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, ?, ?)`,
          [taskId, childId, tmpl.id, today, tmpl.title, tmpl.type, tmpl.category, tmpl.color, tmpl.icon, tmpl.duration_minutes, tmpl.fixed_start_minutes, tmpl.fixed_end_minutes, i, now, now],
          (err2) => {
            count++;
            if (count === templates.length) {
              callback();
            }
          }
        );
      });
      if (templates.length === 0) callback();
    }
  );
}

// ============ ADMIN API (simplified) ============

app.post('/api/admin/login', (req, res) => {
  // Simplified auth for MVP
  res.json({ success: true, token: 'demo-token' });
});

app.get('/api/admin/children', (req, res) => {
  const db = getDb();
  db.all("SELECT * FROM children ORDER BY sort_order", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Children Time PWA server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
