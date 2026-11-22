// ==================== UI 交互逻辑 ====================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function switchView(element) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    const targetId = element.getAttribute('data-target');
    if (!targetId) return; // 如果是外链（比如去用户中心），直接返回
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const targetView = document.getElementById(targetId);
    if (targetView) targetView.classList.add('active');
}

// ==================== 登录状态与渲染 ====================
const token = localStorage.getItem('token');
const currentUser = localStorage.getItem('username');


function initUserState() {
    const userArea = document.getElementById('user-status-area');
    if (!userArea) return; 

    const homeTip = document.getElementById('home-guest-tip');
    const menuProfile = document.getElementById('menu-profile');

    if (token && currentUser) {
        if (menuProfile) menuProfile.classList.remove('hidden');
        if (homeTip) homeTip.style.display = 'none';

        const savedAvatar = localStorage.getItem('user_avatar') || ''; 
        const avatarHtml = savedAvatar 
            ? `<img src="${savedAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` 
            : `<span style="color:#fff; font-weight:bold; font-size:16px;">${currentUser.charAt(0).toUpperCase()}</span>`;

        userArea.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-weight: bold; color: #333;">${currentUser}</span>
                <!-- 直接用 onclick 强制跳转，避开 a 标签被拦截的问题 -->
                <div class="avatar" style="cursor: pointer; display: flex; justify-content: center; align-items: center; width:36px; height:36px; border-radius:50%; overflow:hidden; background:#007bff;" onclick="window.location.href='profile.html'">
                    ${avatarHtml}
                </div>
                <button onclick="logout()" class="btn btn-danger" style="padding: 5px 10px; font-size: 12px;">退出</button>
            </div>
        `;
    } else {
        // ... 未登录状态保持不变 ...
    }
}

function logout() {
    localStorage.clear();
    window.location.reload();
}

// ==================== 页面初始化 ====================
window.onload = () => {
    initUserState();
    loadPosts(); 
};

// 论坛数据逻辑
async function loadPosts() {
    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();
        const list = document.getElementById('post-list');
        if (!list) return;

        list.innerHTML = '';
        posts.forEach(post => {
            const li = document.createElement('li');
            li.style.padding = '15px 0';
            li.style.borderBottom = '1px solid #eee';
            li.innerHTML = `<strong style="color:#007bff;">${post.username}</strong> 说：<br><p style="margin-top:5px;">${post.content}</p>`;
            list.appendChild(li);
        });
    } catch (err) {}
}

async function createPost() {
    if (!token) {
        alert("请先登录才能发帖！");
        window.location.href = 'login.html';
        return;
    }

    const content = document.getElementById('post-content').value;
    if (!content) return alert('内容不能为空');

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('post-content').value = '';
            loadPosts();
        } else {
            alert(data.error);
        }
    } catch (err) {}
}
