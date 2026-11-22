let token = localStorage.getItem('token') || '';
let currentUser = localStorage.getItem('username') || '';
let currentAvatarBase64 = '';
let pendingCrop = '';

const HASH_TO_VIEW = {
    home: 'view-home',
    forum: 'view-forum',
    ai: 'view-ai',
    svc: 'view-svc',
    changelog: 'view-changelog',
    profile: 'view-profile'
};

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function greeting() {
    const hour = new Date().getHours();
    const name = currentUser || '旅人';
    const hello = hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    return hello + '，' + name;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('scrim');
    if (window.matchMedia('(max-width: 900px)').matches) {
        sidebar.classList.toggle('open');
        scrim.classList.toggle('show', sidebar.classList.contains('open'));
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

function openView(id) {
    const btn = document.querySelector('.nav-item[data-target="' + id + '"]');
    if (btn) switchView(btn);
}

function switchView(element) {
    document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
    element.classList.add('active');
    const targetId = element.getAttribute('data-target');
    document.querySelectorAll('.view-section').forEach((el) => el.classList.remove('active'));
    const view = document.getElementById(targetId);
    if (view) view.classList.add('active');
    const label = element.querySelector('.nav-text');
    document.getElementById('page-title').textContent = label ? label.textContent : '日向论坛';
    const hash = Object.keys(HASH_TO_VIEW).find((key) => HASH_TO_VIEW[key] === targetId) || 'home';
    history.replaceState(null, '', '#' + hash);
    if (window.matchMedia('(max-width: 900px)').matches) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('scrim').classList.remove('show');
    }
    if (targetId === 'view-profile') loadProfilePanel();
    if (targetId === 'view-ai') loadChatHistory();
    if (targetId === 'view-home') renderHome();
}

function initUserState() {
    const area = document.getElementById('user-status-area');
    const tip = document.getElementById('home-guest-tip');
    if (tip) tip.hidden = Boolean(token && currentUser);
    document.getElementById('greet').textContent = greeting();
    if (!(token && currentUser)) {
        area.innerHTML = '<button type="button" class="text-btn" onclick="openView(\'view-profile\')">登录</button>';
        return;
    }
    const savedAvatar = localStorage.getItem('user_avatar') || '';
    const face = savedAvatar
        ? '<img src="' + escapeHtml(savedAvatar) + '" alt="" draggable="false">'
        : '<span>' + escapeHtml(currentUser.charAt(0).toUpperCase()) + '</span>';
    area.innerHTML =
        '<span class="user-name">' + escapeHtml(currentUser) + '</span>' +
        '<button type="button" class="avatar" title="用户中心" onclick="openView(\'view-profile\')">' + face + '</button>' +
        '<button type="button" class="ghost" onclick="logout()">退出</button>';
}

function logout() {
    token = '';
    currentUser = '';
    currentAvatarBase64 = '';
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_avatar');
    initUserState();
    syncProfileVisibility();
    openView('view-home');
}

function setSession(data) {
    token = data.token;
    currentUser = data.username;
    localStorage.setItem('token', token);
    localStorage.setItem('username', currentUser);
    if (data.avatar) localStorage.setItem('user_avatar', data.avatar);
    else localStorage.removeItem('user_avatar');
    initUserState();
    loadPosts();
    loadProfilePanel();
}

function syncProfileVisibility() {
    const loggedIn = Boolean(token && currentUser);
    document.getElementById('auth-panel').hidden = loggedIn;
    document.getElementById('editor-panel').hidden = !loggedIn;
}

function showAuthTab(name) {
    document.querySelectorAll('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
    document.querySelectorAll('.auth-form').forEach((form) => { form.hidden = form.dataset.form !== name; });
    document.getElementById('auth-msg').textContent = '';
}

function startCountdown(btn, label) {
    let left = 60;
    btn.disabled = true;
    const timer = setInterval(() => {
        left -= 1;
        btn.textContent = left + '秒';
        if (left <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            btn.textContent = label;
        }
    }, 1000);
}

async function sendCodeTo(email, btn, label) {
    if (!email) return alert('请先填写邮箱');
    btn.disabled = true;
    btn.textContent = '发送中...';
    try {
        const res = await fetch('/api/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(data.error || '发送失败');
            btn.disabled = false;
            btn.textContent = label;
            return;
        }
        alert('验证码已发送');
        startCountdown(btn, label);
    } catch (err) {
        alert('网络请求失败');
        btn.disabled = false;
        btn.textContent = label;
    }
}

function sendCode() {
    sendCodeTo(document.getElementById('reg-email').value.trim(), document.getElementById('send-code-btn'), '获取验证码');
}
function sendLoginCode() {
    sendCodeTo(document.getElementById('login-email').value.trim(), document.getElementById('login-code-btn'), '获取验证码');
}

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const msg = document.getElementById('auth-msg');
    if (!username || !password) { msg.textContent = '请填写完整'; return; }
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { msg.textContent = data.error || '登录失败'; return; }
        setSession(data);
    } catch (err) { msg.textContent = '网络请求失败'; }
}

