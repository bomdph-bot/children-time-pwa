// =============================================
// Children Time PWA - Frontend App
// =============================================

// ============ CONSTANTS ============
const DAY_START = 7 * 60;  // 07:00 in minutes
const DAY_END = 21 * 60;  // 21:00 in minutes
const TOTAL_MINUTES = DAY_END - DAY_START;

// ============ STATE ============
let currentChildId = null;
let children = [];
let tasks = [];
let nowInterval = null;

// ============ API BASE (Dynamic) ============
// Derive backend URL from current frontend host: replace frontend port with 3000
const API_BASE = window.location.origin.replace(/:\d+$/, ':3000');

console.log('API_BASE:', API_BASE);

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  initChildSelector();
  initResetButton();
  loadChildren();
  startTimeUpdate();
});

// ============ CHILD SELECTOR ============
function initChildSelector() {
  const selector = document.getElementById('childSelector');
  selector.addEventListener('click', (e) => {
    const btn = e.target.closest('.child-btn');
    if (!btn) return;
    
    const childId = btn.dataset.childId;
    if (childId === currentChildId) return;
    
    // Update UI
    selector.querySelectorAll('.child-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    
    // Load tasks for new child
    loadTodayTasks(childId);
  });
}

function selectChild(childId) {
  currentChildId = childId;
  const btns = document.querySelectorAll('.child-btn');
  btns.forEach(b => {
    b.classList.toggle('selected', b.dataset.childId === childId);
  });
}

// ============ RESET BUTTON ============
function initResetButton() {
  const resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', async () => {
    if (!currentChildId) return;
    if (!confirm('确定要重置今日任务吗？所有进度将清零。')) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/children/${currentChildId}/today/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        loadTodayTasks(currentChildId);
      }
    } catch (err) {
      console.error('Reset failed:', err);
      alert('重置失败，请稍后重试');
    }
  });
}

// ============ API CALLS ============

async function loadChildren() {
  try {
    const res = await fetch(`${API_BASE}/api/children`);
    if (!res.ok) throw new Error('Failed to load children');
    children = await res.json();
    
    if (children.length > 0) {
      // Auto-select first child
      selectChild(children[0].id);
      loadTodayTasks(children[0].id);
    }
    
    updateDateDisplay();
  } catch (err) {
    console.error('loadChildren error:', err);
    showError('无法加载孩子列表，请刷新重试');
  }
}

async function loadTodayTasks(childId) {
  if (!childId) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/children/${childId}/today`);
    if (!res.ok) throw new Error('Failed to load tasks');
    tasks = await res.json();
    
    renderAll();
  } catch (err) {
    console.error('loadTodayTasks error:', err);
    showError('无法加载任务列表，请刷新重试');
  }
}

async function completeTask(taskId) {
  try {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
      method: 'POST'
    });
    if (res.ok) {
      await loadTodayTasks(currentChildId);
    }
  } catch (err) {
    console.error('completeTask error:', err);
  }
}

async function uncompleteTask(taskId) {
  try {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}/uncomplete`, {
      method: 'POST'
    });
    if (res.ok) {
      await loadTodayTasks(currentChildId);
    }
  } catch (err) {
    console.error('uncompleteTask error:', err);
  }
}

