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
        document.getElementById('profile-signature').value = data.signature || '';
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
                signature: document.getElementById('profile-signature').value
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

async function sendToAI() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('send-btn');
    const message = input.value.trim();
    if (!message) return;
    const history = document.getElementById('chat-history');
    const mine = document.createElement('div');
    mine.className = 'bubble user';
    mine.textContent = message;
    history.appendChild(mine);
    input.value = '';
    sendBtn.disabled = true;
    const loading = document.createElement('div');
    loading.className = 'bubble ai';
    loading.id = 'loading-msg';
    loading.textContent = '正在想...';
    history.appendChild(loading);
    history.scrollTop = history.scrollHeight;
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await res.json().catch(() => ({}));
        loading.remove();
        const reply = document.createElement('div');
        reply.className = 'bubble ai';
        reply.textContent = res.ok ? data.reply : ('出错啦：' + (data.error || '请求失败'));
        history.appendChild(reply);
    } catch (err) {
        const node = document.getElementById('loading-msg');
        if (node) node.textContent = '网络请求失败';
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