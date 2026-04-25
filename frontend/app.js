/**
 * 儿童时间管理 PWA - 主应用脚本
 * Issue #6: 前后端联调
 * 职责：孩子切换、动态时间条渲染、时间轴布局算法、API 交互
 */

// ============================================
// 时间常量（与后端一致）
// ============================================

const DAY_START = 7 * 60;   // 07:00 = 420 分钟
const DAY_END = 21 * 60;    // 21:00 = 1260 分钟
const TOTAL_MINUTES = DAY_END - DAY_START;  // 840 分钟

// ============================================
// API Base（动态跟随当前访问 URL）
// ============================================

/**
 * 获取 API 基础地址
 * 使用 window.location.origin 动态跟随当前入口，
 * 兼容 3000 / 3001 / NAS IP / 反代等各种部署场景。
 */
function getApiBase() {
  return window.location.origin;
}

const API_BASE = getApiBase();

// ============================================
// 鼓励语
// ============================================

const ENCOURAGES = [
  '太棒了！继续保持！',
  '你真是个时间小达人！🌟',
  '专注的你最可爱！',
  '完成得很漂亮！继续加油！',
  '时间管理小能手就是你！',
];

// ============================================
// 当前状态
// ============================================

let currentChildId = null;      // 当前选中的孩子 ID
let childrenList = [];           // 孩子列表（从 API 加载）
let currentTasks = [];           // 当前孩子的今日任务（从 API 加载）
let currentTimeInterval = null;
let draggedTaskId = null;        // 正在拖动的任务 ID

// ============================================
// DOM 引用
// ============================================

const elements = {
  currentTime: document.getElementById('currentTime'),
  currentDate: document.getElementById('currentDate'),
  timebarContainer: document.getElementById('timebarContainer'),
  overtimeList: document.getElementById('overtimeList'),
  encourageText: document.getElementById('encourageText'),
  childAvatars: document.querySelectorAll('.child-avatar'),
  simTimeIndicator: document.getElementById('simTimeIndicator'),
  simTimeValue: document.getElementById('simTimeValue'),
};