async function reorderTasks(childId, orderedIds) {
  try {
    await fetch(`${API_BASE}/api/children/${childId}/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds })
    });
  } catch (err) {
    console.error('reorderTasks error:', err);
  }
}

// ============ RENDER ============

function renderAll() {
  const now = getNowMinutes();
  renderTasks(now);
  layoutTimebar(now);
  updateEncouragement(now);
}

function renderTasks(now) {
  const taskList = document.getElementById('taskList');
  const overdueList = document.getElementById('overdueTaskList');
  const overdueSection = document.getElementById('overdueSection');
  
  // Separate tasks
  const regularTasks = [];
  const overdueTasks = [];
  
  tasks.forEach(task => {
    if (task.type === 'flexible' && !task.completed && isTaskOverdue(task, now)) {
      overdueTasks.push(task);
    } else {
      regularTasks.push(task);
    }
  });
  
  taskList.innerHTML = regularTasks.map(t => buildTaskCard(t, now)).join('');
  overdueSection.style.display = overdueTasks.length > 0 ? 'block' : 'none';
  overdueList.innerHTML = overdueTasks.map(t => buildTaskCard(t, now, true)).join('');
  
  // Setup drag & drop for flexible tasks
  setupDragAndDrop();
}

function buildTaskCard(task, now, isOverdue = false) {
  const isComplete = task.completed == 1 || task.completed === true;
  const isFlexible = task.type === 'flexible';
  const pressure = isFlexible && !isComplete ? calculatePressure(task, now) : 0;
  
  const pressureClass = pressure >= 1.2 ? 'pressure-3' : pressure >= 1.0 ? 'pressure-2' : pressure >= 0.8 ? 'pressure-1' : '';
  const completedClass = isComplete ? 'completed-task' : '';
  const draggable = isFlexible && !isComplete ? 'draggable="true"' : '';
  
  let actionBtn = '';
  if (isOverdue) {
    actionBtn = `<button class="task-action overdue-action" data-task-id="${task.id}" data-action="overdue">⚠️</button>`;
  } else if (isComplete) {
    actionBtn = `<button class="task-action uncomplete-action" data-task-id="${task.id}" data-action="uncomplete">↩️</button>`;
  } else {
    actionBtn = `<button class="task-action complete-action" data-task-id="${task.id}" data-action="complete">✅</button>`;
  }
  
  const durationText = task.duration_minutes ? `${task.duration_minutes}分钟` : '';
  const completedBadge = isComplete ? '<span class="completed-badge">已完成</span>' : '';
  
  return `
    <div class="task-card ${pressureClass} ${completedClass}"
         data-task-id="${task.id}"
         data-sort-order="${task.sort_order}"
         ${draggable}>
      <div class="task-icon" style="background: ${task.color}20;">${task.icon || '📋'}</div>
      <div class="task-info">
        <div class="task-title">
          <span class="task-name">${task.title}</span>
          ${completedBadge}
        </div>
        <div class="task-meta">
          <span class="task-type-badge ${task.type}">${task.type === 'fixed' ? '固定' : '弹性'}</span>
          ${durationText ? `<span class="task-duration"><span class="task-duration-icon">⏱️</span>${durationText}</span>` : ''}
        </div>
      </div>
      ${actionBtn}
    </div>
  `;
}

// ============ TIME BAR LAYOUT ============

function layoutTimebar(now) {
  const timeBar = document.getElementById('timeBar');
  const timeConsumed = document.getElementById('timeConsumed');
  const freeTime = document.getElementById('freeTime');
  const tasksArea = document.getElementById('tasksArea');
  const indicator = document.getElementById('currentTimeIndicator');
  
  // Calculate consumed (elapsed) time
  const elapsedMinutes = Math.max(0, now - DAY_START);
  const consumedPercent = Math.min(100, (elapsedMinutes / TOTAL_MINUTES) * 100);
  
  // Time consumed bar (left portion)
  timeConsumed.style.width = `${consumedPercent}%`;
  
  // Flexible tasks that are not completed
  const flexibleTasks = tasks.filter(t => t.type === 'flexible' && !t.completed && !isTaskOverdue(t, now));
  const totalTaskMinutes = flexibleTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
  
  // Free time calculation
  const usedMinutes = elapsedMinutes + totalTaskMinutes;
  const freePercent = Math.max(0, ((TOTAL_MINUTES - usedMinutes) / TOTAL_MINUTES) * 100);
  
  // Free time area (middle glowing)
  if (freePercent > 0) {
    freeTime.style.left = `${consumedPercent}%`;
    freeTime.style.width = `${Math.min(freePercent, 100 - consumedPercent)}%`;
    freeTime.style.display = 'block';
  } else {
    freeTime.style.display = 'none';
  }
  
  // Tasks area (right portion, filled backwards)
  const tasksPercent = (totalTaskMinutes / TOTAL_MINUTES) * 100;
  const taskBlocks = flexibleTasks.map(t => {
    const widthPercent = (t.duration_minutes / TOTAL_MINUTES) * 100;
    return `<div class="task-block flexible-task" style="background: ${t.color}; width: ${Math.max(widthPercent * 2, 60)}px;">${t.title.substring(0, 2)}</div>`;
  }).join('');
  tasksArea.innerHTML = taskBlocks;
  
  // Current time indicator
  const indicatorPercent = (elapsedMinutes / TOTAL_MINUTES) * 100;
  indicator.style.left = `calc(${indicatorPercent}% - 1.5px)`;
}

function updateEncouragement(now) {
  const textEl = document.getElementById('encouragementText');
  
  const completedTasks = tasks.filter(t => t.completed);
  const totalTasks = tasks.filter(t => t.type === 'flexible').length;
  const completedCount = completedTasks.length;
  
  const remainingMinutes = DAY_END - now;
  const unfinishedTasks = tasks.filter(t => t.type === 'flexible' && !t.completed);
  const unfinishedMinutes = unfinishedTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
  const pressureRatio = unfinishedMinutes / Math.max(1, remainingMinutes);
  
  let text = '';
  
  if (unfinishedTasks.length === 0 && completedCount === totalTasks) {
    text = '🎉 太棒了！所有任务都完成啦！';
  } else if (pressureRatio > 1.2) {
    text = '🔥 有点紧张了！赶紧行动吧！';
  } else if (pressureRatio > 1.0) {
    text = '⏰ 时间有点紧，加油加油！';
  } else if (pressureRatio > 0.8) {
    text = '💪 还不错，保持节奏！';
  } else {
    text = '🌟 加油！合理安排时间，就能玩得更开心！';
  }
  
  textEl.textContent = text;
}

// ============ DRAG & DROP ============

let draggedTaskId = null;

function setupDragAndDrop() {
  const cards = document.querySelectorAll('.task-card[draggable="true"]');
  
  cards.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('dragenter', handleDragEnter);
    card.addEventListener('dragleave', handleDragLeave);
    card.addEventListener('drop', handleDrop);
  });
  
  // Task action buttons
  document.querySelectorAll('.task-action').forEach(btn => {
    btn.addEventListener('click', handleTaskAction);
  });
}

function handleDragStart(e) {
  draggedTaskId = e.target.dataset.taskId;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over'));
  draggedTaskId = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  const card = e.target.closest('.task-card');
  if (card && card.dataset.taskId !== draggedTaskId) {
    card.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  const card = e.target.closest('.task-card');
  if (card) card.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  const targetCard = e.target.closest('.task-card');
  if (!targetCard || targetCard.dataset.taskId === draggedTaskId) return;
  
  // Reorder tasks in DOM
  const allCards = [...document.querySelectorAll('.task-card[draggable="true"]')];
  const draggedCard = allCards.find(c => c.dataset.taskId === draggedTaskId);
  
  if (draggedCard && targetCard) {
    const draggedOrder = parseInt(draggedCard.dataset.sortOrder);
    const targetOrder = parseInt(targetCard.dataset.sortOrder);
    
    // Swap sort orders visually
    draggedCard.dataset.sortOrder = targetOrder;
    targetCard.dataset.sortOrder = draggedOrder;
    
    // Reorder in DOM
    const taskList = document.getElementById('taskList');
    const allFlexCards = [...taskList.querySelectorAll('.task-card')];
    const draggedIdx = allFlexCards.findIndex(c => c.dataset.taskId === draggedTaskId);
    const targetIdx = allFlexCards.findIndex(c => c.dataset.taskId === targetCard.dataset.taskId);
    
    if (draggedIdx !== -1 && targetIdx !== -1) {
      if (draggedIdx < targetIdx) {
        taskList.insertBefore(draggedCard, targetCard.nextSibling);
      } else {
        taskList.insertBefore(draggedCard, targetCard);
      }
    }
    
    // Update backend
    const orderedIds = [...taskList.querySelectorAll('.task-card')].map(c => c.dataset.taskId);
    reorderTasks(currentChildId, orderedIds);
  }
  
  targetCard.classList.remove('drag-over');
}

function handleTaskAction(e) {
  const btn = e.target.closest('.task-action');
  if (!btn) return;
  
  const taskId = btn.dataset.taskId;
  const action = btn.dataset.action;
  
  if (action === 'complete') {
    completeTask(taskId);
  } else if (action === 'uncomplete') {
    uncompleteTask(taskId);
  }
}

// ============ HELPERS ============

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isTaskOverdue(task, now) {
  if (task.type !== 'flexible' || task.completed) return false;
  // Calculate task end time (simplified: task starts at DAY_END and goes backwards)
  const unfinishedTasks = tasks.filter(t => t.type === 'flexible' && !t.completed);
  const taskIndex = unfinishedTasks.findIndex(t => t.id === task.id);
  
  let cursor = DAY_END;
  for (let i = unfinishedTasks.length - 1; i >= 0; i--) {
    const t = unfinishedTasks[i];
    const end = cursor;
    const start = cursor - (t.duration_minutes || 0);
    
    if (t.id === task.id) {
      return end <= now;
    }
    cursor = start;
  }
  return false;
}

function calculatePressure(task, now) {
  const unfinishedTasks = tasks.filter(t => t.type === 'flexible' && !t.completed);
  const remainingMinutes = DAY_END - now;
  const unfinishedMinutes = unfinishedTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
  return unfinishedMinutes / Math.max(1, remainingMinutes);
}

function updateDateDisplay() {
  const el = document.getElementById('dateDisplay');
  const now = new Date();
  el.textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]}`;
}

function startTimeUpdate() {
  // Update every minute
  if (nowInterval) clearInterval(nowInterval);
  nowInterval = setInterval(() => {
    if (currentChildId) {
      const now = getNowMinutes();
      renderAll();
    }
  }, 60000);
}

function showError(msg) {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = `<div class="loading">${msg}</div>`;
}