async function loginWithEmail() {
    const email = document.getElementById('login-email').value.trim();
    const code = document.getElementById('login-code').value.trim();
    const msg = document.getElementById('auth-msg');
    if (!email || !code) { msg.textContent = '请填写完整'; return; }
    try {
        const res = await fetch('/api/login-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { msg.textContent = data.error || '登录失败'; return; }
        setSession(data);
    } catch (err) { msg.textContent = '网络请求失败'; }
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const email = document.getElementById('reg-email').value.trim();
    const code = document.getElementById('verify-code').value.trim();
    const msg = document.getElementById('auth-msg');
    if (!username || !password || !email || !code) { msg.textContent = '请填写完整信息'; return; }
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email, code })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { msg.textContent = data.error || '注册失败'; return; }
        msg.textContent = '注册成功，请用密码登录';
        showAuthTab('password');
        document.getElementById('login-username').value = username;
    } catch (err) { msg.textContent = '网络请求失败'; }
}

function postCard(post) {
    return '<article class="post"><header><strong>' + escapeHtml(post.username) +
        '</strong><time>' + escapeHtml(post.created_at || '') + '</time></header><p>' +
        escapeHtml(post.content) + '</p></article>';
}

async function fetchPosts() {
    const res = await fetch('/api/posts');
    const posts = await res.json();
    if (!Array.isArray(posts)) throw new Error('bad payload');
    return posts;
}

async function loadPosts() {
    const list = document.getElementById('post-list');
    const home = document.getElementById('home-posts');
    try {
        const posts = await fetchPosts();
        const html = posts.length ? posts.map(postCard).join('') : '<p class="empty">还没有帖子。</p>';
        if (list) list.innerHTML = html;
        if (home) home.innerHTML = posts.length ? posts.slice(0, 4).map(postCard).join('') : '<p class="empty">还没有帖子，去论坛写第一条吧。</p>';
    } catch (err) {
        if (list) list.innerHTML = '<p class="empty">帖子加载失败</p>';
        if (home) home.innerHTML = '<p class="empty">帖子加载失败</p>';
    }
}

function renderHome() {
    document.getElementById('greet').textContent = greeting();
    const tip = document.getElementById('home-guest-tip');
    if (tip) tip.hidden = Boolean(token && currentUser);
}

async function createPost() {
    if (!token) { alert('请先登录才能发帖'); openView('view-profile'); return; }
    const input = document.getElementById('post-content');
    const content = input.value.trim();
    if (!content) return alert('内容不能为空');
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ content })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || '发布失败');
        input.value = '';
        loadPosts();
    } catch (err) { alert('发布失败，请检查网络'); }
}

function showAvatar(src) {
    const img = document.getElementById('avatar-img');
    img.src = src;
    img.style.display = 'block';
    document.getElementById('avatar-text').style.display = 'none';
    currentAvatarBase64 = src;
}

async function loadProfilePanel() {
    syncProfileVisibility();
    if (!token) return;
    try {
        const res = await fetch('/api/user/profile', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
            alert(data.error || '登录已过期，请重新登录');
            logout();
            return;
        }
        if (!res.ok) { alert(data.error || '加载失败'); return; }
        document.getElementById('profile-username').textContent = data.username || '';
        document.getElementById('profile-uid').textContent = data.uid || '分配失败，请刷新';
        document.getElementById('profile-email').textContent = data.email || '未绑定';
        document.getElementById('profile-signature').value = data.signature || '';
        document.getElementById('profile-birthday').value = data.birthday || '';
        document.getElementById('profile-joined').textContent = (data.created_at || '').slice(0, 10) || '—';
        const stats = data.stats || {};
        document.getElementById('stat-posts').textContent = stats.posts || 0;
        if (stats.chat) updateQuota(stats.chat);
        if (data.avatar) showAvatar(data.avatar);
    } catch (err) { alert('网络请求失败，请检查后端是否启动'); }
}

function pickAvatar(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        pendingCrop = reader.result;
        document.getElementById('crop-image').src = pendingCrop;
        document.getElementById('crop-modal').hidden = false;
    };
    reader.readAsDataURL(file);
}

function centerCrop(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const side = Math.min(img.width, img.height);
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 300, 300);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => reject(new Error('image'));
        img.src = dataUrl;
    });
}

async function confirmCrop() {
    if (!pendingCrop) return;
    try { showAvatar(await centerCrop(pendingCrop)); }
    catch (err) { alert('这张图片无法裁切'); }
    closeCropModal();
}

function closeCropModal() {
    pendingCrop = '';
    document.getElementById('crop-modal').hidden = true;
}

