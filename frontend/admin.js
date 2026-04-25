/**
 * 家长后台 JS
 * 职责：PIN 登录、孩子管理、任务模板 CRUD
 */

const ADMIN_PIN_KEY = 'admin_pin';

// =====================
// 状态
// =====================
let loggedIn = false;
let children = [];
let templates = [];
let currentTemplateChildId = null;

// =====================
// DOM 引用
// =====================
const $loginPanel = document.getElementById('loginPanel');
const $adminPanel = document.getElementById('adminPanel');
const $loginForm = document.getElementById('loginForm');
const $pinInput = document.getElementById('pinInput');
const $loginError = document.getElementById('loginError');
const $logoutBtn = document.getElementById('logoutBtn');
const $tabBtns = document.querySelectorAll('.tab-btn');
const $childrenPanel = document.getElementById('childrenPanel');
const $templatesPanel = document.getElementById('templatesPanel');
const $childrenList = document.getElementById('childrenList');
const $templatesList = document.getElementById('templatesList');
const $templateChildSelect = document.getElementById('templateChildSelect');
const $addChildBtn = document.getElementById('addChildBtn');
const $addTemplateBtn = document.getElementById('addTemplateBtn');

// =====================
// Auth helper
// =====================
function getAuthHeader() {
  return { 'X-Admin-Pin': ADMIN_PIN };
}

// =====================
// 登录 / 登出
// =====================
$loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = $pinInput.value.trim();
  if (!pin) {
    $loginError.textContent = '请输入 PIN';
    return;
  }
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      sessionStorage.setItem(ADMIN_PIN_KEY, pin);
      loggedIn = true;
      showAdmin();
      loadChildren();
    } else {
      $loginError.textContent = data.error || 'PIN 错误';
      $pinInput.value = '';
      $pinInput.focus();
    }
  } catch (err) {
    $loginError.textContent = '网络错误，请重试';
  }
});

$logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(ADMIN_PIN_KEY);
  loggedIn = false;
  $loginPanel.style.display = 'flex';
  $adminPanel.style.display = 'none';
  $pinInput.value = '';
  $loginError.textContent = '';
});

// =====================
// Tab 切换
// =====================
$tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    $tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    if (tab === 'children') {
      $childrenPanel.style.display = 'block';
      $templatesPanel.style.display = 'none';
    } else {
      $childrenPanel.style.display = 'none';
      $templatesPanel.style.display = 'block';
      if (children.length > 0 && !currentTemplateChildId) {
        currentTemplateChildId = children[0].id;
      }
      loadTemplates(currentTemplateChildId);
    }
  });
});

// =====================
// 孩子 CRUD
// =====================
async function loadChildren() {
  try {
    const res = await fetch('/api/admin/children', { headers: getAuthHeader() });
    if (res.status === 401) { handleAuthFail(); return; }
    children = await res.json();
    renderChildren();
    renderTemplateChildSelect();
  } catch (err) {
    console.error('loadChildren error:', err);
  }
}

function renderChildren() {
  if (!children.length) {
    $childrenList.innerHTML = '<div class="empty-state">暂无孩子，请点击"新增孩子"添加</div>';
    return;
  }
  $childrenList.innerHTML = children.map(child => `
    <div class="child-card">
      <div class="child-avatar">${child.avatar || '🧒'}</div>
      <div class="child-info">
        <h3>${child.name}</h3>
        <span>ID: ${child.id}</span>
      </div>
      <div class="child-actions">
        <button class="btn-edit" onclick="editChild('${child.id}')">编辑</button>
        <button class="btn-danger" onclick="deleteChild('${child.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

function renderTemplateChildSelect() {
  $templateChildSelect.innerHTML = children.map(child =>
    `<option value="${child.id}">${child.avatar || '🧒'} ${child.name}</option>`
  ).join('');
  if (children.length > 0) {
    $templateChildSelect.value = currentTemplateChildId || children[0].id;
  }
}

$addChildBtn.addEventListener('click', () => openChildModal());

window.editChild = function(id) {
  const child = children.find(c => c.id === id);
  if (!child) return;
  openChildModal(child);
};

window.deleteChild = async function(id) {
  if (!confirm('确定删除？该孩子的所有任务模板和每日任务也会被删除。')) return;
  try {
    const res = await fetch(`/api/admin/children/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    });
    if (res.status === 401) { handleAuthFail(); return; }
    await loadChildren();
    if (currentTemplateChildId === id && children.length > 0) {
      currentTemplateChildId = children[0].id;
      $templateChildSelect.value = currentTemplateChildId;
      loadTemplates(currentTemplateChildId);
    }
  } catch (err) {
    console.error('deleteChild error:', err);
  }
};

// =====================
// 模板 CRUD
// =====================
$templateChildSelect.addEventListener('change', () => {
  currentTemplateChildId = $templateChildSelect.value;
  loadTemplates(currentTemplateChildId);
});

