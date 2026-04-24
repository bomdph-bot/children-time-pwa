// =============================================
// Children Time PWA - Admin Frontend
// =============================================

const API_BASE = window.location.origin.replace(/:\d+$/, ':3000');
const SESSION_KEY = 'admin_session_id';

// ============ STATE ============
let children = [];
let templates = [];
let currentChildId = null;
let sessionId = null;

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  // Check existing session
  sessionId = localStorage.getItem(SESSION_KEY);
  
  if (sessionId) {
    showAdminPage();
  } else {
    showLoginPage();
  }
  
  initEventListeners();
});

// ============ EVENT LISTENERS ============
function initEventListeners() {
  // Login
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('pinInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Add child
  document.getElementById('addChildBtn').addEventListener('click', () => openChildModal());
  
  // Add template
  document.getElementById('addTemplateBtn').addEventListener('click', () => openTemplateModal());
  
  // Template child selector
  document.getElementById('templateChildSelect').addEventListener('change', (e) => {
    currentChildId = e.target.value;
    if (currentChildId) {
      loadTemplates(currentChildId);
      document.getElementById('templateActions').style.display = 'block';
      document.getElementById('templatesEmpty').style.display = 'none';
    } else {
      document.getElementById('templateActions').style.display = 'none';
      document.getElementById('templatesList').innerHTML = '';
      document.getElementById('templatesEmpty').style.display = 'block';
    }
  });
  
  // Child modal
  document.getElementById('childModalClose').addEventListener('click', closeChildModal);
  document.getElementById('childCancelBtn').addEventListener('click', closeChildModal);
  document.getElementById('childForm').addEventListener('submit', handleChildSubmit);
  
  // Avatar selector
  document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('childAvatar').value = opt.dataset.avatar;
    });
  });
  
  // Theme selector
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('childTheme').value = opt.dataset.theme;
    });
  });
  
  // Template modal
  document.getElementById('templateModalClose').addEventListener('click', closeTemplateModal);
  document.getElementById('templateCancelBtn').addEventListener('click', closeTemplateModal);
  document.getElementById('templateForm').addEventListener('submit', handleTemplateSubmit);
  
  // Task type change
  document.getElementById('templateType').addEventListener('change', (e) => {
    const type = e.target.value;
    document.getElementById('flexibleFields').style.display = type === 'flexible' ? 'block' : 'none';
    document.getElementById('fixedFields').style.display = type === 'fixed' ? 'block' : 'none';
  });
  
  // Icon selector
  document.querySelectorAll('.icon-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('templateIcon').value = opt.dataset.icon;
    });
  });
  
  // Color selector
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('templateColor').value = opt.dataset.color;
    });
  });
  
  // Close modal on backdrop click
  document.getElementById('childModal').addEventListener('click', (e) => {
    if (e.target.id === 'childModal') closeChildModal();
  });
  document.getElementById('templateModal').addEventListener('click', (e) => {
    if (e.target.id === 'templateModal') closeTemplateModal();
  });
}

// ============ AUTH ============

async function handleLogin() {
  const pin = document.getElementById('pinInput').value;
  const errorEl = document.getElementById('loginError');
  
  if (!pin) {
    errorEl.textContent = '请输入 PIN';
    errorEl.style.display = 'block';
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      errorEl.textContent = data.error || '登录失败';
      errorEl.style.display = 'block';
      return;
    }
    
    sessionId = data.sessionId;
    localStorage.setItem(SESSION_KEY, sessionId);
    showAdminPage();
  } catch (err) {
    errorEl.textContent = '网络错误，请稍后重试';
    errorEl.style.display = 'block';
  }
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId }
    });
  } catch (err) {
    console.error('Logout error:', err);
  }
  
  sessionId = null;
  localStorage.removeItem(SESSION_KEY);
  showLoginPage();
}

// ============ UI HELPERS ============

function showLoginPage() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('adminPage').style.display = 'none';
  document.getElementById('pinInput').value = '';
  document.getElementById('loginError').style.display = 'none';
}

