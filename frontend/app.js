/**
 * 儿童时间小管家 - 前端逻辑
 * MVP: 任务完成、超时下沉与紧迫视觉反馈
 */

// ============================================
// 常量
// ============================================
const DAY_START = 7 * 60;   // 07:00 = 420
const DAY_END = 21 * 60;    // 21:00 = 1260
const TOTAL_MINUTES = DAY_END - DAY_START; // 840

// ============================================
// 状态
// ============================================
const state = {
  currentMinutes: DAY_START, // 模拟当前时间（分钟从0点算）
  simSpeed: 1,                // 1 = 正常速（每2秒走1分钟），20 = 快速（每100ms走1分钟）
  simRunning: false,
  simIntervalId: null,
  completedCount: 0,

  // 当前 child
  currentChild: {
    id: 'child-1',
    name: '小美',
    avatar: '👧',
  },

  // 今日任务列表
  tasks: [
    // 固定任务
    {
      id: 'fixed-1',
      title: '上学',
      type: 'fixed',
      category: 'school',
      icon: '🏫',
      color: '#6c5ce7',
      fixedStartMinutes: 8 * 60,   // 08:00
      fixedEndMinutes: 17 * 60 + 30, // 17:30
      durationMinutes: 570,
      completed: false,
      overdue: false,
    },
    // 弹性任务
    {
      id: 'flex-1',
      title: '写作业',
      type: 'flexible',
      category: 'study',
      icon: '📝',
      color: '#0984e3',
      durationMinutes: 60,
      sortOrder: 1,
      completed: false,
      overdue: false,
    },
    {
      id: 'flex-2',
      title: '运动打卡',
      type: 'flexible',
      category: 'exercise',
      icon: '🏃',
      color: '#00b894',
      durationMinutes: 20,
      sortOrder: 2,
      completed: false,
      overdue: false,
    },
    {
      id: 'flex-3',
      title: '吃饭',
      type: 'flexible',
      category: 'life',
      icon: '🍽️',
      color: '#e17055',
      durationMinutes: 30,
      sortOrder: 3,
      completed: false,
      overdue: false,
    },
    {
      id: 'flex-4',
      title: '洗澡',
      type: 'flexible',
      category: 'life',
      icon: '🛁',
      color: '#74b9ff',
      durationMinutes: 20,
      sortOrder: 4,
      completed: false,
      overdue: false,
    },
    {
      id: 'flex-5',
      title: '阅读',
      type: 'flexible',
      category: 'study',
      icon: '📚',
      color: '#a29bfe',
      durationMinutes: 30,
      sortOrder: 5,
      completed: false,
      overdue: false,
    },
    {
      id: 'flex-6',
      title: '收拾书包',
      type: 'flexible',
      category: 'life',
      icon: '🎒',
      color: '#fdcb6e',
      durationMinutes: 10,
      sortOrder: 6,
      completed: false,
      overdue: false,
    },
  ],
};