$addTemplateBtn.addEventListener('click', () => {
  if (!currentTemplateChildId) {
    alert('请先选择一个孩子');
    return;
  }
  openTemplateModal(null, currentTemplateChildId);
});

async function loadTemplates(childId) {
  if (!childId) return;
  try {
    const res = await fetch(`/api/admin/children/${childId}/templates`, { headers: getAuthHeader() });
    if (res.status === 401) { handleAuthFail(); return; }
    templates = await res.json();
    renderTemplates();
  } catch (err) {
    console.error('loadTemplates error:', err);
  }
}

function renderTemplates() {
  if (!templates.length) {
    $templatesList.innerHTML = '<div class="empty-state">暂无任务模板，请点击"新增模板"添加</div>';
    return;
  }
  $templatesList.innerHTML = templates.map(t => {
    const typeLabel = t.type === 'fixed' ? '固定' : '弹性';
    const typeClass = t.type === 'fixed' ? 'badge-fixed' : 'badge-flexible';
    const timeInfo = t.type === 'fixed'
      ? `${fmtMins(t.fixed_start_minutes)} - ${fmtMins(t.fixed_end_minutes)}`
      : `${t.duration_minutes || 0} 分钟`;
    return `
    <div class="template-card${t.enabled ? '' : ' disabled'}">
      <div class="template-icon">${t.icon || '📋'}</div>
      <div class="template-info">
        <h4>${t.title}</h4>
        <span>
          <span class="template-badge ${typeClass}">${typeLabel}</span>
          ${timeInfo}
          ${t.enabled ? '' : '（已停用）'}
        </span>
      </div>
      <div class="template-actions">
        <button class="btn-edit" onclick="editTemplate('${t.id}')">编辑</button>
        <button class="btn-danger" onclick="deleteTemplate('${t.id}')">删除</button>
      </div>
    </div>
  `}).join('');
}