// ============================================
// API 封装
// ============================================

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${path}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${path}`);
  return res.json();
}

// ============================================
// 模拟时间支持
// ============================================

function getCurrentMinutes() {
  if (window.SIMULATED_TIME !== undefined) {
    return parseTimeToMinutes(window.SIMULATED_TIME);
  }
  const urlParams = new URLSearchParams(window.location.search);
  const timeParam = urlParams.get('time');
  if (timeParam) return parseTimeToMinutes(timeParam);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function parseTimeToMinutes(timeStr) {
  if (typeof timeStr === 'number') return Math.floor(timeStr * 60);
  const parts = timeStr.split(':');
  if (parts.length !== 2) return DAY_START;
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(mins)) return DAY_START;
  return hours * 60 + mins;
}

function minutesToTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ============================================
// 核心布局算法（适配后端数据模型）
// ============================================

/**
 * 布局时间条
 * 后端任务模型：
 *   - fixed:   fixed_start_minutes, fixed_end_minutes（绝对时间）
 *   - flexible: duration_minutes + sort_order（从 DAY_END 向左排列）
 */
function layoutTimebar(nowMinutes) {
  if (!currentTasks.length) return { blocks: [], elapsedPercent: 0, freeMinutes: TOTAL_MINUTES, overtimeTasks: [] };

  // 已消耗时间百分比
  let elapsedPercent = 0;
  if (nowMinutes >= DAY_START) {
    elapsedPercent = Math.min(((nowMinutes - DAY_START) / TOTAL_MINUTES) * 100, 100);
  }

  // 按 sort_order 从小到大排序
  const sorted = [...currentTasks].sort((a, b) => a.sort_order - b.sort_order);

  // 分离固定任务和弹性任务
  const fixedTasks = sorted.filter(t => t.type === 'fixed');
  const flexibleTasks = sorted.filter(t => t.type === 'flexible');

  // 固定任务块：直接按绝对时间定位
  const fixedBlocks = fixedTasks.map(task => {
    const startMinutes = task.fixed_start_minutes;
    const endMinutes = task.fixed_end_minutes;
    const isOverdue = !task.completed && task.overdue;
    return {
      ...task,
      startMinutes,
      endMinutes,
      visibleStart: Math.max(startMinutes, nowMinutes),
      visibleEnd: endMinutes,
    };
  });

  // 弹性任务块：从 DAY_END 向左按 sort_order 排列
  // 未完成任务从右往左排（sort_order 小的在右侧，大的在左侧）
  // 已完成任务也显示但淡化
  const pendingFlexible = flexibleTasks.filter(t => !t.completed);
  const completedFlexible = flexibleTasks.filter(t => t.completed);

  const flexibleBlocks = [];
  let cursor = DAY_END;

  // 未完成的弹性任务：从 DAY_END 向左排
  for (let i = 0; i < pendingFlexible.length; i++) {
    const task = pendingFlexible[i];
    const duration = task.duration_minutes || 30;
    const endMinutes = cursor;
    const startMinutes = cursor - duration;

    const isOverdue = !task.completed && task.overdue;

    flexibleBlocks.push({
      ...task,
      startMinutes,
      endMinutes,
      visibleStart: Math.max(startMinutes, nowMinutes),
      visibleEnd: endMinutes,
      overdue: isOverdue,
    });

    cursor = startMinutes;
  }

  // 已完成的弹性任务：从 cursor 继续向左排（显示但不占主时间）
  // 已完成任务不参与时间轴布局，只在完成列表显示
  // 这里我们把已完成任务也渲染但标记 completed

  // 计算固定任务中未完成且未超时的剩余时间
  const remainingFixedMinutes = fixedBlocks
    .filter(b => !b.completed && !b.overdue && b.endMinutes > nowMinutes)
    .reduce((sum, b) => {
      const remaining = b.endMinutes - Math.max(b.startMinutes, nowMinutes);
      return sum + Math.max(0, remaining);
    }, 0);

  // 剩余未完成的弹性任务总时长
  const pendingDuration = pendingFlexible.reduce((sum, t) => sum + (t.duration_minutes || 30), 0);

  // 剩余总时间
  const remainingMinutes = Math.max(0, DAY_END - nowMinutes);

  // 自由时间 = 剩余时间 - 未完成固定任务 - 未完成弹性任务
  const freeMinutes = Math.max(0, remainingMinutes - pendingDuration - remainingFixedMinutes);

  // 计算紧迫感
  const pressureRatio = pendingDuration / Math.max(1, remainingMinutes - remainingFixedMinutes);

  flexibleBlocks.forEach(block => {
    if (pressureRatio <= 0.8) {
      block.pressureLevel = 0;
    } else if (pressureRatio <= 1.0) {
      block.pressureLevel = 1;
    } else if (pressureRatio <= 1.2) {
      block.pressureLevel = 2;
    } else {
      block.pressureLevel = 3;
    }
  });

  // 超时任务（overdue=1 且未完成）
  const overdueTasks = currentTasks
    .filter(t => t.overdue && !t.completed)
    .map(t => ({
      ...t,
      overdueMinutes: nowMinutes - (t.fixed_end_minutes || (t.duration_minutes || 30)),
    }));

  return {
    blocks: [...fixedBlocks, ...flexibleBlocks],
    elapsedPercent,
    freeMinutes,
    remainingMinutes,
    pressureRatio,
    overtimeTasks: overdueTasks,
  };
}

// ============================================
// 渲染时间条
// ============================================

function renderTimebar() {
  const nowMinutes = getCurrentMinutes();
  const layout = layoutTimebar(nowMinutes);

  const container = elements.timebarContainer;
  container.innerHTML = '';

  // 时间刻度尺
  const ruler = document.createElement('div');
  ruler.className = 'timebar-ruler';
  ruler.innerHTML = `
    <span class="ruler-start">07:00</span>
    <div class="ruler-ticks" id="rulerTicks"></div>
    <span class="ruler-end">21:00</span>
  `;
  container.appendChild(ruler);

  for (let h = 7; h <= 21; h++) {
    const percent = ((h * 60 - DAY_START) / TOTAL_MINUTES) * 100;
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = `${percent}%`;
    tick.innerHTML = `<span class="ruler-tick-label">${h}:00</span>`;
    ruler.querySelector('#rulerTicks').appendChild(tick);
  }

  // 时间条主体行
  const row = document.createElement('div');
  row.className = 'timebar-row';
  row.id = 'timebarRow';

  // 已消耗区域
  const elapsed = document.createElement('div');
  elapsed.className = 'timebar-elapsed';
  elapsed.style.width = `${layout.elapsedPercent}%`;
  if (layout.elapsedPercent > 0) {
    const label = document.createElement('span');
    label.className = 'elapsed-label';
    label.textContent = '已消耗';
    elapsed.appendChild(label);
  }
  row.appendChild(elapsed);

  // 固定任务块
  layout.blocks
    .filter(b => b.type === 'fixed' && b.visibleEnd > nowMinutes && b.visibleStart < DAY_END)
    .forEach(block => {
      const startPct = ((block.startMinutes - DAY_START) / TOTAL_MINUTES) * 100;
      const widthPct = ((block.endMinutes - block.startMinutes) / TOTAL_MINUTES) * 100;
      if (widthPct <= 0) return;

      const blockEl = makeTaskBlock(block, startPct, widthPct);
      row.appendChild(blockEl);
    });

  // 弹性任务块
  layout.blocks
    .filter(b => b.type === 'flexible')
    .forEach(block => {
      const startPct = ((block.startMinutes - DAY_START) / TOTAL_MINUTES) * 100;
      const widthPct = ((block.endMinutes - block.startMinutes) / TOTAL_MINUTES) * 100;
      if (widthPct <= 0) return;

      const blockEl = makeTaskBlock(block, startPct, widthPct);
      row.appendChild(blockEl);
    });

  // 自由时间块
  const pendingBlocks = layout.blocks.filter(b => !b.completed && b.type === 'flexible');
  const firstPendingStart = pendingBlocks.length > 0
    ? Math.min(...pendingBlocks.map(b => b.startMinutes))
    : DAY_END;
  const freeEnd = Math.min(firstPendingStart, DAY_END);
  const freeStart = Math.max(nowMinutes, DAY_START);
  const freeDuration = Math.max(0, freeEnd - freeStart);

  if (freeDuration > 5) { // 至少 5 分钟才显示
    const leftPct = ((freeStart - DAY_START) / TOTAL_MINUTES) * 100;
    const widthPct = ((freeEnd - freeStart) / TOTAL_MINUTES) * 100;

    const freeEl = document.createElement('div');
    freeEl.className = 'timebar-block free';
    freeEl.style.left = `${leftPct}%`;
    freeEl.style.width = `${Math.max(widthPct, 5)}%`;
    freeEl.innerHTML = `
      <span class="block-name">🎉 自由时间</span>
      <span class="block-time">${freeDuration} 分钟</span>
    `;
    row.appendChild(freeEl);
  }

  container.appendChild(row);

  // 超时任务
  renderOvertime(layout.overtimeTasks);

  // 绑定任务点击和拖动事件
  bindTaskEvents();

  // 更新模拟时间指示器
  updateSimIndicator(nowMinutes);
}

function makeTaskBlock(block, leftPct, widthPct) {
  const blockEl = document.createElement('div');
  blockEl.className = `timebar-block ${block.type}`;
  blockEl.style.left = `${leftPct}%`;
  blockEl.style.width = `${Math.max(widthPct, 3)}%`;
  blockEl.dataset.taskId = block.id;
  blockEl.dataset.taskType = block.type;
  blockEl.draggable = block.type === 'flexible'; // 只有弹性任务可拖动排序

  if (block.completed) blockEl.classList.add('completed');
  if (block.overdue) blockEl.classList.add('overdue');
  if (block.pressureLevel >= 3) blockEl.classList.add('critical');
  else if (block.pressureLevel >= 2) blockEl.classList.add('urgent');
  else if (block.pressureLevel === 1) blockEl.classList.add('pressure-1');

  blockEl.style.backgroundColor = block.color;

  const timeRange = block.type === 'fixed'
    ? `${minutesToTimeStr(block.fixed_start_minutes)} - ${minutesToTimeStr(block.fixed_end_minutes)}`
    : `${block.duration_minutes || 30}m`;

  blockEl.innerHTML = `
    <span class="block-name">${block.icon || ''} ${block.title}</span>
    <span class="block-time">${timeRange}</span>
    ${block.type === 'flexible' ? `<span class="block-duration drag-handle" title="长按拖动排序">⇄</span>` : ''}
  `;

  return blockEl;
}

function renderOvertime(overtimeTasks) {
  const listEl = elements.overtimeList;

  if (overtimeTasks.length === 0) {
    listEl.innerHTML = `
      <div class="overtime-item">
        <span class="overtime-dot" style="background: #6BCB77; box-shadow: 0 0 8px #6BCB77;"></span>
        <span class="overtime-text">暂无超时任务，继续加油！</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = overtimeTasks.map(task => `
    <div class="overtime-item">
      <span class="overtime-dot"></span>
      <span class="overtime-text">${task.icon || ''} ${task.title} — 需要补做</span>
    </div>
  `).join('');
}

