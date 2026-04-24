# 开发指南：儿童时间小管家 PWA

> ⚙️ 本文档记录项目骨架（Issue #1）的实现细节，后续开发请以此为基准。

## 项目骨架（v0.1.0）

骨架目标：最小可运行闭环，满足 `npm run dev` 即可同时启动前后端。

### 目录结构

```
children-time-pwa/
├── frontend/              # 前端（HTML + CSS + 原生 JS）
│   ├── index.html         # 单页入口
│   ├── style.css          # 全局样式
│   ├── app.js             # 前端 JS 入口
│   └── manifest.json      # PWA manifest（占位）
├── backend/               # 后端（Node.js + Express）
│   └── server.js          # Express 服务入口，端口 3000
├── docs/
│   └── development-guide.md  # 本文档
├── .github/
│   └── ISSUE_TEMPLATE/
│       └── README.md      # Issue 模板
├── .gitignore
├── README.md
└── package.json           # npm scripts: dev / start / serve / test
```

### 启动命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | concurrently 启动后端（3000）+ 前端静态服务（8080） |
| `npm run start` | `node backend/server.js` |
| `npm run serve` | `npx http-server frontend -p 8080` |
| `npm run test` | Node.js 语法检查（backend + frontend） |

### 数据库状态

已预留 SQLite 表结构（见下方推荐表），但 `db.init()` 在骨架阶段为占位函数，暂不实际初始化。

### API 状态

骨架阶段仅实现：
- `GET /api/health` — 服务健康检查
- `GET /api/children` — 占位，返回空数组
- `GET /api/children/:childId/today` — 占位，返回空 tasks

其余 API 随后续 Issue 实现。

### 前端状态

纯静态占位页面，`app.js` 仅打印初始化日志，不涉及任何业务逻辑。

### PWA 状态

`manifest.json` 已建立占位项，Service Worker 待后续 Issue 实现。

## 一句话产品定义

这是一个给孩子看的“时间可视化仪表盘”：让孩子看到任务不是凭空出现的，而是在真实消耗自己的自由时间；越拖延，自由时间越少，任务越挤，直到超时必须补做。

## 核心体验

- 时间范围固定为 07:00-21:00。
- 进度条从左到右表示一天时间。
- 已经过去的时间从左边被消耗。
- 未完成任务按照日常顺序靠右排列。
- 中间没有被任务占用的部分就是自由时间，显示为蓝色荧光区域。
- 当自由时间被拖延消耗光，任务块开始被挤压、发热、膨胀。
- 任务时间被消耗完且仍未完成，则任务下沉到“超时任务”区域。

## 推荐技术栈

前端：

- HTML
- CSS
- JavaScript
- PWA manifest
- Service Worker

后端：

- Node.js
- Express
- SQLite

部署：

- Docker
- NAS 局域网访问

## 时间基础常量

```js
const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const TOTAL_MINUTES = DAY_END - DAY_START; // 840
```

## 任务类型

### fixed 固定任务

- 有固定开始和结束时间。
- 不能拖动。
- 示例：上学 08:00-17:30。

### flexible 弹性任务

- 有预计时长。
- 可调整顺序。
- 第一版建议只支持拖动排序，不做精确时间段排班。
- 示例：写作业 60 分钟、洗澡 20 分钟。

### free 自由时间

- 由系统自动计算。
- 不存数据库。
- 未被已消耗时间、固定任务、未完成任务占据的时间就是自由时间。

## 核心布局算法

弹性任务从 21:00 往左倒排：

```js
function layoutFlexibleTasks(tasks, nowMinutes) {
  let cursor = DAY_END;
  const blocks = [];

  const unfinished = tasks
    .filter(t => t.type === 'flexible' && !t.completed && !t.overdue)
    .sort((a, b) => a.order - b.order);

  for (let i = unfinished.length - 1; i >= 0; i--) {
    const task = unfinished[i];
    const end = cursor;
    const start = cursor - task.durationMinutes;
    const squeezed = start < nowMinutes;
    const visibleStart = Math.max(start, nowMinutes);
    const visibleDuration = Math.max(0, end - visibleStart);

    blocks.unshift({
      taskId: task.id,
      start,
      end,
      visibleStart,
      visibleDuration,
      squeezed
    });

    cursor = start;
  }

  return blocks;
}
```

## 紧迫感规则

```js
const pressureRatio = unfinishedTaskMinutes / Math.max(1, remainingMinutes);
```

建议：

- `<= 0.8`：正常
- `0.8 - 1.0`：轻微提醒
- `1.0 - 1.2`：紧迫，边缘发光
- `> 1.2`：严重，任务块发热、膨胀、轻微抖动

## 超时判断

如果弹性任务未完成，并且该任务布局区间的结束时间已经小于等于当前时间，则移入超时任务：

```js
if (!task.completed && block.end <= nowMinutes) {
  task.overdue = true;
}
```

## 推荐数据库表

### children

```sql
CREATE TABLE children (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  theme TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
```

### task_templates

```sql
CREATE TABLE task_templates (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  duration_minutes INTEGER,
  fixed_start_minutes INTEGER,
  fixed_end_minutes INTEGER,
  sort_order INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### daily_tasks

```sql
CREATE TABLE daily_tasks (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  template_id TEXT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  duration_minutes INTEGER,
  fixed_start_minutes INTEGER,
  fixed_end_minutes INTEGER,
  sort_order INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  completed_at TEXT,
  overdue INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## API 草案

儿童端：

```txt
GET  /api/children
GET  /api/children/:childId/today
POST /api/tasks/:taskId/complete
POST /api/tasks/:taskId/uncomplete
POST /api/children/:childId/today/reset
POST /api/children/:childId/tasks/reorder
```

家长后台：

```txt
GET    /api/admin/children
POST   /api/admin/children
PUT    /api/admin/children/:childId
DELETE /api/admin/children/:childId
GET    /api/admin/children/:childId/templates
POST   /api/admin/children/:childId/templates
PUT    /api/admin/templates/:templateId
DELETE /api/admin/templates/:templateId
POST   /api/admin/login
```

## 视觉方向

- 梦幻夜空
- 蓝紫渐变
- 星星、月亮、云朵
- 圆角卡片
- 柔和阴影
- 可爱插画
- 蓝色荧光自由时间
- 橙红色紧迫/超时状态

## 默认任务建议

固定任务：

- 上学：08:00-17:30

弹性任务：

- 吃饭：30 分钟
- 写作业：60 分钟
- 运动打卡：20 分钟
- 收拾书包和书桌：10 分钟
- 洗澡：20 分钟
- 刷牙洗脸：5 分钟
- 阅读课外书：30 分钟
- 背单词：20 分钟
- 整理错题本：30 分钟