function showAdminPage() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('adminPage').style.display = 'block';
  
  loadChildren();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  
  document.getElementById('childrenTab').style.display = tab === 'children' ? 'block' : 'none';
  document.getElementById('templatesTab').style.display = tab === 'templates' ? 'block' : 'none';
  
  if (tab === 'children') {
    loadChildren();
  } else {
    // Populate child selector for templates tab
    populateTemplateChildSelect();
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// ============ API CALLS ============

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Session-Id': sessionId
  };
}

async function loadChildren() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/children`, {
      headers: getHeaders()
    });
    
    if (res.status === 401) {
      showLoginPage();
      return;
    }
    
    children = await res.json();
    renderChildren();
  } catch (err) {
    console.error('loadChildren error:', err);
    showToast('加载孩子列表失败', 'error');
  }
}

async function createChild(data) {
  const res = await fetch(`${API_BASE}/api/admin/children`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '创建失败');
  }
  
  return res.json();
}

async function updateChild(childId, data) {
  const res = await fetch(`${API_BASE}/api/admin/children/${childId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '更新失败');
  }
  
  return res.json();
}

async function deleteChild(childId) {
  const res = await fetch(`${API_BASE}/api/admin/children/${childId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '删除失败');
  }
  
  return res.json();
}

async function loadTemplates(childId) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/children/${childId}/templates`, {
      headers: getHeaders()
    });
    
    if (res.status === 401) {
      showLoginPage();
      return;
    }
    
    templates = await res.json();
    renderTemplates();
  } catch (err) {
    console.error('loadTemplates error:', err);
    showToast('加载任务模板失败', 'error');
  }
}

async function createTemplate(childId, data) {
  const res = await fetch(`${API_BASE}/api/admin/children/${childId}/templates`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '创建失败');
  }
  
  return res.json();
}

async function updateTemplate(templateId, data) {
  const res = await fetch(`${API_BASE}/api/admin/templates/${templateId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '更新失败');
  }
  
  return res.json();
}

async function deleteTemplate(templateId) {
  const res = await fetch(`${API_BASE}/api/admin/templates/${templateId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '删除失败');
  }
  
  return res.json();
}

// ============ RENDER ============