function updateSimIndicator(nowMinutes) {
  const isSimulated =
    window.SIMULATED_TIME !== undefined ||
    new URLSearchParams(window.location.search).has('time');

  elements.simTimeIndicator.style.display = isSimulated ? 'inline-block' : 'none';
  elements.simTimeValue.textContent = minutesToTimeStr(nowMinutes);
}

// ============================================
// 任务交互（完成/取消完成）
// ============================================

function bindTaskEvents() {
  const blocks = document.querySelectorAll('.timebar-block');
  blocks.forEach(block => {
    block.addEventListener('click', () => {
      const taskId = block.dataset.taskId;
      const taskType = block.dataset.taskType;
      if (taskId && taskType) toggleTaskComplete(taskId, taskType);
    });

    // 拖动排序（仅弹性任务）
    if (block.dataset.taskType === 'flexible') {
      block.addEventListener('dragstart', onDragStart);
      block.addEventListener('dragover', onDragOver);
      block.addEventListener('drop', onDrop);
      block.addEventListener('dragend', onDragEnd);
    }
  });
}

function onDragStart(e) {
  draggedTaskId = e.target.dataset.taskId;
  e.target.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDrop(e) {
  e.preventDefault();
  const targetTaskId = e.currentTarget.dataset.taskId;
  if (!draggedTaskId || draggedTaskId === targetTaskId) return;

  // 交换 sort_order
  const draggedTask = currentTasks.find(t => t.id === draggedTaskId);
  const targetTask = currentTasks.find(t => t.id === targetTaskId);
  if (!draggedTask || !targetTask) return;

  // 乐观更新 UI
  const draggedOrder = draggedTask.sort_order;
  const targetOrder = targetTask.sort_order;

  // 判断拖动方向： dragged 拖到 target 右侧 → dragged.sort_order = targetOrder + 1
  // 实际交换两个任务的 sort_order
  const tempOrder = draggedTask.sort_order;
  draggedTask.sort_order = targetTask.sort_order;
  targetTask.sort_order = tempOrder;

  // 重新渲染
  renderTimebar();

  // 调用后端 reorder API
  const pendingFlexible = currentTasks
    .filter(t => t.type === 'flexible')
    .sort((a, b) => a.sort_order - b.sort_order);

  const taskIds = pendingFlexible.map(t => t.id);

  apiPost(`/api/children/${currentChildId}/tasks/reorder`, { taskIds }).catch(err => {
    console.error('Reorder failed:', err);
    // 失败时重新加载以恢复正确顺序
    loadChildTasks(currentChildId);
  });
}

function onDragEnd(e) {
  draggedTaskId = null;
  e.target.style.opacity = '';
}

async function toggleTaskComplete(taskId, taskType) {
  const task = currentTasks.find(t => t.id === taskId);
  if (!task) return;

  const action = task.completed ? 'uncomplete' : 'complete';
  const confirmMsg = task.completed
    ? `取消完成「${task.title}」？`
    : `完成「${task.title}」？`;

  if (!confirm(confirmMsg)) return;

  try {
    const updated = await apiPost(`/api/tasks/${taskId}/${action}`, {});
    // 更新本地状态
    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      currentTasks[idx] = updated;
    }
    renderTimebar();
    updateEncourage();
  } catch (err) {
    console.error('Toggle complete failed:', err);
    alert('操作失败，请重试');
  }
}

