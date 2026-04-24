/**
 * 儿童时间小管家 - 前端入口
 * MVP 阶段使用原生 JavaScript，无重型框架依赖。
 */

(function () {
  "use strict";

  const API_BASE = window.location.origin;

  async function api(path, options = {}) {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
  }

  function init() {
    console.log("[App] 儿童时间小管家初始化完成");
  }

  init();
})();
