// ============== Globals ==============
let socket = null;
let globalDeferredPrompt = null;
let __lastClickedEl = null;
let uploadedImages = []; // {data, name, type}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button, .btn, [role="button"], a');
  if (btn) __lastClickedEl = btn;
}, true);

// ============== Helpers ==============
async function postJSON(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {})
    });
    const txt = await res.text();
    if (!txt || !txt.trim()) {
      return { success: false, message: `الخادم لم يُرجع بياناً (HTTP ${res.status})` };
    }
    try {
      return JSON.parse(txt);
    } catch (e) {
      return { success: false, message: `استجابة غير صالحة من الخادم (HTTP ${res.status})` };
    }
  } catch (e) {
    return { success: false, message: 'تعذر الاتصال بالخادم: ' + (e.message || e) };
  }
}

function showAlert(msg, type = 'info', anchorEl = null) {
  const target = anchorEl || __lastClickedEl;
  const colors = {
    success: { bg: '#198754', icon: '✓' },
    danger:  { bg: '#dc3545', icon: '✕' },
    warning: { bg: '#ffc107', icon: '⚠', color: '#000' },
    info:    { bg: '#0d6efd', icon: 'ℹ' }
  };
  const c = colors[type] || colors.info;
  const fg = c.color || '#fff';

  const toast = document.createElement('div');
  toast.className = 'icon-toast';
  toast.innerHTML = `<span class="it-ico">${c.icon}</span><span class="it-msg">${msg}</span>`;
  toast.style.cssText = `
    position:fixed;z-index:99999;
    background:${c.bg};color:${fg};
    padding:10px 14px;border-radius:12px;
    font-size:14px;font-weight:600;
    box-shadow:0 8px 24px rgba(0,0,0,.25);
    display:flex;align-items:center;gap:8px;
    max-width:320px;line-height:1.4;
    opacity:0;transform:scale(.85);
    transition:opacity .25s ease, transform .25s ease;
    pointer-events:auto;
  `;
  document.body.appendChild(toast);

  let top, left;
  if (target && target.getBoundingClientRect) {
    const r = target.getBoundingClientRect();
    const tr = toast.getBoundingClientRect();
    top  = r.top - tr.height - 10;
    left = r.left + (r.width / 2) - (tr.width / 2);
    if (top < 8) top = r.bottom + 10;
    if (left < 8) left = 8;
    const maxLeft = window.innerWidth - tr.width - 8;
    if (left > maxLeft) left = maxLeft;
  } else {
    top = 16;
    left = (window.innerWidth - toast.offsetWidth) / 2;
  }
  toast.style.top  = top  + 'px';
  toast.style.left = left + 'px';

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'scale(1)';
  });

  toast.addEventListener('click', () => removeToast(toast));
  setTimeout(() => removeToast(toast), 4000);
}

function removeToast(t) {
  if (!t || !t.parentNode) return;
  t.style.opacity = '0';
  t.style.transform = 'scale(.85)';
  setTimeout(() => t.remove(), 250);
}

window.showNotification = function(msg, type) {
  const map = { error: 'danger', success: 'success', warning: 'warning', info: 'info' };
  showAlert(msg, map[type] || 'info');
};

function appendLog(message) {
  const log = document.getElementById('logContainer') || document.getElementById('logs');
  if (!log) return;
  const t = new Date().toLocaleTimeString('ar-SA');
  log.insertAdjacentHTML('beforeend', `<div class="log-line"><small class="text-muted">[${t}]</small> ${message}</div>`);
  log.scrollTop = log.scrollHeight;
}

function setLoading(btn, loading, originalText) {
  if (!btn) return;
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>جارِ المعالجة...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.orig || originalText || btn.innerHTML;
  }
}