// ============================================
// 孩子切换
// ============================================

async function switchChild(childId) {
  if (childId === currentChildId) return;

  currentChildId = childId;

  // 头像高亮：每次从 DOM 重新查询（避免 renderChildAvatars 后 NodeList 失效）
  document.querySelectorAll('.child-avatar').forEach(avatar => {
    avatar.classList.toggle('active', avatar.dataset.child == childId);
  });

  // 加载该孩子的今日任务
  await loadChildTasks(childId);

  renderTimebar();
  updateEncourage();
}

async function loadChildTasks(childId) {
  try {
    currentTasks = await apiGet(`/api/children/${childId}/today`);
  } catch (err) {
    console.error('Failed to load tasks:', err);
    currentTasks = [];
  }
}

async function loadChildren() {
  try {
    childrenList = await apiGet('/api/children');

    // 如果还没有选中孩子，默认选第一个
    if (!currentChildId && childrenList.length > 0) {
      currentChildId = childrenList[0].id;

      // 更新头像区域（动态渲染，不再用静态 HTML）
      renderChildAvatars();

      // 加载第一个孩子的任务
      await loadChildTasks(currentChildId);
    }
  } catch (err) {
    console.error('Failed to load children:', err);
    // 显示错误提示
    elements.timebarContainer.innerHTML = '<div style="text-align:center;color:#ff6b6b;padding:20px;">加载失败，请刷新重试</div>';
  }
}

