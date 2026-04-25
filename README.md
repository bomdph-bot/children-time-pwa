# 儿童时间小管家 PWA

这是一个运行在 iPad / 浏览器 / PWA 上的儿童时间管理小程序，用可爱、直观的动态时间条帮助孩子理解“任务会占用自由时间，拖延会让自由时间变少”。

## 产品目标

- 让孩子清楚看到 07:00-21:00 一天时间的消耗进度。
- 用不同颜色任务块表示洗澡、写作业、吃饭、运动、收拾书包等事项。
- 任务块宽度按预计耗时比例展示。
- 固定任务，例如上学时间，固定占据时间轴。
- 弹性任务，例如写作业、洗澡、运动，可以调整顺序。
- 未被任务占据、也未被时间消耗的区域显示为蓝色荧光“自由时间”。
- 当剩余时间小于未完成任务总时长时，任务块进入挤压、发热、膨胀的紧迫状态。
- 任务超时未完成后，下沉到“超时任务”区域，提示补做。
- 支持 4 个孩子头像切换，每个孩子任务和进度独立。
- 提供家长后台，用于配置日常任务和今日任务。

## 技术方向

- 前端：HTML + CSS + JavaScript + PWA
- 后端：Node.js + Express
- 数据库：SQLite
- 部署：NAS Docker
- 访问：局域网 `http://NAS_IP:端口`，iPad 添加到主屏幕

## MVP 范围

第一阶段只做最小可用闭环：

1. iPad 横屏儿童端静态界面
2. 07:00-21:00 动态时间条
3. 固定任务 + 弹性任务 + 自由时间计算
4. 点击完成任务
5. 超时任务下沉
6. 4 个孩子独立数据
7. 简单家长后台
8. NAS Docker 部署

## 非目标

第一版暂不做：

- 账号系统
- 云同步
- 商业化权限
- 复杂报表
- 多设备冲突处理
- 精确到分钟的复杂日历拖拽

## 工作流要求

所有开发必须遵守：

1. 无 Issue 不开发。
2. 不直接修改 main。
3. 每个 Issue 创建独立分支。
4. 每个 PR 只解决一个 Issue。
5. PR 必须写清楚改动范围、测试方法、风险点。
6. 通过 Review 后再合并。

推荐分支格式：

```txt
feat/issue-编号-简短描述
fix/issue-编号-简短描述
```

## 本地启动

```bash
# 1. 安装依赖
npm install

# 2. 启动前后端（后端 3000 端口 + 前端静态服务 8080 端口）
npm run dev

# 3. 打开浏览器
open http://localhost:8080
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动前端（8080）和后端（3000） |
| `npm run start` | 仅启动后端（3000） |
| `npm run serve` | 仅启动前端静态服务（8080） |
| `npm run test` | 语法检查 |
| `npm run lint` | 代码规范检查（占位） |

## 详细开发指南

见：`docs/development-guide.md`

---

## NAS Docker 部署（群晖 Synology NAS）

### 系统要求

- Synology NAS 支持 Docker（套件中心安装 Docker）
- Node.js 22+ 镜像
- 建议 4GB+ RAM

### 快速部署

#### 方法一：Docker Compose（推荐）

```bash
# 1. SSH 登录 NAS
ssh admin@你的NAS_IP

# 2. 创建目录
mkdir -p ~/children-time && cd ~/children-time

# 3. 上传项目文件（或 git clone）
git clone https://github.com/bomdph-bot/children-time-pwa.git .

# 4. 启动容器
docker-compose up -d

# 5. 查看日志确认启动
docker-compose logs -f
```

#### 方法二：手动 Docker 命令

```bash
# 1. 构建镜像
docker build -t children-time-pwa .

# 2. 创建数据目录
mkdir -p ./data

# 3. 运行容器
docker run -d \
  --name children-time-pwa \
  -p 3000:3000 \
  -v $(pwd)/data:/app/backend/data \
  --restart unless-stopped \
  children-time-pwa
```

### 验证部署

部署完成后，访问以下地址确认服务正常：

| 检查项 | 地址 | 期望结果 |
|--------|------|----------|
| 健康检查 | `http://NAS_IP:3000/health` | `{"status":"ok",...}` |
| 儿童端 | `http://NAS_IP:3000/` | 儿童时间管理界面 |
| 家长后台 | `http://NAS_IP:3000/admin.html` | 家长登录界面 |

### 数据持久化

**重要**：SQLite 数据库文件存储在 `/app/backend/data`，通过 Docker volume 挂载持久化。

- 容器重启后数据不丢失
- 备份时只需备份 `backend/data/` 目录

```bash
# 备份数据库
cp ./data/children_time.db ./data/backup_$(date +%Y%m%d).db
```

### iPad 添加到主屏幕（PWA）

1. 用 iPad Safari 打开 `http://NAS_IP:3000`
2. 点击 Safari 工具栏的 **分享按钮**（方框+箭头）
3. 选择 **"添加到主屏幕"**
4. 确认后，桌面会出现 App 图标
5. 图标会横屏模式启动，进入全屏 PWA 体验

### 局域网访问注意事项

- 确保 NAS 防火墙允许 3000 端口入站
- 设备与 NAS 必须在同一局域网
- 推荐给 NAS 设置固定 IP（DHCP 保留）

### 更新部署

```bash
# 1. 拉取新代码
git pull origin main

# 2. 重新构建镜像
docker-compose build

# 3. 重启容器
docker-compose up -d
```

### Docker Compose 完整配置

```yaml
version: '3.8'
services:
  children-time:
    build: .
    container_name: children-time-pwa
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/backend/data
    environment:
      - NODE_ENV=production
      - PORT=3000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 页面打不开 | 端口未开放 | 在 NAS 防火墙/DSM 防火墙开放 3000 |
| 数据丢失 | volume 未挂载 | 检查 docker-compose volumes 配置 |
| 容器启动失败 | 端口被占用 | 改 ports 映射到其他端口如 `3001:3000` |
| API 请求失败 | CORS 问题 | 确认使用 `http://NAS_IP:3000` 而非 localhost |