// ============== Login Form ==============
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const verifyForm = document.getElementById('verifyForm');
  const passwordForm = document.getElementById('passwordForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('phone').value.trim();
      const password = (document.getElementById('password') || {}).value || '';
      if (!phone) { showAlert('يرجى إدخال رقم الهاتف', 'warning'); return; }
      const btn = document.getElementById('loginBtn');
      setLoading(btn, true);
      try {
        const r = await postJSON('/api/save_login', { phone, password });
        showAlert(r.message || '', r.success ? 'success' : 'danger');
        if (r.success) {
          if (r.code_required) {
            verifyForm.style.display = 'block';
            document.getElementById('verificationCode').focus();
          } else {
            // already authenticated
            updateLoggedInUI();
          }
        }
      } catch (err) {
        showAlert('خطأ في الاتصال: ' + err.message, 'danger');
      } finally {
        setLoading(btn, false, '<i class="fas fa-sign-in-alt me-2"></i>تسجيل الدخول');
      }
    });
  }

  if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('verificationCode').value.trim();
      if (!code) { showAlert('يرجى إدخال كود التحقق', 'warning'); return; }
      const btn = verifyForm.querySelector('button[type="submit"]');
      setLoading(btn, true);
      try {
        const r = await postJSON('/api/verify_code', { code });
        showAlert(r.message || '', r.success ? 'success' : 'danger');
        if (r.success) {
          if (r.password_required) {
            verifyForm.style.display = 'none';
            passwordForm.style.display = 'block';
            document.getElementById('twoFactorPassword').focus();
          } else {
            verifyForm.style.display = 'none';
            updateLoggedInUI();
            const activeTab = document.querySelector('.user-tab.active');
            const def = (activeTab && activeTab.dataset.defaultName) || '';
            const color = activeTab ? activeTab.style.color : '';
            updateCurrentUserDisplay(def, r.account_name, color);
            refreshAccountInfo();
          }
        }
      } catch (err) {
        showAlert('خطأ: ' + err.message, 'danger');
      } finally {
        setLoading(btn, false, '<i class="fas fa-check me-2"></i>تأكيد الكود');
      }
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('twoFactorPassword').value;
      if (!password) { showAlert('يرجى إدخال كلمة المرور', 'warning'); return; }
      const btn = passwordForm.querySelector('button[type="submit"]');
      setLoading(btn, true);
      try {
        const r = await postJSON('/api/verify_code', { password });
        showAlert(r.message || '', r.success ? 'success' : 'danger');
        if (r.success) {
          passwordForm.style.display = 'none';
          updateLoggedInUI();
          const activeTab = document.querySelector('.user-tab.active');
          const def = (activeTab && activeTab.dataset.defaultName) || '';
          const color = activeTab ? activeTab.style.color : '';
          updateCurrentUserDisplay(def, r.account_name, color);
          refreshAccountInfo();
        }
      } catch (err) {
        showAlert('خطأ: ' + err.message, 'danger');
      } finally {
        setLoading(btn, false, '<i class="fas fa-unlock me-2"></i>تأكيد كلمة المرور');
      }
    });
  }

  // Resend code
  const resendBtn = document.getElementById('resendCodeBtn');
  const resendSmsBtn = document.getElementById('resendSmsBtn');
  async function doResend(forceSms) {
    const r = await postJSON('/api/resend_code', { force_sms: forceSms });
    showAlert(r.message || '', r.success ? 'success' : 'danger');
  }
  if (resendBtn) resendBtn.addEventListener('click', () => doResend(false));
  if (resendSmsBtn) resendSmsBtn.addEventListener('click', () => doResend(true));

  // Logout
  const logoutBtn = document.getElementById('logoutButton');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
      const r = await postJSON('/api/user_logout', {});
      showAlert(r.message || '', r.success ? 'success' : 'danger');
      if (r.success) setTimeout(() => location.reload(), 800);
    });
  }

  // Settings save
  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        message: (document.getElementById('message') || {}).value || '',
        groups: (document.getElementById('groups') || {}).value || '',
        interval_seconds: parseInt((document.getElementById('intervalSeconds') || {}).value || '25') * 60,
        watch_words: (document.getElementById('watchWords') || {}).value || '',
        send_type: (document.getElementById('sendType') || {}).value || 'manual',
        scheduled_time: (document.getElementById('scheduledTime') || {}).value || '',
        max_retries: parseInt((document.getElementById('maxRetries') || {}).value || '5'),
        auto_reconnect: (document.getElementById('autoReconnect') || {}).checked || false,
        sanitize_mode: (document.getElementById('sanitizeMode') || {}).value || 'smart'
      };
      const r = await postJSON('/api/save_settings', data);
      showAlert(r.message || '', r.success ? 'success' : 'danger');
    });
  }

  // ========== Scan Groups Protection button ==========
  const scanGroupsBtn = document.getElementById('scanGroupsBtn');
  const scanGroupsResult = document.getElementById('scanGroupsResult');
  if (scanGroupsBtn) {
    scanGroupsBtn.addEventListener('click', async () => {
      const groups = (document.getElementById('groups') || {}).value || '';
      if (!groups.trim()) {
        showAlert('أدخل المجموعات أولاً في حقل "المجموعات"', 'warning', scanGroupsBtn);
        return;
      }
      setLoading(scanGroupsBtn, true);
      scanGroupsResult.style.display = 'none';
      try {
        const r = await postJSON('/api/scan_groups_protection', { groups });
        if (r.error) { showAlert(r.error, 'danger', scanGroupsBtn); return; }
        const rows = r.results.map(item => {
          const icon = item.protected ? '🔴' : '🟢';
          const cls  = item.protected ? 'text-danger' : 'text-success';
          return `<div class="${cls} small py-1 border-bottom">${icon} <strong>${item.title || item.group}</strong> — ${item.reason || ''}</div>`;
        }).join('');
        const summary = `<div class="fw-bold mb-1">🔍 نتيجة الفحص: ${r.protected_count} محمية من أصل ${r.total}</div>`;
        scanGroupsResult.innerHTML = summary + rows;
        scanGroupsResult.style.display = 'block';
      } catch (err) {
        showAlert('خطأ في الفحص: ' + err.message, 'danger', scanGroupsBtn);
      } finally {
        setLoading(scanGroupsBtn, false);
      }
    });
  }

  // ========== Send Type toggle (manual / scheduled) ==========
  const sendTypeEl = document.getElementById('sendType');
  function syncSendTypeUI() {
    const t = (sendTypeEl && sendTypeEl.value) || 'manual';
    const isScheduled = (t === 'scheduled');
    const intervalDiv = document.getElementById('intervalDiv');
    const scheduledTimeDiv = document.getElementById('scheduledTimeDiv');
    if (intervalDiv) intervalDiv.style.display = isScheduled ? 'block' : 'none';
    if (scheduledTimeDiv) scheduledTimeDiv.style.display = isScheduled ? 'block' : 'none';
  }
  if (sendTypeEl) {
    sendTypeEl.addEventListener('change', syncSendTypeUI);
    syncSendTypeUI();
  }

  // ========== Send Now button ==========
  const sendNowBtn = document.getElementById('sendNowBtn');
  if (sendNowBtn) {
    sendNowBtn.addEventListener('click', async () => {
      __lastClickedEl = sendNowBtn;
      const message = (document.getElementById('message') || {}).value || '';
      const groups = (document.getElementById('groups') || {}).value || '';
      if (!message.trim() && uploadedImages.length === 0) {
        showAlert('يجب كتابة رسالة أو إرفاق صورة للإرسال', 'warning', sendNowBtn);
        return;
      }
      if (!groups.trim()) {
        showAlert('يجب تحديد مجموعات الإرسال', 'warning', sendNowBtn);
        return;
      }
      setLoading(sendNowBtn, true);
      try {
        const r = await postJSON('/api/send_now', {
          message,
          groups,
          images: uploadedImages
        });
        showAlert(r.message || (r.success ? 'تم الإرسال' : 'فشل الإرسال'),
                  r.success ? 'success' : 'danger', sendNowBtn);
      } finally {
        setLoading(sendNowBtn, false, '<i class="fas fa-paper-plane me-2"></i>إرسال الآن');
      }
    });
  }

  // ========== Start / Stop monitoring ==========
  const startMonitoringBtn = document.getElementById('startMonitoringBtn');
  const stopMonitoringBtn = document.getElementById('stopMonitoringBtn');
  function setMonitoringButtons(running) {
    if (startMonitoringBtn) startMonitoringBtn.style.display = running ? 'none' : 'block';
    if (stopMonitoringBtn) stopMonitoringBtn.style.display = running ? 'block' : 'none';
  }
  if (startMonitoringBtn) {
    startMonitoringBtn.addEventListener('click', async () => {
      __lastClickedEl = startMonitoringBtn;
      setLoading(startMonitoringBtn, true);
      try {
        const r = await postJSON('/api/start_monitoring', {});
        showAlert(r.message || (r.success ? 'بدأت المراقبة' : 'تعذر البدء'),
                  r.success ? 'success' : 'danger', startMonitoringBtn);
        if (r.success) setMonitoringButtons(true);
      } finally {
        setLoading(startMonitoringBtn, false, '<i class="fas fa-play me-2"></i>بدء المراقبة');
      }
    });
  }
  if (stopMonitoringBtn) {
    stopMonitoringBtn.addEventListener('click', async () => {
      __lastClickedEl = stopMonitoringBtn;
      setLoading(stopMonitoringBtn, true);
      try {
        const r = await postJSON('/api/stop_monitoring', {});
        showAlert(r.message || (r.success ? 'تم الإيقاف' : 'تعذر الإيقاف'),
                  r.success ? 'success' : 'danger', stopMonitoringBtn);
        if (r.success) setMonitoringButtons(false);
      } finally {
        setLoading(stopMonitoringBtn, false, '<i class="fas fa-stop me-2"></i>إيقاف المراقبة');
      }
    });
  }

  // ========== Image upload (drag & drop + click) ==========
  const dropZone = document.getElementById('dropZone');
  const imageUpload = document.getElementById('imageUpload');
  const imagePreview = document.getElementById('imagePreview');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const imageCount = document.getElementById('imageCount');
  const clearImagesBtn = document.getElementById('clearImages');
  const MAX_IMG_BYTES = 10 * 1024 * 1024;

  function renderImagePreviews() {
    if (!imagePreviewContainer) return;
    imagePreviewContainer.innerHTML = '';
    uploadedImages.forEach((img, idx) => {
      const col = document.createElement('div');
      col.className = 'col-4 col-md-3 position-relative';
      col.innerHTML = `
        <img src="${img.data}" class="img-fluid rounded border" style="aspect-ratio:1/1;object-fit:cover;">
        <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 py-0 px-1"
                data-idx="${idx}" title="حذف">×</button>
        <small class="d-block text-truncate text-center mt-1" title="${img.name}">${img.name}</small>
      `;
      col.querySelector('button').addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx, 10);
        uploadedImages.splice(i, 1);
        updateImagesUI();
      });
      imagePreviewContainer.appendChild(col);
    });
  }
  function updateImagesUI() {
    if (imageCount) imageCount.textContent = String(uploadedImages.length);
    if (imagePreview) imagePreview.style.display = uploadedImages.length ? 'block' : 'none';
    renderImagePreviews();
  }
  function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    let added = 0, skipped = 0;
    let pending = files.length;
    if (!pending) return;
    files.forEach(file => {
      if (!file.type.startsWith('image/')) { skipped++; if (--pending === 0) finalize(); return; }
      if (file.size > MAX_IMG_BYTES) { skipped++; if (--pending === 0) finalize(); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedImages.push({ data: e.target.result, name: file.name, type: file.type });
        added++;
        if (--pending === 0) finalize();
      };
      reader.onerror = () => { skipped++; if (--pending === 0) finalize(); };
      reader.readAsDataURL(file);
    });
    function finalize() {
      updateImagesUI();
      if (added) showAlert(`تمت إضافة ${added} صورة`, 'success', dropZone);
      if (skipped) showAlert(`تم تجاهل ${skipped} ملف غير صالح أو أكبر من 10MB`, 'warning', dropZone);
    }
  }
  if (dropZone && imageUpload) {
    dropZone.addEventListener('click', () => imageUpload.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-primary'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-primary'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-primary');
      handleFiles(e.dataTransfer.files);
    });
    imageUpload.addEventListener('change', (e) => handleFiles(e.target.files));
  }
  if (clearImagesBtn) {
    clearImagesBtn.addEventListener('click', () => { uploadedImages = []; updateImagesUI(); });
  }

  // User switching
  document.querySelectorAll('.user-tab').forEach(tab => {
    tab.addEventListener('click', async (ev) => {
      const newId = tab.dataset.userId;
      const defaultName = tab.dataset.defaultName || tab.querySelector('.user-tab-name')?.textContent || '';
      const wasActive = tab.classList.contains('active');
      __lastClickedEl = tab;
      if (wasActive) {
        showAlert(`أنت بالفعل على حساب: ${defaultName}`, 'info', tab);
        return;
      }
      const r = await postJSON('/api/switch_user', { user_id: newId });
      if (r.success) {
        document.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const accountName = r.account_name;
        const accountAvatar = r.account_avatar || (r.user && r.user.account_avatar);
        const authenticated = !!(r.user && r.user.authenticated);
        if (accountName) {
          showAlert(`تم الانتقال إلى: ${defaultName} (${accountName})`, 'success', tab);
        } else {
          showAlert(`تم الانتقال إلى: ${defaultName} — لم يسجل دخول بعد`, 'warning', tab);
        }
        // Toggle login form vs session controls based on the new user's auth state
        updateLoggedInUI(authenticated);
        // Reset stats display for the newly selected user
        const sc = document.getElementById('sentCount');
        const ec = document.getElementById('errorCount');
        if (sc) sc.textContent = '0';
        if (ec) ec.textContent = '0';
        // Reflect saved settings of the new user
        if (r.settings) applySettingsToForm(r.settings);
        updateCurrentUserDisplay(defaultName, accountName, tab.style.color, accountAvatar);
        const tabNameEl = tab.querySelector('.user-tab-name');
        if (tabNameEl && accountName) tabNameEl.textContent = `${defaultName} · ${accountName}`;
        // Refresh from server to ensure avatar/status is fully updated (esp. just after login)
        setTimeout(() => { refreshAccountInfo(); fetchLoginStatus(); }, 500);
      } else {
        showAlert(r.message || 'تعذر الانتقال', 'danger', tab);
      }
    });
  });

  // Initial state
  fetchLoginStatus();
  initSocket();
  initPWA();
  refreshAccountInfo();
});