/**
 * 动态渲染孩子头像（替代静态 HTML 中的硬编码）
 */
function renderChildAvatars() {
  const selector = document.querySelector('.child-selector');
  if (!selector) return;

  selector.innerHTML = childrenList.map(child => `
    <div class="child-avatar${child.id === currentChildId ? ' active' : ''}"
         data-child="${child.id}"
         role="button"
         tabindex="0"
         aria-label="${child.name}">
      <div class="avatar-ring">
        <div class="avatar-inner baby-emoji">${child.avatar || '👧'}</div>
      </div>
      <span class="child-name">${child.name}</span>
    </div>
  `).join('');

  // 重新绑定头像点击事件
  selector.querySelectorAll('.child-avatar').forEach(avatar => {
    avatar.addEventListener('click', () => {
      const childId = avatar.dataset.child;
      switchChild(childId);
    });
    avatar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchChild(avatar.dataset.child);
      }
    });
  });
}

// ============================================
// 时间显示
// ============================================

function updateTime() {
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 8);
  elements.currentTime.textContent = timeStr;

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDay = weekDays[now.getDay()];
  elements.currentDate.textContent = `${year}年${month}月${date}日 星期${weekDay}`;
}

// ============================================
// 鼓励语
// ============================================

function updateEncourage() {
  if (!currentTasks.length) {
    elements.encourageText.textContent = '加载中...';
    return;
  }

  const totalFlexible = currentTasks.filter(t => t.type === 'flexible').length;
  const completedFlexible = currentTasks.filter(t => t.type === 'flexible' && t.completed).length;
  const progress = totalFlexible > 0 ? completedFlexible / totalFlexible : 0;

  let text;
  if (progress >= 1) {
    text = '全部完成！你太厉害了！🏆';
  } else if (progress >= 0.75) {
    text = ENCOURAGES[1];
  } else if (progress >= 0.5) {
    text = ENCOURAGES[2];
  } else if (progress >= 0.25) {
    text = ENCOURAGES[3];
  } else {
    text = ENCOURAGES[4];
  }

  elements.encourageText.textContent = text;
}

// ============================================
// 家长入口按钮
// ============================================

function bindParentBtn() {
  const btn = document.getElementById('parentBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      console.log('家长入口被点击');
      // Issue #7 会实现家长端
    });
  }
}

/**
 * 重置今日任务
 */
async function resetToday() {
  if (!currentChildId) return;
  if (!confirm('确定要重置今日任务吗？这将清空所有完成状态。')) return;
  try {
    currentTasks = await apiPost(`/api/children/${currentChildId}/today/reset`, {});
    renderTimebar();
    updateEncourage();
  } catch (err) {
    console.error('重置失败:', err);
    alert('重置失败，请稍后重试');
  }
}

// ============================================
// 初始化
// ============================================

async function init() {
  // 注册 Service Worker（PWA 离线支持）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then((reg) => {
      console.log('[SW] Service Worker 已注册:', reg.scope);
    }).catch((err) => {
      console.error('[SW] Service Worker 注册失败:', err);
    });
  }

  // 绑定家长按钮
  bindParentBtn();

  // 绑定重置按钮
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetToday);
  }

  // 启动时钟
  updateTime();
  currentTimeInterval = setInterval(updateTime, 1000);

  // 加载孩子列表（API）
  await loadChildren();

  // 渲染时间条
  renderTimebar();

  // 初次更新鼓励语
  updateEncourage();

  // 每分钟更新时间条布局
  setInterval(renderTimebar, 60000);

  // 暴露模拟时间接口到控制台
  window.setSimulatedTime = (time) => {
    window.SIMULATED_TIME = time;
    renderTimebar();
    console.log(`模拟时间已设置为: ${time} (${parseTimeToMinutes(time)} 分钟)`);
  };

  window.clearSimulatedTime = () => {
    window.SIMULATED_TIME = undefined;
    renderTimebar();
    console.log('已清除模拟时间，恢复真实时间');
  };

  console.log('💡 调试提示: 可用 window.setSimulatedTime("18:30") 模拟不同时间');
  console.log(`[API] 后端地址: ${API_BASE}`);
}

// 启动
document.addEventListener('DOMContentLoaded', init);
