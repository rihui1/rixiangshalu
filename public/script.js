function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function switchView(element) {
    document.querySelectorAll('.menu-item').forEach((el) => el.classList.remove('active'));
    element.classList.add('active');

    const targetId = element.getAttribute('data-target');
    if (!targetId) return;

    document.querySelectorAll('.view-section').forEach((el) => el.classList.remove('active'));
    const targetView = document.getElementById(targetId);
    if (targetView) targetView.classList.add('active');
}

const token = localStorage.getItem('token');
const currentUser = localStorage.getItem('username');

function initUserState() {
    const userArea = document.getElementById('user-status-area');
    if (!userArea) return;

    const homeTip = document.getElementById('home-guest-tip');
    const menuProfile = document.getElementById('menu-profile');
    const loggedIn = Boolean(token && currentUser);

    if (menuProfile) menuProfile.classList.toggle('hidden', !loggedIn);
    if (homeTip) homeTip.style.display = loggedIn ? 'none' : '';

    if (!loggedIn) {
        userArea.innerHTML = '<a href="login.html" class="btn btn-primary">登录</a>';
        return;
    }

    const savedAvatar = localStorage.getItem('user_avatar') || '';
    const avatarHtml = savedAvatar
        ? `<img src="${escapeHtml(savedAvatar)}" alt="" draggable="false">`
        : `<span>${escapeHtml(currentUser.charAt(0).toUpperCase())}</span>`;

    userArea.innerHTML = `
        <span class="user-name">${escapeHtml(currentUser)}</span>
        <a class="avatar" href="profile.html" title="用户中心">${avatarHtml}</a>
        <button type="button" class="btn btn-danger" onclick="logout()">退出</button>
    `;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_avatar');
    location.href = 'index.html';
}

async function loadPosts() {
    const list = document.getElementById('post-list');
    if (!list) return;

    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();
        if (!Array.isArray(posts)) throw new Error('bad payload');

        list.innerHTML = posts.map((post) => `
            <li>
                <strong>${escapeHtml(post.username)}</strong> 说：
                <p>${escapeHtml(post.content)}</p>
            </li>
        `).join('');
    } catch (err) {
        list.innerHTML = '<li>帖子加载失败</li>';
    }
}

async function createPost() {
    if (!token) {
        alert('请先登录才能发帖！');
        location.href = 'login.html';
        return;
    }

    const input = document.getElementById('post-content');
    const content = input.value.trim();
    if (!content) return alert('内容不能为空');

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || '发布失败');
        input.value = '';
        loadPosts();
    } catch (err) {
        alert('发布失败，请检查网络');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initUserState();
    loadPosts();
});