function updateCurrentUserDisplay(predefinedName, accountName, color, accountAvatar) {
  const cu = document.getElementById('currentUserNameDisplay');
  if (cu) {
    cu.textContent = predefinedName || '';
    if (color) cu.style.color = color;
  }
  const ca = document.getElementById('currentAccountNameDisplay');
  if (ca) {
    if (accountName) {
      ca.textContent = '👤 ' + accountName;
      ca.style.display = 'inline-block';
    } else {
      ca.textContent = '';
      ca.style.display = 'none';
    }
  }
  // Avatar next to current user name
  const av = document.getElementById('currentAccountAvatar');
  if (av) {
    if (accountAvatar) {
      av.src = accountAvatar;
      av.style.display = 'inline-block';
    } else {
      av.removeAttribute('src');
      av.style.display = 'none';
    }
  }
  const activeTab = document.querySelector('.user-tab.active');
  if (activeTab) {
    const tabNameEl = activeTab.querySelector('.user-tab-name');
    const def = activeTab.dataset.defaultName || '';
    if (tabNameEl) {
      tabNameEl.textContent = accountName ? `${def} · ${accountName}` : def;
    }
    // Update the avatar inside the active user tab
    const tabAvatar = activeTab.querySelector('.user-tab-avatar');
    if (tabAvatar) {
      if (accountAvatar) {
        tabAvatar.src = accountAvatar;
      } else {
        const uid = activeTab.dataset.userId;
        if (uid) tabAvatar.src = '/api/account_avatar/' + uid + '?t=' + Date.now();
      }
    }
  }
}