// ============================================
// 辅助函数
// ============================================
function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatMinutes(minutes) {
  if (minutes <= 0) return '0分钟';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}小时${m}分钟`;
  if (h > 0) return `${h}小时`;
  return `${m}分钟`;
}

function getDateStr() {
  const now = new Date();
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const days = ['周日','周一','周二','周三','周四','周五','周六'];
  return `${months[now.getMonth()]}${now.getDate()}日 ${days[now.getDay()]}`;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// 分钟 → 时间条横坐标百分比
function minutesToPercent(minutes) {
  return clamp((minutes - DAY_START) / TOTAL_MINUTES * 100, 0, 100);
}

// ============================================
// 紧迫等级计算
// ============================================
function getUrgencyLevel(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.completed || task.overdue || task.type === 'fixed') return 'normal';

  const now = state.currentMinutes;

  // 已过时间不算紧迫
  if (task._layoutEnd <= now) return 'normal';

  const remainingMinutes = DAY_END - now;
  const unfinishedTasks = state.tasks.filter(
    t => t.type === 'flexible' && !t.completed && !t.overdue
  );
  const unfinishedTotalMinutes = unfinishedTasks.reduce((sum, t) => sum + t.durationMinutes, 0);

  // 没有未完成任务，不紧迫
  if (unfinishedTotalMinutes === 0) return 'normal';

  // 计算比率：未完成总时长 / 剩余可用时间
  const ratio = unfinishedTotalMinutes / Math.max(1, remainingMinutes);

  if (ratio <= 0.8) return 'normal';
  if (ratio <= 1.0) return 'light';
  if (ratio <= 1.2) return 'urgent';
  return 'critical';
}

// ============================================
// 核心布局算法
// ============================================
function layoutTimebar() {
  const now = state.currentMinutes;
  const fixedTasks = state.tasks.filter(t => t.type === 'fixed' && !t.completed && !t.overdue);
  const unfinishedFlex = state.tasks.filter(
    t => t.type === 'flexible' && !t.completed && !t.overdue
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  const blocks = [];

  // 1. 固定任务：从左到右排列
  fixedTasks.forEach(task => {
    const startPct = minutesToPercent(task.fixedStartMinutes);
    const endPct = minutesToPercent(task.fixedEndMinutes);
    blocks.push({
      id: task.id,
      task,
      kind: 'fixed',
      leftPct: startPct,
      widthPct: Math.max(0, endPct - startPct),
    });
  });

  // 2. 弹性任务：从21:00往左倒排
  let cursor = DAY_END;
  for (let i = unfinishedFlex.length - 1; i >= 0; i--) {
    const task = unfinishedFlex[i];
    const end = cursor;
    const start = end - task.durationMinutes;
    const squeezed = start < now;
    const visibleStart = Math.max(start, now);
    const visibleDuration = Math.max(0, end - visibleStart);

    const block = {
      id: task.id,
      task,
      kind: 'flexible',
      leftPct: minutesToPercent(start),
      widthPct: minutesToPercent(end) - minutesToPercent(start),
      visibleLeftPct: minutesToPercent(visibleStart),
      visibleWidthPct: minutesToPercent(end) - minutesToPercent(visibleStart),
      squeezed,
      end,
    };

    // 记录布局信息到 task 对象（供紧迫计算用）
    task._layoutStart = start;
    task._layoutEnd = end;
    blocks.push(block);
    cursor = start;
  }

  // 3. 自由时间：从 now 到最左侧弹性任务的起点
  const lastFlexEnd = cursor;
  const freeStart = Math.max(now, DAY_START);
  const freeEnd = lastFlexEnd;
  if (freeEnd > freeStart) {
    blocks.push({
      kind: 'free',
      leftPct: minutesToPercent(freeStart),
      widthPct: minutesToPercent(freeEnd) - minutesToPercent(freeStart),
      freeMinutes: freeEnd - freeStart,
    });
  }

  return blocks;
}

// ============================================
// 渲染时间条
// ============================================
function renderTimebar() {
  const blocks = layoutTimebar();
  const taskRow = document.getElementById('task-row');
  const overdueTasksEl = document.getElementById('overdue-tasks');
  const overdueZone = document.getElementById('overdue-zone');
  const rewardZone = document.getElementById('reward-zone');

  taskRow.innerHTML = '';

  const now = state.currentMinutes;

  // 计算自由时间
  const unfinishedFlex = state.tasks.filter(
    t => t.type === 'flexible' && !t.completed && !t.overdue
  );
  const totalUnfinishedMinutes = unfinishedFlex.reduce((sum, t) => sum + t.durationMinutes, 0);
  const remainingMinutes = DAY_END - now;
  const freeTimeMinutes = Math.max(0, remainingMinutes - totalUnfinishedMinutes);

  // 更新自由时间显示
  const freeTimeEl = document.getElementById('free-time-value');
  freeTimeEl.textContent = formatMinutes(freeTimeMinutes);
  freeTimeEl.style.color = freeTimeMinutes > 0 ? 'var(--free-blue)' : 'var(--urgency-critical)';

  // 进度统计
  const completedTasks = state.tasks.filter(t => t.completed);
  const overdueTasks = state.tasks.filter(t => t.overdue);
  document.getElementById('completed-count').textContent = completedTasks.length;
  document.getElementById('remaining-count').textContent = unfinishedFlex.length;
  document.getElementById('overdue-count').textContent = overdueTasks.length;

  // 渲染各 block
  blocks.forEach(block => {
    if (block.kind === 'free') {
      const el = document.createElement('div');
      el.className = 'free-block';
      el.style.left = block.leftPct + '%';
      el.style.width = block.widthPct + '%';
      el.innerHTML = `
        <span class="free-block-label">✨ 自由时间</span>
        <span class="free-block-time">${formatMinutes(block.freeMinutes)}</span>
      `;
      taskRow.appendChild(el);
    } else if (block.kind === 'fixed') {
      const el = document.createElement('div');
      el.className = 'fixed-block';
      el.style.left = block.leftPct + '%';
      el.style.width = Math.max(block.widthPct, 2) + '%';
      el.innerHTML = `
        <span class="task-icon">${block.task.icon}</span>
        <span class="task-name">${block.task.title}</span>
      `;
      el.title = `${block.task.title}（固定任务）`;
      taskRow.appendChild(el);
    } else if (block.kind === 'flexible') {
      const task = block.task;
      const urgency = getUrgencyLevel(task.id);
      const el = document.createElement('div');
      el.className = 'task-block';
      el.dataset.id = task.id;
      el.dataset.type = 'flexible';

      // 可见部分
      el.style.left = block.visibleLeftPct + '%';
      el.style.width = Math.max(block.visibleWidthPct, 2) + '%';

      // 紧迫样式
      if (urgency !== 'normal') {
        el.classList.add('urgency-' + urgency);
      }

      el.innerHTML = `
        <div class="task-block-inner">
          <span class="task-icon">${task.icon}</span>
          <span class="task-name">${task.title}</span>
          <span class="task-duration">${task.durationMinutes}分钟</span>
        </div>
      `;

      // 点击完成
      el.addEventListener('click', () => completeTask(task.id));

      taskRow.appendChild(el);
    }
  });

  // 渲染超时区
  const allOverdue = state.tasks.filter(t => t.overdue);
  overdueZone.classList.toggle('hidden', allOverdue.length === 0);
  overdueTasksEl.innerHTML = '';
  allOverdue.forEach(task => {
    const card = document.createElement('div');
    card.className = 'overdue-task';
    card.innerHTML = `
      <span class="overdue-task-icon">${task.icon}</span>
      <span class="overdue-task-name">${task.title}</span>
      <span class="overdue-task-badge">补做</span>
    `;
    card.addEventListener('click', () => {
      // 点击补做 → 重新激活任务（从超时区移回）
      unOverdueTask(task.id);
    });
    overdueTasksEl.appendChild(card);
  });

  // 奖励区
  const allDone = state.tasks.every(t => t.completed || t.overdue);
  rewardZone.classList.toggle('hidden', !allDone);
}

// ============================================
// 完成任务
// ============================================
function completeTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.completed || task.overdue) return;

  task.completed = true;
  task.completedAt = new Date().toISOString();
  state.completedCount++;

  // 找到对应的 DOM 元素，加淡出动画
  const el = document.querySelector(`.task-block[data-id="${taskId}"]`);
  if (el) {
    el.classList.add('task-completed');
    setTimeout(() => el.remove(), 500);
  }

  // 重新渲染
  renderTimebar();

  // 显示奖励（短暂）
  showReward();
}

// ============================================
// 移入超时区
// ============================================
function moveToOverdue(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.overdue || task.completed) return;

  task.overdue = true;
  renderTimebar();
}

// ============================================
// 从超时区移回（点击补做）
// ============================================
function unOverdueTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.overdue) return;

  task.overdue = false;
  renderTimebar();
}

// ============================================
// 检测超时（每分钟检查）
// ============================================
function checkAndMoveOverdue() {
  const now = state.currentMinutes;
  state.tasks.forEach(task => {
    if (
      task.type === 'flexible' &&
      !task.completed &&
      !task.overdue &&
      task._layoutEnd !== undefined &&
      task._layoutEnd <= now
    ) {
      moveToOverdue(task.id);
    }
  });
}

// ============================================
// 显示奖励
// ============================================
function showReward() {
  const rewardZone = document.getElementById('reward-zone');
  rewardZone.classList.remove('hidden');
  // 3秒后自动隐藏（除非全部完成）
  setTimeout(() => {
    const allDone = state.tasks.every(t => t.completed || t.overdue);
    if (!allDone) rewardZone.classList.add('hidden');
  }, 3000);
}

// ============================================
// 模拟时钟
// ============================================
function startSimulation() {
  if (state.simRunning) return;
  state.simRunning = true;

  const btn = document.getElementById('sim-btn');
  btn.textContent = '⏸ 暂停';

  // 速度：1x = 每2秒1分钟，20x = 每100ms1分钟
  const tickMs = 2000 / state.simSpeed;

  state.simIntervalId = setInterval(() => {
    state.currentMinutes++;

    // 更新时间显示
    updateTimeDisplay();

    // 每分钟检测超时
    if (state.currentMinutes % 1 === 0) {
      checkAndMoveOverdue();
    }

    // 重新渲染
    renderTimebar();

    // 到21:00停止
    if (state.currentMinutes >= DAY_END) {
      stopSimulation();
    }
  }, tickMs);
}

function stopSimulation() {
  if (!state.simRunning) return;
  state.simRunning = false;
  clearInterval(state.simIntervalId);
  state.simIntervalId = null;
  const btn = document.getElementById('sim-btn');
  btn.textContent = '⏵ 加速时间';
}

function toggleSimulation() {
  if (state.simRunning) {
    stopSimulation();
  } else {
    startSimulation();
  }
}

function speedUp() {
  const speeds = [1, 5, 10, 20, 60];
  const idx = speeds.indexOf(state.simSpeed);
  state.simSpeed = speeds[(idx + 1) % speeds.length];
  document.getElementById('sim-speed').textContent = state.simSpeed + 'x';

  // 如果在跑，重启 interval
  if (state.simRunning) {
    stopSimulation();
    startSimulation();
  }
}

// ============================================
// 时间显示
// ============================================
function updateTimeDisplay() {
  document.getElementById('current-time').textContent = formatTime(state.currentMinutes);
}

// ============================================
// 初始化
// ============================================
function init() {
  // 更新时间
  updateTimeDisplay();
  document.getElementById('current-date').textContent = getDateStr();

  // 初始渲染
  renderTimebar();

  // 绑定事件
  document.getElementById('sim-btn').addEventListener('click', toggleSimulation);

  // 速度按钮（点击 speed label 循环）
  document.getElementById('sim-speed').addEventListener('click', speedUp);

  // 自动开始模拟（方便演示）
  setTimeout(() => {
    state.simSpeed = 5;
    document.getElementById('sim-speed').textContent = '5x';
    startSimulation();
  }, 500);
}

// DOM ready
document.addEventListener('DOMContentLoaded', init);
