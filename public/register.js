// 发送验证码
async function sendCode() {
    const email = document.getElementById('reg-email').value;
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
        
        if (res.ok) {
            alert('验证码已发送，请查收邮件！');
            let countdown = 60;
            const timer = setInterval(() => {
                countdown--;
                btn.innerText = `${countdown}秒`;
                if (countdown <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.innerText = '获取验证码';
                }
            }, 1000);
        } else {
            const data = await res.json();
            alert(data.error || '发送失败');
            btn.disabled = false;
            btn.innerText = '获取验证码';
        }
    } catch (err) {
        alert('网络请求失败');
        btn.disabled = false;
        btn.innerText = '获取验证码';
    }
}

// 注册提交
async function register() {
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const email = document.getElementById('reg-email').value;
    const code = document.getElementById('verify-code').value;

    if (!username || !password || !email || !code) {
        return document.getElementById('auth-msg').innerText = '请填写完整信息';
    }
    
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, code })
    });
    const data = await res.json();
    
    if (res.ok) {
        alert('注册成功！即将跳转到登录页面...');
        // 👇 注册成功后跳转回 index.html，并把用户名带过去
        window.location.href = `index.html?username=${encodeURIComponent(username)}`;
    } else {
        document.getElementById('auth-msg').style.color = 'red';
        document.getElementById('auth-msg').innerText = data.error;
    }
}