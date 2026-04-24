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

## 详细开发指南

见：`docs/development-guide.md`

## 部署

### 本地开发

```bash
npm install
npm start
```

访问：`http://localhost:3000`
儿童端：`http://localhost:3000`
家长后台：`http://localhost:3000/admin.html`

### Docker 部署

#### 本地 Docker

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

#### 群晖 NAS（Synology DSM）

1. **安装 Docker 套件**
   - 打开"套件中心" → 搜索 "Docker" → 安装

2. **上传项目文件**
   - 通过 File Station 或 SCP 上传项目到 NAS，例如：`/docker/children-time-pwa/`

3. **启动容器**
   SSH 到 NAS（以 admin 身份），执行：

   ```bash
   cd /volume1/docker/children-time-pwa
   sudo docker-compose up -d
   ```

   或使用 Docker Compose v2（DSM 7+）：
   ```bash
   cd /volume1/docker/children-time-pwa
   sudo docker compose up -d
   ```

4. **访问服务**
   - 儿童端：`http://<NAS_IP>:3000`
   - 家长后台：`http://<NAS_IP>:3000/admin.html`
   - 默认 PIN：`123456`

5. **添加 PWA 到 iPad 主屏幕**
   - 用 iPad Safari 打开 `http://<NAS_IP>:3000`
   - 点击 Safari 分享按钮 → "添加到主屏幕"
   - 选择"横屏"方向，获得最佳体验

#### NAS 注意事项

- **API 地址**：前端会自动检测当前域名，无需配置
- **数据持久化**：`docker-compose.yml` 中 `backend/data` 目录已挂载为 named volume，容器重启后数据不丢
- **端口冲突**：如 3000 端口被占用，修改 `docker-compose.yml` 中的 `ports` 映射
- **开机自启**：容器已设置 `restart: unless-stopped`，NAS 重启后会自动恢复

#### 验证部署

```bash
# 检查容器状态
docker ps

# 检查健康状态
curl http://localhost:3000/health
# 预期返回: {"status":"ok","timestamp":"..."}

# 查看日志
docker logs children-time-pwa
```

#### 升级

```bash
cd /path/to/children-time-pwa
git pull  # 拉取新代码
docker-compose build
docker-compose up -d
```