function fmtMins(mins) {
  if (mins == null) return '--:--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

window.editTemplate = function(id) {
  const t = templates.find(t => t.id === id);
  if (!t) return;
  openTemplateModal(t, t.child_id);
};

window.deleteTemplate = async function(id) {
  if (!confirm('确定删除该任务模板？')) return;
  try {
    const res = await fetch(`/api/admin/templates/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    });
    if (res.status === 401) { handleAuthFail(); return; }
    await loadTemplates(currentTemplateChildId);
  } catch (err) {
    console.error('deleteTemplate error:', err);
  }
};

// =====================
// 弹窗处理 - 孩子
// =====================
const $childModal = document.getElementById('childModal');
const $childForm = document.getElementById('childForm');
const $childModalTitle = document.getElementById('childModalTitle');
const $childModalCancel = document.getElementById('childModalCancel');

function openChildModal(child) {
  $childModalTitle.textContent = child ? '编辑孩子' : '新增孩子';
  document.getElementById('childForm_id').value = child ? child.id : '';
  document.getElementById('childForm_name').value = child ? child.name : '';
  document.getElementById('childForm_avatar').value = child ? (child.avatar || '') : '';
  document.getElementById('childForm_theme').value = child ? (child.theme || 'blue') : 'blue';
  $childModal.style.display = 'flex';
}

$childModalCancel.addEventListener('click', () => { $childModal.style.display = 'none'; });
$childModal.addEventListener('click', (e) => { if (e.target === $childModal) $childModal.style.display = 'none'; });

$childForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('childForm_id').value;
  const name = document.getElementById('childForm_name').value.trim();
  const avatar = document.getElementById('childForm_avatar').value.trim();
  const theme = document.getElementById('childForm_theme').value;
  if (!name) { alert('名称不能为空'); return; }

  const payload = { name, avatar, theme };
  try {
    let res;
    if (id) {
      res = await fetch(`/api/admin/children/${id}`, {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/admin/children', {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    if (res.status === 401) { handleAuthFail(); return; }
    $childModal.style.display = 'none';
    await loadChildren();
    // 如果是新增，切换到模板面板并选中该孩子
    if (!id && children.length > 0) {
      currentTemplateChildId = children[children.length - 1].id;
      document.querySelector('[data-tab="templates"]').click();
    }
  } catch (err) {
    console.error('childForm submit error:', err);
  }
});

// =====================
// 弹窗处理 - 模板
// =====================
const $templateModal = document.getElementById('templateModal');
const $templateForm = document.getElementById('templateForm');
const $templateModalTitle = document.getElementById('templateModalTitle');
const $templateModalCancel = document.getElementById('templateModalCancel');
const $typeSelect = document.getElementById('templateForm_type');
const $durationGroup = document.getElementById('durationGroup');
const $fixedTimeGroup = document.getElementById('fixedTimeGroup');
const $fixedEndGroup = document.getElementById('fixedEndGroup');

$typeSelect.addEventListener('change', () => {
  const isFixed = $typeSelect.value === 'fixed';
  $durationGroup.style.display = isFixed ? 'none' : 'block';
  $fixedTimeGroup.style.display = isFixed ? 'block' : 'none';
  $fixedEndGroup.style.display = isFixed ? 'block' : 'none';
});

function openTemplateModal(template, childId) {
  $templateModalTitle.textContent = template ? '编辑任务模板' : '新增任务模板';
  document.getElementById('templateForm_id').value = template ? template.id : '';
  document.getElementById('templateForm_title').value = template ? template.title : '';
  $typeSelect.value = template ? template.type : 'flexible';

  // 触发 type change 以便正确显示字段
  $typeSelect.dispatchEvent(new Event('change'));

  document.getElementById('templateForm_category').value = template ? template.category : 'life';
  document.getElementById('templateForm_duration_minutes').value = template ? (template.duration_minutes || '') : '';
  if (template) {
    if (template.fixed_start_minutes != null) {
      document.getElementById('templateForm_fixed_start_hour').value = Math.floor(template.fixed_start_minutes / 60);
      document.getElementById('templateForm_fixed_start_min').value = template.fixed_start_minutes % 60;
    }
    if (template.fixed_end_minutes != null) {
      document.getElementById('templateForm_fixed_end_hour').value = Math.floor(template.fixed_end_minutes / 60);
      document.getElementById('templateForm_fixed_end_min').value = template.fixed_end_minutes % 60;
    }
  } else {
    document.getElementById('templateForm_fixed_start_hour').value = '';
    document.getElementById('templateForm_fixed_start_min').value = '';
    document.getElementById('templateForm_fixed_end_hour').value = '';
    document.getElementById('templateForm_fixed_end_min').value = '';
  }
  document.getElementById('templateForm_color').value = template ? template.color : '#4A90D9';
  document.getElementById('templateForm_icon').value = template ? (template.icon || '') : '';
  document.getElementById('templateForm_sort_order').value = template ? (template.sort_order || '') : '';
  document.getElementById('templateForm_enabled').checked = template ? !!template.enabled : true;
  $templateModal.dataset.childId = childId;
  $templateModal.style.display = 'flex';
}

$templateModalCancel.addEventListener('click', () => { $templateModal.style.display = 'none'; });
$templateModal.addEventListener('click', (e) => { if (e.target === $templateModal) $templateModal.style.display = 'none'; });

$templateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('templateForm_id').value;
  const title = document.getElementById('templateForm_title').value.trim();
  const type = document.getElementById('templateForm_type').value;
  const category = document.getElementById('templateForm_category').value;
  const color = document.getElementById('templateForm_color').value;
  const icon = document.getElementById('templateForm_icon').value.trim();
  const duration_minutes = document.getElementById('templateForm_duration_minutes').value ? parseInt(document.getElementById('templateForm_duration_minutes').value) : null;
  const sort_order = document.getElementById('templateForm_sort_order').value ? parseInt(document.getElementById('templateForm_sort_order').value) : undefined;
  const enabled = document.getElementById('templateForm_enabled').checked;

  let fixed_start_minutes = null;
  let fixed_end_minutes = null;
  if (type === 'fixed') {
    const sh = parseInt(document.getElementById('templateForm_fixed_start_hour').value) || 0;
    const sm = parseInt(document.getElementById('templateForm_fixed_start_min').value) || 0;
    const eh = parseInt(document.getElementById('templateForm_fixed_end_hour').value) || 0;
    const em = parseInt(document.getElementById('templateForm_fixed_end_min').value) || 0;
    fixed_start_minutes = sh * 60 + sm;
    fixed_end_minutes = eh * 60 + em;
  }

  const payload = { title, type, category, color, icon, duration_minutes, fixed_start_minutes, fixed_end_minutes, sort_order, enabled };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      const childId = $templateModal.dataset.childId;
      res = await fetch(`/api/admin/children/${childId}/templates`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    if (res.status === 401) { handleAuthFail(); return; }
    $templateModal.style.display = 'none';
    await loadTemplates(currentTemplateChildId);
  } catch (err) {
    console.error('templateForm submit error:', err);
  }
});

// =====================
// Auth 失败处理
// =====================
function handleAuthFail() {
  sessionStorage.removeItem(ADMIN_PIN_KEY);
  loggedIn = false;
  $loginPanel.style.display = 'flex';
  $adminPanel.style.display = 'none';
  $loginError.textContent = '登录已过期，请重新登录';
  $pinInput.value = '';
}

// =====================
// 初始化
// =====================
function init() {
  // 检查 sessionStorage 是否有保存的 PIN
  const savedPin = sessionStorage.getItem(ADMIN_PIN_KEY);
  if (savedPin) {
    // 自动验证保存的 PIN
    (async () => {
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: savedPin }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          loggedIn = true;
          showAdmin();
          loadChildren();
        }
      } catch (err) {
        // 网络错误，显示登录页
        $loginPanel.style.display = 'flex';
      }
    })();
  } else {
    $loginPanel.style.display = 'flex';
  }
}

function showAdmin() {
  $loginPanel.style.display = 'none';
  $adminPanel.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', init);