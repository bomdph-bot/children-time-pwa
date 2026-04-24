/**
 * 儿童时间管理 PWA - 主应用脚本
 * 职责：孩子切换、动态时间条渲染、时间轴布局算法
 */

// ============================================
// 时间常量
// ============================================

const DAY_START = 7 * 60;   // 07:00 = 420 分钟
const DAY_END = 21 * 60;    // 21:00 = 1260 分钟
const TOTAL_MINUTES = DAY_END - DAY_START;  // 840 分钟
const TOTAL_HOURS = 14;     // 14 小时跨度

// ============================================
// 任务类型配置
// ============================================

const TASK_TYPES = {
  study: { color: '#FF6B9D', label: '学习' },
  sport: { color: '#FFD93D', label: '运动' },
  rest: { color: '#6BCB77', label: '休息' },
  free: { color: '#4D96FF', label: '自由' },
};

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
// 静态模拟数据（4个孩子）
// ============================================

const CHILDREN_DATA = {
  1: {
    name: '大宝',
    emoji: '👧',
    // fixed 任务：有固定开始/结束时间（单位：小时，如 8.5 = 08:30）
    fixedTasks: [
      { id: 'f1', name: '上学', type: 'study', startHour: 8, endHour: 17.5, completed: false },
    ],
    // flexible 任务：有预计时长，按 sort_order 从右往左排列
    flexibleTasks: [
      { id: 't1', name: '吃早餐', type: 'rest', durationMinutes: 30, sortOrder: 1, completed: false },
      { id: 't2', name: '写作业', type: 'study', durationMinutes: 60, sortOrder: 2, completed: false },
      { id: 't3', name: '运动打卡', type: 'sport', durationMinutes: 20, sortOrder: 3, completed: false },
      { id: 't4', name: '收拾书包', type: 'rest', durationMinutes: 10, sortOrder: 4, completed: false },
      { id: 't5', name: '洗澡', type: 'rest', durationMinutes: 20, sortOrder: 5, completed: false },
      { id: 't6', name: '刷牙洗脸', type: 'rest', durationMinutes: 5, sortOrder: 6, completed: false },
      { id: 't7', name: '阅读', type: 'study', durationMinutes: 30, sortOrder: 7, completed: false },
    ],
  },
  2: {
    name: '二宝',
    emoji: '👦',
    fixedTasks: [
      { id: 'f2', name: '上学', type: 'study', startHour: 8, endHour: 16.5, completed: true },
    ],
    flexibleTasks: [
      { id: 't8', name: '英语口语', type: 'study', durationMinutes: 30, sortOrder: 1, completed: true },
      { id: 't9', name: '钢琴练习', type: 'study', durationMinutes: 40, sortOrder: 2, completed: false },
      { id: 't10', name: '踢足球', type: 'sport', durationMinutes: 60, sortOrder: 3, completed: false },
      { id: 't11', name: '自由游戏', type: 'free', durationMinutes: 45, sortOrder: 4, completed: false },
    ],
  },
  3: {
    name: '三宝',
    emoji: '👧',
    fixedTasks: [
      { id: 'f3', name: '上学', type: 'study', startHour: 8.5, endHour: 16, completed: false },
    ],
    flexibleTasks: [
      { id: 't12', name: '早操', type: 'sport', durationMinutes: 20, sortOrder: 1, completed: true },
      { id: 't13', name: '数学练习', type: 'study', durationMinutes: 45, sortOrder: 2, completed: false },
      { id: 't14', name: '自由玩耍', type: 'free', durationMinutes: 90, sortOrder: 3, completed: false },
      { id: 't15', name: '睡前故事', type: 'rest', durationMinutes: 15, sortOrder: 4, completed: false },
    ],
  },
  4: {
    name: '小宝',
    emoji: '👶',
    fixedTasks: [
      // 小宝没有固定任务
    ],
    flexibleTasks: [
      { id: 't16', name: '吃早餐', type: 'rest', durationMinutes: 30, sortOrder: 1, completed: true },
      { id: 't17', name: '看动画片', type: 'free', durationMinutes: 30, sortOrder: 2, completed: false },
      { id: 't18', name: '搭积木', type: 'free', durationMinutes: 45, sortOrder: 3, completed: false },
      { id: 't19', name: '午睡', type: 'rest', durationMinutes: 120, sortOrder: 4, completed: false },
    ],
  },
};