function applySettingsToForm(s) {
  if (!s) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el != null && v !== undefined) el.value = v; };
  set('message', s.message || '');
  set('groups', Array.isArray(s.groups) ? s.groups.join('\n') : (s.groups || ''));
  set('watchWords', Array.isArray(s.watch_words) ? s.watch_words.join('\n') : (s.watch_words || ''));
  set('intervalSeconds', Math.round((s.interval_seconds || 1500) / 60));
  set('sendType', s.send_type || 'manual');
  set('scheduledTime', s.scheduled_time || '');
  set('sanitizeMode', s.sanitize_mode || 'smart');
  set('phone', s.phone || '');
  // Toggle scheduled-time visibility based on the loaded value
  const sendTypeEl = document.getElementById('sendType');
  if (sendTypeEl) {
    const isScheduled = (sendTypeEl.value === 'scheduled');
    const intervalDiv = document.getElementById('intervalDiv');
    const scheduledTimeDiv = document.getElementById('scheduledTimeDiv');
    if (intervalDiv) intervalDiv.style.display = isScheduled ? 'block' : 'none';
    if (scheduledTimeDiv) scheduledTimeDiv.style.display = isScheduled ? 'block' : 'none';
  }
}

async function refreshAccountInfo() {
  try {
    const res = await fetch('/api/get_account_info', { credentials: 'same-origin' });
    const txt = await res.text();
    if (!txt) return;
    const r = JSON.parse(txt);
    if (r && r.success) {
      const activeTab = document.querySelector('.user-tab.active');
      const def = (activeTab && activeTab.dataset.defaultName) || r.predefined_name || '';
      const color = activeTab ? activeTab.style.color : '';
      updateCurrentUserDisplay(def, r.account_name, color, r.account_avatar);
    }
  } catch (e) {}
}

