/**
 * 后端服务入口
 * Node.js + Express，最小可运行骨架。
 */

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());

// 静态文件服务（前端）
app.use(express.static("frontend"));

// TODO: 数据库初始化（SQLite）
// const db = require("./db");
// db.init();

// API 路由占位
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// children 相关 API（占位）
app.get("/api/children", (req, res) => {
  res.json([]);
});

// daily tasks 占位
app.get("/api/children/:childId/today", (req, res) => {
  res.json({ childId: req.params.childId, tasks: [] });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`[Server] 运行在 http://localhost:${PORT}`);
  console.log(`[Server] 前端静态文件: frontend/`);
});

module.exports = app;
