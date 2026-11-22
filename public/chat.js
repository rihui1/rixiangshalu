async function sendToAI() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('send-btn');
    const message = input.value.trim();
    if (!message) return;

    const history = document.getElementById('chat-history');
    
    // 1. 显示用户消息
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'message user';
    userMsgDiv.innerText = message;
    history.appendChild(userMsgDiv);
    
    input.value = ''; // 清空输入框
    history.scrollTop = history.scrollHeight; // 滚到底部

    // 2. 显示“思考中”状态
    sendBtn.disabled = true;
    sendBtn.innerText = '...';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai';
    loadingDiv.innerText = 'AI 正在思考中...';
    loadingDiv.id = 'loading-msg';
    history.appendChild(loadingDiv);
    history.scrollTop = history.scrollHeight;

    // 3. 请求后端
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await res.json();

        // 移除“思考中”
        document.getElementById('loading-msg').remove();

        // 4. 显示 AI 回复
        const aiMsgDiv = document.createElement('div');
        aiMsgDiv.className = 'message ai';
        if (res.ok) {
            aiMsgDiv.innerText = data.reply;
        } else {
            aiMsgDiv.innerText = '出错啦：' + data.error;
            aiMsgDiv.style.color = 'red';
        }
        history.appendChild(aiMsgDiv);

    } catch (err) {
        document.getElementById('loading-msg').remove();
        console.error(err);
    } finally {
        // 恢复按钮状态
        sendBtn.disabled = false;
        sendBtn.innerText = '发送';
        history.scrollTop = history.scrollHeight; // 滚到底部
    }
}

// 支持按回车键发送
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendToAI();
    }
}