// ============================================
// 当前状态
// ============================================

let currentChildId = 1;
let currentTimeInterval = null;

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
// 模拟时间支持
// ============================================

/**
 * 获取模拟时间（优先）或实际时间（分钟数从 00:00 开始）
 */
function getCurrentMinutes() {
  // 1. 优先使用 window.SIMULATED_TIME（控制台调试用）
  if (window.SIMULATED_TIME !== undefined) {
    return parseTimeToMinutes(window.SIMULATED_TIME);
  }

  // 2. 检查 URL 参数 ?time=18:30
  const urlParams = new URLSearchParams(window.location.search);
  const timeParam = urlParams.get('time');
  if (timeParam) {
    return parseTimeToMinutes(timeParam);
  }

  // 3. 使用实际时间
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * 将 "HH:MM" 或 "H:MM" 格式转换为分钟数
 */
function parseTimeToMinutes(timeStr) {
  if (typeof timeStr === 'number') {
    // 如果是数字，假设是小时（如 18.5 = 18:30）
    return Math.floor(timeStr * 60);
  }
  const parts = timeStr.split(':');
  if (parts.length !== 2) return DAY_START;
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(mins)) return DAY_START;
  return hours * 60 + mins;
}

/**
 * 将分钟数转换为 "HH:MM" 格式
 */
function minutesToTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * 将分钟数转换为小时数（如 8.5 = 08:30）
 */
function minutesToHours(minutes) {
  return minutes / 60;
}

// ============================================
// 核心布局算法
// ============================================

/**
 * 布局时间条 - 计算所有区块的位置和尺寸
 *
 * @param {number} nowMinutes - 当前时间（分钟，从 00:00 开始）
 * @returns {Object} 布局结果
 */