async function saveProfile() {
    if (!token) return openView('view-profile');
    try {
        const res = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({
                avatar: currentAvatarBase64,
                signature: document.getElementById('profile-signature').value,
                birthday: document.getElementById('profile-birthday').value
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert('保存失败：' + (data.error || res.status));
        if (currentAvatarBase64) localStorage.setItem('user_avatar', currentAvatarBase64);
        initUserState();
        alert('保存成功');
    } catch (err) { alert('保存失败，请检查网络'); }
}

async function deleteAccount() {
    const typed = document.getElementById('delete-name').value.trim();
    if (!currentUser || typed !== currentUser) return alert('请输入当前用户名以确认注销');
    if (!confirm('注销后账号和你的帖子都会删除，且不能恢复。确定继续？')) return;
    try {
        const res = await fetch('/api/user/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ confirm: typed })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || '注销失败');
        alert('账号已注销');
        logout();
        loadPosts();
    } catch (err) { alert('注销失败，请检查网络'); }
}

function sendBindCode() {
    sendCodeTo(document.getElementById('bind-email').value.trim(), document.getElementById('bind-code-btn'), '获取验证码');
}

async function bindEmail() {
    if (!token) return openView('view-profile');
    const email = document.getElementById('bind-email').value.trim();
    const code = document.getElementById('bind-code').value.trim();
    if (!email || !code) return alert('请填写新邮箱和验证码');
    try {
        const res = await fetch('/api/user/bind-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ email, code })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || '绑定失败');
        document.getElementById('profile-email').textContent = data.email;
        document.getElementById('bind-email').value = '';
        document.getElementById('bind-code').value = '';
        alert('邮箱已更新');
    } catch (err) { alert('绑定失败，请检查网络'); }
}

async function changePassword() {
    if (!token) return openView('view-profile');
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    if (!oldPassword || !newPassword) return alert('请填写当前密码和新密码');
    if (newPassword.length < 6) return alert('新密码至少 6 位');
    try {
        const res = await fetch('/api/user/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || '修改失败');
        alert('密码已修改，请用新密码重新登录');
        logout();
    } catch (err) { alert('修改失败，请检查网络'); }
}

function appendBubble(role, text) {
    const history = document.getElementById('chat-history');
    const node = document.createElement('div');
    node.className = 'bubble ' + (role === 'user' ? 'user' : 'ai');
    node.textContent = text;
    history.appendChild(node);
    return node;
}

function updateQuota(quota) {
    if (!quota) return;
    const used = quota.used || 0;
    const limit = quota.limit || 0;
    document.getElementById('chat-used').textContent = used;
    document.getElementById('chat-limit').textContent = limit;
    document.getElementById('stat-chat').textContent = used;
    const fill = document.getElementById('quota-fill');
    if (fill) fill.style.width = (limit ? Math.min(100, (used / limit) * 100) : 0) + '%';
    const pill = document.getElementById('chat-quota');
    if (pill) pill.textContent = token ? '今日剩余 ' + quota.remaining + ' 条' : '登录后可保存聊天记录';
}

async function loadChatHistory() {
    const history = document.getElementById('chat-history');
    if (!token) {
        history.innerHTML = '<div class="bubble ai">登录后聊天记录会保存在服务器，下次登录可以接着聊。<br>' +
            '<button type="button" class="link-inline" onclick="openView(\'view-profile\')">去登录</button></div>';
        const pill = document.getElementById('chat-quota');
        if (pill) pill.textContent = '登录后可保存聊天记录';
        return;
    }
    try {
        const res = await fetch('/api/chat/history', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) { logout(); return; }
        if (!res.ok) return;
        history.innerHTML = '';
        if (!data.messages || !data.messages.length) {
            history.innerHTML = '<div class="bubble ai">你好，我是日向的 AI 助手。有什么想问的直接说吧。</div>';
        } else {
            data.messages.forEach((m) => appendBubble(m.role, m.content));
        }
        updateQuota(data.quota);
        history.scrollTop = history.scrollHeight;
    } catch (err) { /* 网络异常时保持欢迎语 */ }
}

async function clearChatHistory() {
    if (!token) { openView('view-profile'); return; }
    if (!confirm('确定清空全部聊天记录吗？当日额度不会恢复。')) return;
    try {
        const res = await fetch('/api/chat/history', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || '清空失败');
        await loadChatHistory();
    } catch (err) { alert('清空失败，请检查网络'); }
}

async function sendToAI() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('send-btn');
    const message = input.value.trim();
    if (!message) return;
    if (!token) {
        alert('登录后才能使用 AI，并把聊天记录保存到服务器');
        openView('view-profile');
        return;
    }
    const history = document.getElementById('chat-history');
    appendBubble('user', message);
    input.value = '';
    sendBtn.disabled = true;
    const loading = appendBubble('ai', '正在想...');
    loading.id = 'loading-msg';
    history.scrollTop = history.scrollHeight;
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ message })
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) { loading.remove(); logout(); return; }
        loading.remove();
        if (!res.ok) {
            const errNode = appendBubble('ai', data.error || '请求失败');
            errNode.classList.add('error');
            if (data.quota) updateQuota(data.quota);
            return;
        }
        appendBubble('assistant', data.reply);
        updateQuota(data.quota);
    } catch (err) {
        loading.textContent = '网络请求失败，请稍后再试';
    } finally {
        sendBtn.disabled = false;
        history.scrollTop = history.scrollHeight;
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') sendToAI();
}

function applyHash() {
    const key = (location.hash || '#home').slice(1);
    openView(HASH_TO_VIEW[key] || 'view-home');
}

initUserState();
syncProfileVisibility();
loadPosts();
applyHash();