function renderChildren() {
  const list = document.getElementById('childrenList');
  
  if (children.length === 0) {
    list.innerHTML = '<div class="child-empty">暂无孩子，点击上方按钮添加</div>';
    return;
  }
  
  list.innerHTML = children.map(child => `
    <div class="child-card" data-child-id="${child.id}">
      <div class="child-avatar">${child.avatar}</div>
      <div class="child-info">
        <div class="child-name">${child.name}</div>
        <div class="child-meta">主题：${getThemeName(child.theme)}</div>
      </div>
      <div class="child-actions">
        <button class="child-action-btn edit-btn" title="编辑" onclick="editChild('${child.id}')">✏️</button>
        <button class="child-action-btn delete-btn" title="删除" onclick="confirmDeleteChild('${child.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function getThemeName(theme) {
  const names = { starry: '梦幻星空', ocean: '海洋', forest: '森林' };
  return names[theme] || theme;
}

function renderTemplates() {
  const list = document.getElementById('templatesList');
  
  if (templates.length === 0) {
    list.innerHTML = '<div class="child-empty">暂无任务模板，点击上方按钮添加</div>';
    return;
  }
  
  list.innerHTML = templates.map(t => {
    const isEnabled = t.enabled === 1 || t.enabled === true;
    const typeBadge = !isEnabled ? '<span class="template-badge disabled">已停用</span>' : 
      `<span class="template-badge ${t.type}">${t.type === 'fixed' ? '固定' : '弹性'}</span>`;
    
    let meta = '';
    if (t.type === 'flexible') {
      meta = `时长：${t.duration_minutes}分钟`;
    } else {
      meta = `${minutesToTime(t.fixed_start_minutes)} - ${minutesToTime(t.fixed_end_minutes)}`;
    }
    
    return `
      <div class="template-card" data-template-id="${t.id}">
        <div class="template-icon" style="background: ${t.color}30;">${t.icon}</div>
        <div class="template-info">
          <div class="template-title">
            ${t.title}
            ${typeBadge}
          </div>
          <div class="template-meta">${meta}</div>
        </div>
        <div class="template-actions">
          <button class="template-action-btn ${isEnabled ? 'disable-btn' : 'enable-btn'}" 
                  title="${isEnabled ? '停用' : '启用'}"
                  onclick="toggleTemplate('${t.id}', ${!isEnabled})">
            ${isEnabled ? '⏸️' : '▶️'}
          </button>
          <button class="template-action-btn edit-btn" title="编辑" onclick="editTemplate('${t.id}')">✏️</button>
          <button class="template-action-btn delete-btn" title="删除" onclick="confirmDeleteTemplate('${t.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function minutesToTime(minutes) {
  if (minutes === null || minutes === undefined) return '--:--';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function populateTemplateChildSelect() {
  const select = document.getElementById('templateChildSelect');
  const current = select.value;
  
  select.innerHTML = '<option value="">-- 请选择孩子 --</option>' +
    children.map(c => `<option value="${c.id}">${c.avatar} ${c.name}</option>`).join('');
  
  // Reset template view
  currentChildId = null;
  document.getElementById('templateActions').style.display = 'none';
  document.getElementById('templatesList').innerHTML = '';
  document.getElementById('templatesEmpty').style.display = 'block';
}

// ============ CHILD MODAL ============

function openChildModal(childId = null) {
  const modal = document.getElementById('childModal');
  const title = document.getElementById('childModalTitle');
  
  document.getElementById('childForm').reset();
  document.getElementById('childId').value = '';
  
  // Reset selectors
  document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('.avatar-option[data-avatar="👦"]').classList.add('selected');
  document.getElementById('childAvatar').value = '👦';
  
  document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('.theme-option[data-theme="starry"]').classList.add('selected');
  document.getElementById('childTheme').value = 'starry';
  
  if (childId) {
    const child = children.find(c => c.id === childId);
    if (child) {
      title.textContent = '编辑孩子';
      document.getElementById('childId').value = child.id;
      document.getElementById('childName').value = child.name;
      document.getElementById('childAvatar').value = child.avatar;
      
      document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      document.querySelector(`.avatar-option[data-avatar="${child.avatar}"]`)?.classList.add('selected');
      
      document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('selected'));
      document.querySelector(`.theme-option[data-theme="${child.theme}"]`)?.classList.add('selected');
      document.getElementById('childTheme').value = child.theme;
    }
  } else {
    title.textContent = '添加孩子';
  }
  
  modal.style.display = 'flex';
}

function closeChildModal() {
  document.getElementById('childModal').style.display = 'none';
}

async function handleChildSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('childId').value;
  const data = {
    name: document.getElementById('childName').value.trim(),
    avatar: document.getElementById('childAvatar').value,
    theme: document.getElementById('childTheme').value
  };
  
  try {
    if (id) {
      await updateChild(id, data);
      showToast('更新成功');
    } else {
      await createChild(data);
      showToast('添加成功');
    }
    
    closeChildModal();
    loadChildren();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function editChild(childId) {
  openChildModal(childId);
}

function confirmDeleteChild(childId) {
  const child = children.find(c => c.id === childId);
  if (!child) return;
  
  if (!confirm(`确定要删除"${child.name}"吗？\n这将同时删除该孩子的所有任务模板。`)) {
    return;
  }
  
  deleteChild(childId).then(() => {
    showToast('删除成功');
    loadChildren();
  }).catch(err => {
    showToast(err.message, 'error');
  });
}

// ============ TEMPLATE MODAL ============

function openTemplateModal(templateId = null) {
  const modal = document.getElementById('templateModal');
  const title = document.getElementById('templateModalTitle');
  
  document.getElementById('templateForm').reset();
  document.getElementById('templateId').value = '';
  document.getElementById('templateChildId').value = currentChildId;
  
  // Reset selectors
  document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('.icon-option[data-icon="📋"]').classList.add('selected');
  document.getElementById('templateIcon').value = '📋';
  
  document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('.color-option[data-color="#4A90D9"]').classList.add('selected');
  document.getElementById('templateColor').value = '#4A90D9';
  
  // Default type
  document.getElementById('templateType').value = 'flexible';
  document.getElementById('flexibleFields').style.display = 'block';
  document.getElementById('fixedFields').style.display = 'none';
  
  if (templateId) {
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl) {
      title.textContent = '编辑任务';
      document.getElementById('templateId').value = tmpl.id;
      document.getElementById('templateTitle').value = tmpl.title;
      document.getElementById('templateType').value = tmpl.type;
      document.getElementById('templateCategory').value = tmpl.category || 'general';
      document.getElementById('templateDuration').value = tmpl.duration_minutes || '';
      
      if (tmpl.fixed_start_minutes !== null) {
        document.getElementById('templateFixedStart').value = minutesToTime(tmpl.fixed_start_minutes);
      }
      if (tmpl.fixed_end_minutes !== null) {
        document.getElementById('templateFixedEnd').value = minutesToTime(tmpl.fixed_end_minutes);
      }
      
      // Show correct fields
      document.getElementById('flexibleFields').style.display = tmpl.type === 'flexible' ? 'block' : 'none';
      document.getElementById('fixedFields').style.display = tmpl.type === 'fixed' ? 'block' : 'none';
      
      // Icon
      document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      document.querySelector(`.icon-option[data-icon="${tmpl.icon}"]`)?.classList.add('selected');
      document.getElementById('templateIcon').value = tmpl.icon || '📋';
      
      // Color
      document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      document.querySelector(`.color-option[data-color="${tmpl.color}"]`)?.classList.add('selected');
      document.getElementById('templateColor').value = tmpl.color || '#4A90D9';
    }
  } else {
    title.textContent = '添加任务';
  }
  
  modal.style.display = 'flex';
}

function closeTemplateModal() {
  document.getElementById('templateModal').style.display = 'none';
}

function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

async function handleTemplateSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('templateId').value;
  const childId = document.getElementById('templateChildId').value;
  const type = document.getElementById('templateType').value;
  
  const data = {
    title: document.getElementById('templateTitle').value.trim(),
    type: type,
    category: document.getElementById('templateCategory').value,
    icon: document.getElementById('templateIcon').value,
    color: document.getElementById('templateColor').value
  };
  
  if (type === 'flexible') {
    const duration = parseInt(document.getElementById('templateDuration').value);
    if (!duration || duration <= 0) {
      showToast('请输入有效的时长', 'error');
      return;
    }
    data.duration_minutes = duration;
  } else {
    const start = timeToMinutes(document.getElementById('templateFixedStart').value);
    const end = timeToMinutes(document.getElementById('templateFixedEnd').value);
    if (!start || !end) {
      showToast('请输入有效的开始和结束时间', 'error');
      return;
    }
    data.fixed_start_minutes = start;
    data.fixed_end_minutes = end;
  }
  
  try {
    if (id) {
      await updateTemplate(id, data);
      showToast('更新成功');
    } else {
      await createTemplate(childId, data);
      showToast('添加成功');
    }
    
    closeTemplateModal();
    loadTemplates(childId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function editTemplate(templateId) {
  openTemplateModal(templateId);
}

function confirmDeleteTemplate(templateId) {
  const tmpl = templates.find(t => t.id === templateId);
  if (!tmpl) return;
  
  if (!confirm(`确定要删除"${tmpl.title}"吗？`)) {
    return;
  }
  
  deleteTemplate(templateId).then(() => {
    showToast('删除成功');
    loadTemplates(currentChildId);
  }).catch(err => {
    showToast(err.message, 'error');
  });
}

function toggleTemplate(templateId, enabled) {
  updateTemplate(templateId, { enabled }).then(() => {
    showToast(enabled ? '已启用' : '已停用');
    loadTemplates(currentChildId);
  }).catch(err => {
    showToast(err.message, 'error');
  });
}

// Make functions globally accessible
window.editChild = editChild;
window.confirmDeleteChild = confirmDeleteChild;
window.editTemplate = editTemplate;
window.confirmDeleteTemplate = confirmDeleteTemplate;
window.toggleTemplate = toggleTemplate;