function layoutTimebar(nowMinutes) {
  const child = CHILDREN_DATA[currentChildId];
  if (!child) return { blocks: [], elapsedPercent: 0, freeMinutes: TOTAL_MINUTES };

  // 1. 计算已消耗时间百分比
  let elapsedPercent = 0;
  if (nowMinutes >= DAY_START) {
    elapsedPercent = Math.min(((nowMinutes - DAY_START) / TOTAL_MINUTES) * 100, 100);
  } else if (nowMinutes < DAY_START) {
    elapsedPercent = 0;
  }

  // 2. 计算固定任务占用的时间区间
  const fixedBlocks = child.fixedTasks.map(task => {
    const startMinutes = task.startHour * 60;
    const endMinutes = task.endHour * 60;
    return {
      type: 'fixed',
      taskId: task.id,
      name: task.name,
      color: TASK_TYPES[task.type]?.color || '#888',
      startMinutes,
      endMinutes,
      durationMinutes: endMinutes - startMinutes,
      completed: task.completed,
      // 计算可见区域（任务在当前时间之后才显示）
      visibleStart: Math.max(startMinutes, nowMinutes),
      visibleEnd: endMinutes,
      // 是否已超时
      overdue: !task.completed && endMinutes <= nowMinutes,
    };
  });

  // 3. 计算未完成的弹性任务（按 sort_order 从右往左排列）
  const unfinishedFlexible = child.flexibleTasks
    .filter(t => !t.completed && !t.overdue)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 4. 从 DAY_END 开始，从右往左排列弹性任务
  let cursor = DAY_END;
  const flexibleBlocks = [];

  for (let i = unfinishedFlexible.length - 1; i >= 0; i--) {
    const task = unfinishedFlexible[i];
    const endMinutes = cursor;
    const startMinutes = cursor - task.durationMinutes;

    // 是否被"挤压"（任务开始时间已过但未完成）
    const squeezed = startMinutes < nowMinutes;

    // 计算可见区域
    const visibleStart = Math.max(startMinutes, nowMinutes);
    const visibleEnd = endMinutes;
    const visibleDuration = Math.max(0, visibleEnd - visibleStart);

    flexibleBlocks.unshift({
      type: 'flexible',
      taskId: task.id,
      name: task.name,
      color: TASK_TYPES[task.type]?.color || '#888',
      startMinutes,
      endMinutes,
      durationMinutes: task.durationMinutes,
      completed: false,
      squeezed,
      overdue: !squeezed === false && endMinutes <= nowMinutes,
      // 可见性
      visibleStart,
      visibleEnd,
      visibleDuration,
      // 紧迫感
      pressureLevel: 0,
    });

    cursor = startMinutes;
  }

  // 5. 计算剩余时间（用于自由时间）
  const remainingMinutes = Math.max(0, DAY_END - nowMinutes);

  // 6. 计算未完成任务总时长
  const unfinishedFlexibleMinutes = unfinishedFlexible.reduce((sum, t) => sum + t.durationMinutes, 0);

  // 7. 计算固定任务中剩余的时间
  const remainingFixedMinutes = fixedBlocks
    .filter(b => !b.completed && !b.overdue && b.endMinutes > nowMinutes)
    .reduce((sum, b) => {
      const remaining = b.endMinutes - Math.max(b.startMinutes, nowMinutes);
      return sum + Math.max(0, remaining);
    }, 0);

  // 8. 自由时间 = 剩余时间 - 未完成弹性任务 - 剩余固定任务
  const freeMinutes = Math.max(0, remainingMinutes - unfinishedFlexibleMinutes - remainingFixedMinutes);

  // 9. 计算紧迫感
  const pressureRatio = unfinishedFlexibleMinutes / Math.max(1, remainingMinutes - remainingFixedMinutes);

  // 分配紧迫等级给弹性任务块
  flexibleBlocks.forEach(block => {
    if (pressureRatio <= 0.8) {
      block.pressureLevel = 0; // 正常
    } else if (pressureRatio <= 1.0) {
      block.pressureLevel = 1; // 轻微
    } else if (pressureRatio <= 1.2) {
      block.pressureLevel = 2; // 紧迫
    } else {
      block.pressureLevel = 3; // 严重
    }
  });

  // 10. 合并所有块（固定块 + 弹性块）
  const blocks = [...fixedBlocks, ...flexibleBlocks];

  return {
    blocks,
    elapsedPercent,
    freeMinutes,
    remainingMinutes,
    pressureRatio,
    // 超时任务（endMinutes <= nowMinutes 且未完成）
    overtimeTasks: blocks.filter(b => b.overdue && b.type === 'flexible').map(b => ({
      ...b,
      overdueMinutes: nowMinutes - b.endMinutes,
    })),
  };
}

// ============================================
// 渲染时间条
// ============================================

/**
 * 计算某个时间区间在时间条中的宽度百分比
 */
function getWidthPercent(startMinutes, endMinutes, nowMinutes) {
  const visibleStart = Math.max(startMinutes, nowMinutes);
  const visibleEnd = endMinutes;
  const visibleDuration = Math.max(0, visibleEnd - visibleStart);
  return (visibleDuration / TOTAL_MINUTES) * 100;
}

/**
 * 计算某个时间点在时间条中的左边偏移百分比
 */
function getLeftPercent(minutes, nowMinutes) {
  if (minutes <= nowMinutes) return 0;
  return ((minutes - nowMinutes) / TOTAL_MINUTES) * 100;
}

/**
 * 渲染时间条到 DOM
 */
