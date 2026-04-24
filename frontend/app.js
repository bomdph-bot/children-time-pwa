/**
 * 儿童时间管理 PWA - 主应用脚本
 * 职责：孩子切换、任务渲染、时间显示
 */

// ============================================
// 静态模拟数据
// ============================================

const CHILDREN_DATA = {
  1: {
    name: '大宝',
    emoji: '👧',
    tasks: [
      { id: 't1', name: '数学作业', type: 'study', start: 9, end: 10, completed: false },
      { id: 't2', name: '户外运动', type: 'sport', start: 10.5, end: 11.5, completed: false },
      { id: 't3', name: '午休', type: 'rest', start: 12, end: 14, completed: false },
      { id: 't4', name: '语文阅读', type: 'study', start: 15, end: 16, completed: false },
      { id: 't5', name: '自由画画', type: 'free', start: 16.5, end: 18, completed: false },
    ],
  },
  2: {
    name: '二宝',
    emoji: '👦',
    tasks: [
      { id: 't6', name: '英语口语', type: 'study', start: 8, end: 9, completed: true },
      { id: 't7', name: '钢琴练习', type: 'study', start: 10, end: 11, completed: false },
      { id: 't8', name: '踢足球', type: 'sport', start: 14, end: 16, completed: false },
      { id: 't9', name: '自由游戏', type: 'free', start: 16.5, end: 18.5, completed: false },
    ],
  },
  3: {
    name: '三宝',
    emoji: '👧',
    tasks: [
      { id: 't10', name: '早操', type: 'sport', start: 7.5, end: 8.5, completed: true },
      { id: 't11', name: '数学练习', type: 'study', start: 9, end: 10.5, completed: false },
      { id: 't12', name: '自由玩耍', type: 'free', start: 11, end: 13, completed: false },
      { id: 't13', name: '睡前故事', type: 'rest', start: 20, end: 21, completed: false },
    ],
  },
  4: {
    name: '小宝',
    emoji: '👶',
    tasks: [
      { id: 't14', name: '吃早餐', type: 'rest', start: 7, end: 8, completed: true },
      { id: 't15', name: '看动画片', type: 'free', start: 9, end: 10, completed: false },
      { id: 't16', name: '搭积木', type: 'free', start: 10.5, end: 12, completed: false },
      { id: 't17', name: '午睡', type: 'rest', start: 13, end: 15, completed: false },
    ],
  },
};

// 任务类型配置
const TASK_TYPES = {
  study: { color: '#FF6B9D', label: '学习' },
  sport: { color: '#FFD93D', label: '运动' },
  rest: { color: '#6BCB77', label: '休息' },
  free: { color: '#4D96FF', label: '自由' },
};

// 鼓励语
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

let currentChildId = 1;
let currentTimeInterval = null;

// ============================================
// DOM 引用
// ============================================

const elements = {
  currentTime: document.getElementById('currentTime'),
  currentDate: document.getElementById('currentDate'),
  timelineRow: document.getElementById('timelineRow'),
  overtimeList: document.getElementById('overtimeList'),
  encourageText: document.getElementById('encourageText'),
  childAvatars: document.querySelectorAll('.child-avatar'),
};

// ============================================
// 孩子切换
// ============================================

function switchChild(childId) {
  if (!CHILDREN_DATA[childId]) return;

  currentChildId = childId;

  // 更新头像高亮
  elements.childAvatars.forEach((avatar) => {
    const id = parseInt(avatar.dataset.child, 10);
    avatar.classList.toggle('active', id === childId);
  });

  // 重新渲染任务
  renderTasks();
  renderOvertime();
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
// 任务渲染
// ============================================

function renderTasks() {
  const child = CHILDREN_DATA[currentChildId];
  if (!child) return;

  const row = elements.timelineRow;
  row.innerHTML = '';

  // 收集所有时间段
  const slots = [];

  child.tasks.forEach((task) => {
    const typeConfig = TASK_TYPES[task.type];
    const widthPercent = ((task.end - task.start) / 14) * 100; // 14小时跨度 7:00-21:00

    if (task.type === 'free') {
      // 自由时间块
      const freeEl = document.createElement('div');
      freeEl.className = `free-block${task.completed ? ' completed' : ''}`;
      freeEl.style.width = `${Math.max(widthPercent, 5)}%`;
      freeEl.innerHTML = `<span class="free-text">${task.name}</span>`;
      freeEl.dataset.taskId = task.id;
      row.appendChild(freeEl);
    } else {
      // 任务块
      const taskEl = document.createElement('div');
      taskEl.className = `task-block${task.completed ? ' completed' : ''}`;
      taskEl.style.backgroundColor = typeConfig.color;
      taskEl.style.width = `${Math.max(widthPercent, 8)}%`;
      taskEl.dataset.taskId = task.id;
      taskEl.innerHTML = `
        <span class="task-name">${task.name}</span>
        <span class="task-time">${formatHour(task.start)} - ${formatHour(task.end)}</span>
      `;
      row.appendChild(taskEl);
    }
  });

  // 绑定任务点击事件
  bindTaskEvents();
}

function formatHour(hour) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ============================================
// 任务点击完成
// ============================================

function bindTaskEvents() {
  const taskBlocks = document.querySelectorAll('.task-block, .free-block');
  taskBlocks.forEach((block) => {
    block.addEventListener('click', () => {
      const taskId = block.dataset.taskId;
      toggleTaskComplete(taskId);
    });
  });
}

function toggleTaskComplete(taskId) {
  // 找到任务并切换完成状态
  for (const childId in CHILDREN_DATA) {
    const task = CHILDREN_DATA[childId].tasks.find((t) => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      break;
    }
  }

  // 重新渲染
  renderTasks();
  updateEncourage();
}

// ============================================
// 超时任务
// ============================================

function renderOvertime() {
  const child = CHILDREN_DATA[currentChildId];
  if (!child) return;

  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  const overtimeTasks = child.tasks.filter(
    (task) => !task.completed && task.end < currentHour && task.type !== 'free'
  );

  const listEl = elements.overtimeList;

  if (overtimeTasks.length === 0) {
    listEl.innerHTML = '<div class="overtime-item"><span class="overtime-dot"></span><span class="overtime-text">暂无超时任务，继续加油！</span></div>';
    return;
  }

  listEl.innerHTML = overtimeTasks
    .map((task) => {
      const overdue = ((currentHour - task.end) * 60).toFixed(0);
      return `
        <div class="overtime-item">
          <span class="overtime-dot"></span>
          <span class="overtime-text">${task.name} - 超时 ${overdue} 分钟</span>
        </div>
      `;
    })
    .join('');
}

// ============================================
// 鼓励语
// ============================================

function updateEncourage() {
  const child = CHILDREN_DATA[currentChildId];
  if (!child) return;

  const totalTasks = child.tasks.length;
  const completedTasks = child.tasks.filter((t) => t.completed).length;
  const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;

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
  elements.childAvatars.forEach((avatar) => {
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
      // 暂时只是 console 日志，后续对接真实页面
      console.log('家长入口被点击');
      // TODO: 后续可跳转到家长端页面或打开家长验证弹窗
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

  // 初始化孩子任务渲染
  switchChild(1);

  // 初次更新鼓励语
  updateEncourage();
}

// 启动
document.addEventListener('DOMContentLoaded', init);
