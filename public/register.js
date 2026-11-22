async function sendCode() {
    const email = document.getElementById('reg-email').value.trim();
    if (!email) return alert('请先填写邮箱');

    const btn = document.getElementById('send-code-btn');
    btn.disabled = true;
    btn.innerText = '发送中...';

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
            btn.innerText = '获取验证码';
            return;
        }

        alert('验证码已发送，请查收邮件！');
        let countdown = 60;
        const timer = setInterval(() => {
            countdown -= 1;
            btn.innerText = countdown + '秒';
            if (countdown <= 0) {
                clearInterval(timer);
                btn.disabled = false;
                btn.innerText = '获取验证码';
            }
        }, 1000);
    } catch (err) {
        alert('网络请求失败');
        btn.disabled = false;
        btn.innerText = '获取验证码';
    }
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const email = document.getElementById('reg-email').value.trim();
    const code = document.getElementById('verify-code').value.trim();
    const msg = document.getElementById('auth-msg');

    if (!username || !password || !email || !code) {
        msg.innerText = '请填写完整信息';
        return;
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email, code })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            msg.style.color = 'red';
            msg.innerText = data.error || '注册失败';
            return;
        }
        alert('注册成功！即将跳转到登录页面...');
        location.href = 'login.html';
    } catch (err) {
        msg.innerText = '网络请求失败';
    }
}