function renderTimebar() {
  const nowMinutes = getCurrentMinutes();
  const layout = layoutTimebar(nowMinutes);

  const container = elements.timebarContainer;
  container.innerHTML = '';

  // 1. 渲染时间刻度尺
  const ruler = document.createElement('div');
  ruler.className = 'timebar-ruler';
  ruler.innerHTML = `
    <span class="ruler-start">07:00</span>
    <div class="ruler-ticks" id="rulerTicks"></div>
    <span class="ruler-end">21:00</span>
  `;
  container.appendChild(ruler);

  // 生成刻度（每小时一个）
  const rulerTicks = ruler.querySelector('#rulerTicks');
  for (let h = 7; h <= 21; h++) {
    const percent = ((h * 60 - DAY_START) / TOTAL_MINUTES) * 100;
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = `${percent}%`;
    tick.innerHTML = `
      <span class="ruler-tick-label">${h}:00</span>
    `;
    rulerTicks.appendChild(tick);
  }

  // 2. 渲染时间条主体行
  const row = document.createElement('div');
  row.className = 'timebar-row';

  // 2.1 已消耗区域（左侧暗色）
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

  // 2.2 固定任务块
  layout.blocks
    .filter(b => b.type === 'fixed' && b.visibleEnd > nowMinutes && b.visibleStart < DAY_END)
    .forEach(block => {
      const widthPercent = getWidthPercent(block.startMinutes, block.endMinutes, nowMinutes);
      const leftPercent = getLeftPercent(block.startMinutes, nowMinutes);

      if (widthPercent <= 0) return; // 跳过不可见的

      const blockEl = document.createElement('div');
      blockEl.className = `timebar-block fixed${block.completed ? ' completed' : ''}${block.overdue ? ' overdue' : ''}`;
      blockEl.style.backgroundColor = block.color;
      blockEl.style.width = `${Math.max(widthPercent, 3)}%`;
      blockEl.style.marginLeft = `${leftPercent}%`;
      blockEl.dataset.taskId = block.taskId;
      blockEl.dataset.taskType = 'fixed';

      blockEl.innerHTML = `
        <span class="block-name">${block.name}</span>
        <span class="block-time">${minutesToTimeStr(block.startMinutes)} - ${minutesToTimeStr(block.endMinutes)}</span>
      `;

      row.appendChild(blockEl);
    });

  // 2.3 弹性任务块（从 DAY_END 往左排列，最右边的 sort_order 最大）
  const flexibleBlocks = layout.blocks.filter(b => b.type === 'flexible');
  let rightOffset = 0; // 累计右偏移

  flexibleBlocks.forEach(block => {
    const widthPercent = (block.durationMinutes / TOTAL_MINUTES) * 100;

    if (widthPercent <= 0) return;

    const blockEl = document.createElement('div');
    blockEl.className = `timebar-block flexible${block.completed ? ' completed' : ''}`;

    // 紧迫状态
    if (block.pressureLevel >= 2) {
      blockEl.classList.add(block.pressureLevel >= 3 ? 'critical' : 'urgent');
    }

    // 挤压状态
    if (block.squeezed) {
      blockEl.classList.add('squeezed');
    }

    blockEl.style.backgroundColor = block.color;
    blockEl.style.width = `${widthPercent}%`;
    blockEl.style.marginRight = `${rightOffset}%`;
    blockEl.dataset.taskId = block.taskId;
    blockEl.dataset.taskType = 'flexible';

    const timeRange = block.durationMinutes >= 60
      ? `${Math.floor(block.durationMinutes / 60)}h${block.durationMinutes % 60 > 0 ? block.durationMinutes % 60 + 'm' : ''}`
      : `${block.durationMinutes}m`;

    blockEl.innerHTML = `
      <span class="block-name">${block.name}</span>
      <span class="block-time">${timeRange}</span>
      <span class="block-duration">${timeRange}</span>
    `;

    row.appendChild(blockEl);
    rightOffset += 4; // 间距
  });

  // 2.4 自由时间块
  if (layout.freeMinutes > 0) {
    const freePercent = (layout.freeMinutes / TOTAL_MINUTES) * 100;
    const freeEl = document.createElement('div');
    freeEl.className = 'timebar-block free';
    freeEl.style.width = `${Math.max(freePercent, 5)}%`;
    freeEl.innerHTML = `
      <span class="block-name">🎉 自由时间</span>
      <span class="block-time">${layout.freeMinutes} 分钟</span>
    `;
    row.appendChild(freeEl);
  }

  container.appendChild(row);

  // 3. 渲染超时任务
  renderOvertime(layout.overtimeTasks, nowMinutes);

  // 4. 绑定任务点击事件
  bindTaskEvents();

  // 5. 更新模拟时间指示器
  updateSimIndicator(nowMinutes);
}