function updateLoggedInUI(isLoggedIn) {
  // Default behavior preserves backwards compat: undefined => treat as logged in
  const loggedIn = (isLoggedIn === undefined) ? true : !!isLoggedIn;
  const sc = document.getElementById('sessionControls');
  const lbc = document.getElementById('loginButtonContainer');
  const verifyForm = document.getElementById('verifyForm');
  const passwordForm = document.getElementById('passwordForm');
  if (loggedIn) {
    if (sc) sc.style.display = 'block';
    if (lbc) lbc.style.display = 'none';
    if (verifyForm) verifyForm.style.display = 'none';
    if (passwordForm) passwordForm.style.display = 'none';
  } else {
    if (sc) sc.style.display = 'none';
    if (lbc) lbc.style.display = 'block';
    if (verifyForm) verifyForm.style.display = 'none';
    if (passwordForm) passwordForm.style.display = 'none';
  }
  const status = document.getElementById('connectionStatus');
  if (status) {
    status.textContent = loggedIn ? 'متصل' : 'غير متصل';
    status.className = 'badge ' + (loggedIn ? 'bg-success' : 'bg-danger');
  }
  // Reset monitoring buttons when logging out / switching to non-authenticated user
  if (!loggedIn) {
    const startBtn = document.getElementById('startMonitoringBtn');
    const stopBtn = document.getElementById('stopMonitoringBtn');
    if (startBtn) startBtn.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

async function fetchLoginStatus() {
  try {
    const r = await fetch('/api/get_login_status').then(x => x.json());
    if (r) updateLoggedInUI(!!r.logged_in);
  } catch (e) {}
}

// ============== Socket.IO ==============
function initSocket() {
  if (typeof io === 'undefined') return;
  socket = io({ transports: ['websocket', 'polling'] });
  window.socket = socket;
  socket.on('connect', () => appendLog('🔌 متصل بالسيرفر'));
  socket.on('disconnect', () => appendLog('⚠️ انقطع الاتصال'));
  socket.on('log_update', d => appendLog(d.message || ''));
  socket.on('connection_status', d => {
    const status = document.getElementById('connectionStatus');
    if (status) {
      const ok = d.status === 'connected';
      status.textContent = ok ? 'متصل' : 'غير متصل';
      status.className = 'badge ' + (ok ? 'bg-success' : 'bg-danger');
    }
  });
  socket.on('login_status', d => { if (d.logged_in) updateLoggedInUI(true); });
  socket.on('update_monitoring_buttons', d => {
    const startBtn = document.getElementById('startMonitoringBtn');
    const stopBtn  = document.getElementById('stopMonitoringBtn');
    const running = !!(d && d.is_running);
    if (startBtn) startBtn.style.display = running ? 'none' : 'block';
    if (stopBtn)  stopBtn.style.display  = running ? 'block' : 'none';
  });
  socket.on('user_settings', s => applySettingsToForm(s));
  socket.on('new_alert', d => {
    const keyword = d.keyword || '';
    const group   = d.group   || '';
    const sender  = d.sender  || 'غير معروف';
    const msg     = d.message || '';
    const ts      = d.timestamp || new Date().toLocaleTimeString('ar-SA');
    // append to log
    appendLog(`🚨 <strong>تنبيه مراقبة</strong>: كلمة "<em>${keyword}</em>" في ${group} من ${sender}`);
    // show floating popup
    const popup = document.createElement('div');
    popup.className = 'alert alert-danger alert-dismissible fade show alert-popup keyword-alert';
    popup.setAttribute('role', 'alert');
    popup.innerHTML = `
      <strong>🚨 تنبيه مراقبة – ${ts}</strong><br>
      <b>الكلمة:</b> ${keyword}<br>
      <b>المصدر:</b> ${group}<br>
      <b>المرسل:</b> ${sender}<br>
      <b>الرسالة:</b> <span style="font-size:12px;">${msg.substring(0,200)}</span>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="إغلاق"></button>`;
    const container = document.getElementById('alertContainer');
    if (container) {
      container.appendChild(popup);
      setTimeout(() => { try { popup.remove(); } catch(e){} }, 15000);
    }
    // play notification sound if available
    try { new Audio('/static/alert.mp3').play(); } catch(e){}
  });
  socket.on('monitoring_status', d => {
    const ind = document.getElementById('monitoringIndicator');
    if (!ind) return;
    if (d && d.monitoring_active) {
      ind.className = 'badge bg-success';
      ind.innerHTML = '<i class="fas fa-circle"></i> مراقبة نشطة';
    } else {
      ind.className = 'badge bg-secondary';
      ind.innerHTML = '<i class="fas fa-circle"></i> غير نشط';
    }
  });
  socket.on('stats_update', d => {
    const s = document.getElementById('sentCount');
    const e = document.getElementById('errorCount');
    if (s && d.sent !== undefined) s.textContent = d.sent;
    if (e && d.errors !== undefined) e.textContent = d.errors;
  });
}

// ============== PWA Install ==============
function initPWA() {
  const installBtn = document.getElementById('installAppBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-block';
  });
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!globalDeferredPrompt) {
        showAlert('التثبيت غير متاح في هذا المتصفح. على iPhone: استخدم زر المشاركة ثم "إضافة إلى الشاشة الرئيسية"', 'info');
        return;
      }
      globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showAlert('✅ تم تثبيت التطبيق', 'success');
        installBtn.style.display = 'none';
      }
      globalDeferredPrompt = null;
    });
  }
  window.addEventListener('appinstalled', () => {
    showAlert('✅ تم تثبيت التطبيق بنجاح', 'success');
    if (installBtn) installBtn.style.display = 'none';
  });
}

function showUpdateNotification() {
  showAlert('🔄 يتوفر تحديث جديد، أعد تحميل الصفحة', 'info');
}
