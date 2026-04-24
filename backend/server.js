const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { getDb, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Default admin PIN
const DEFAULT_PIN = '123456';

// Simple session store (in-memory for MVP)
const sessions = {};

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize database
initDb();

// ============ ADMIN AUTH MIDDLEWARE ============

function adminAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || !sessions[sessionId]) {
    res.status(401).json({ error: '未授权，请先登录' });
    return;
  }
  req.session = sessions[sessionId];
  next();
}

// ============ ADMIN LOGIN ============

app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  
  if (pin !== DEFAULT_PIN) {
    res.status(401).json({ error: 'PIN 错误' });
    return;
  }
  
  // Generate simple session token
  const sessionId = crypto.randomBytes(16).toString('hex');
  sessions[sessionId] = {
    createdAt: Date.now()
  };
  
  res.json({ success: true, sessionId });
});

// ============ ADMIN LOGOUT ============

app.post('/api/admin/logout', adminAuth, (req, res) => {
  const sessionId = req.headers['x-session-id'];
  delete sessions[sessionId];
  res.json({ success: true });
});

// ============ ADMIN CHILDREN CRUD ============

// GET /api/admin/children - List all children
app.get('/api/admin/children', adminAuth, (req, res) => {
  const db = getDb();
  db.all("SELECT * FROM children ORDER BY sort_order", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// POST /api/admin/children - Create new child
app.post('/api/admin/children', adminAuth, (req, res) => {
  const { name, avatar, theme } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '孩子名称不能为空' });
    return;
  }
  
  const db = getDb();
  const id = `child_${Date.now()}`;
  const now = new Date().toISOString();
  
  // Get max sort_order
  db.get("SELECT MAX(sort_order) as maxOrder FROM children", (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const sortOrder = (row.maxOrder || 0) + 1;
    
    db.run(
      "INSERT INTO children (id, name, avatar, theme, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, avatar || '👦', theme || 'starry', sortOrder, now],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id, name, avatar: avatar || '👦', theme: theme || 'starry', sort_order: sortOrder, created_at: now });
      }
    );
  });
});

// PUT /api/admin/children/:childId - Update child
app.put('/api/admin/children/:childId', adminAuth, (req, res) => {
  const { childId } = req.params;
  const { name, avatar, theme, sort_order } = req.body;
  const now = new Date().toISOString();
  const db = getDb();
  
  const updates = [];
  const values = [];
  
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
  if (theme !== undefined) { updates.push('theme = ?'); values.push(theme); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
  
  if (updates.length === 0) {
    res.status(400).json({ error: '没有要更新的字段' });
    return;
  }
  
  values.push(childId);
  
  db.run(
    `UPDATE children SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '孩子不存在' });
        return;
      }
      res.json({ success: true });
    }
  );
});

// DELETE /api/admin/children/:childId - Delete child
app.delete('/api/admin/children/:childId', adminAuth, (req, res) => {
  const { childId } = req.params;
  const db = getDb();
  
  // Delete child's templates and daily_tasks first
  db.run("DELETE FROM daily_tasks WHERE child_id = ?", [childId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run("DELETE FROM task_templates WHERE child_id = ?", [childId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.run("DELETE FROM children WHERE id = ?", [childId], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: '孩子不存在' });
          return;
        }
        res.json({ success: true });
      });
    });
  });
});

// ============ ADMIN TASK TEMPLATES CRUD ============

// GET /api/admin/children/:childId/templates - Get templates for a child
app.get('/api/admin/children/:childId/templates', adminAuth, (req, res) => {
  const { childId } = req.params;
  const db = getDb();
  
  db.all(
    "SELECT * FROM task_templates WHERE child_id = ? ORDER BY sort_order",
    [childId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// POST /api/admin/children/:childId/templates - Create new template
app.post('/api/admin/children/:childId/templates', adminAuth, (req, res) => {
  const { childId } = req.params;
  const { title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes } = req.body;
  
  if (!title || !type) {
    res.status(400).json({ error: '任务名称和类型不能为空' });
    return;
  }
  
  if (type === 'flexible' && !duration_minutes) {
    res.status(400).json({ error: '弹性任务需要设置时长' });
    return;
  }
  
  if (type === 'fixed' && (!fixed_start_minutes || !fixed_end_minutes)) {
    res.status(400).json({ error: '固定任务需要设置开始和结束时间' });
    return;
  }
  
  const db = getDb();
  const id = `${childId}_${Date.now()}`;
  const now = new Date().toISOString();
  
  // Get max sort_order
  db.get("SELECT MAX(sort_order) as maxOrder FROM task_templates WHERE child_id = ?", [childId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const sortOrder = (row.maxOrder || 0) + 1;
    
    db.run(
      `INSERT INTO task_templates (id, child_id, title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, childId, title, type, category || 'general', color || '#4A90D9', icon || '📋', duration_minutes || null, fixed_start_minutes || null, fixed_end_minutes || null, sortOrder, now, now],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({
          id, child_id: childId, title, type, category: category || 'general',
          color: color || '#4A90D9', icon: icon || '📋',
          duration_minutes: duration_minutes || null,
          fixed_start_minutes: fixed_start_minutes || null,
          fixed_end_minutes: fixed_end_minutes || null,
          sort_order: sortOrder, enabled: 1, created_at: now, updated_at: now
        });
      }
    );
  });
});

// PUT /api/admin/templates/:templateId - Update template
app.put('/api/admin/templates/:templateId', adminAuth, (req, res) => {
  const { templateId } = req.params;
  const { title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, enabled } = req.body;
  const now = new Date().toISOString();
  const db = getDb();
  
  const updates = [];
  const values = [];
  
  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (type !== undefined) { updates.push('type = ?'); values.push(type); }
  if (category !== undefined) { updates.push('category = ?'); values.push(category); }
  if (color !== undefined) { updates.push('color = ?'); values.push(color); }
  if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
  if (duration_minutes !== undefined) { updates.push('duration_minutes = ?'); values.push(duration_minutes); }
  if (fixed_start_minutes !== undefined) { updates.push('fixed_start_minutes = ?'); values.push(fixed_start_minutes); }
  if (fixed_end_minutes !== undefined) { updates.push('fixed_end_minutes = ?'); values.push(fixed_end_minutes); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
  if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(templateId);
  
  db.run(
    `UPDATE task_templates SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '任务模板不存在' });
        return;
      }
      res.json({ success: true });
    }
  );
});

// DELETE /api/admin/templates/:templateId - Delete template
app.delete('/api/admin/templates/:templateId', adminAuth, (req, res) => {
  const { templateId } = req.params;
  const db = getDb();
  
  db.run("DELETE FROM task_templates WHERE id = ?", [templateId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '任务模板不存在' });
      return;
    }
    res.json({ success: true });
  });
});

// ============ CHILDREN API (existing) ============

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

// Start server
app.listen(PORT, () => {
  console.log(`Children Time PWA server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