/**
 * 更新模拟时间指示器
 */
function updateSimIndicator(nowMinutes) {
  const isSimulated = window.SIMULATED_TIME !== undefined ||
    new URLSearchParams(window.location.search).has('time');

  if (isSimulated) {
    elements.simTimeIndicator.style.display = 'inline-block';
    elements.simTimeValue.textContent = minutesToTimeStr(nowMinutes);
  } else {
    elements.simTimeIndicator.style.display = 'none';
  }
}

/**
 * 渲染超时任务列表
 */
function renderOvertime(overtimeTasks, nowMinutes) {
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
      <span class="overtime-text">${task.name} - 超时 ${task.overdueMinutes} 分钟</span>
    </div>
  `).join('');
}

// ============================================
// 任务交互
// ============================================

function bindTaskEvents() {
  const blocks = document.querySelectorAll('.timebar-block');
  blocks.forEach(block => {
    block.addEventListener('click', () => {
      const taskId = block.dataset.taskId;
      const taskType = block.dataset.taskType;
      if (taskId && taskType) {
        toggleTaskComplete(taskId, taskType);
      }
    });
  });
}

function toggleTaskComplete(taskId, taskType) {
  const child = CHILDREN_DATA[currentChildId];
  if (!child) return;

  if (taskType === 'fixed') {
    const task = child.fixedTasks.find(t => t.id === taskId);
    if (task) task.completed = !task.completed;
  } else if (taskType === 'flexible') {
    const task = child.flexibleTasks.find(t => t.id === taskId);
    if (task) task.completed = !task.completed;
  }

  renderTimebar();
  updateEncourage();
}

// ============================================
// 孩子切换
// ============================================

function switchChild(childId) {
  if (!CHILDREN_DATA[childId]) return;

  currentChildId = childId;

  // 更新头像高亮
  elements.childAvatars.forEach(avatar => {
    const id = parseInt(avatar.dataset.child, 10);
    avatar.classList.toggle('active', id === childId);
  });

  // 重新渲染时间条
  renderTimebar();
  updateEncourage();
}

// ============================================
// 时间显示
// ============================================

function updateTime() {
  const now = new Date();

  // 格式化时间 HH:MM:SS
  const timeStr = now.toTimeString().slice(0, 8);
  elements.currentTime.textContent = timeStr;

  // 格式化日期
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
  const child = CHILDREN_DATA[currentChildId];
  if (!child) return;

  const totalFlexible = child.flexibleTasks.length;
  const completedFlexible = child.flexibleTasks.filter(t => t.completed).length;
  const progress = totalFlexible > 0 ? completedFlexible / totalFlexible : 0;

  let text = ENCOURAGES[0];
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
// 头像点击绑定
// ============================================

function bindAvatarEvents() {
  elements.childAvatars.forEach(avatar => {
    const handler = () => {
      const childId = parseInt(avatar.dataset.child, 10);
      switchChild(childId);
    };

    avatar.addEventListener('click', handler);
    avatar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}

// ============================================
// 家长入口按钮
// ============================================

function bindParentBtn() {
  const btn = document.getElementById('parentBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      console.log('家长入口被点击');
    });
  }
}

// ============================================
// 初始化
// ============================================

function init() {
  // 绑定头像点击
  bindAvatarEvents();

  // 绑定家长按钮
  bindParentBtn();

  // 启动时钟
  updateTime();
  currentTimeInterval = setInterval(updateTime, 1000);

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
}

// 启动
document.addEventListener('DOMContentLoaded', init);
