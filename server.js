require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');

const app = express();
// 必须调大限制，否则 Base64 头像传不上去
app.use(express.json({ limit: '10mb' })); 
app.use(express.static('public'));

const transporter = nodemailer.createTransport({
    host: 'smtp.163.com',
    port: 465,
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 10000
});

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter.verify()
        .then(() => console.log('SMTP 登录成功，验证码邮件可以正常发送'))
        .catch((err) => console.error('SMTP 配置有问题，验证码将无法发送：', err.message));
} else {
    console.warn('未配置 EMAIL_USER / EMAIL_PASS，验证码邮件功能不可用');
}

const openai = new OpenAI({
    apiKey: process.env.SILICONFLOW_API_KEY,
    baseURL: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1'
});

const db = new Database('./database.db');

// 1. 初始化表结构，加入 uid 和 avatar 字段
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT UNIQUE,
        signature TEXT DEFAULT '这个人很懒，什么都没写',
        avatar TEXT
    );
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS email_codes (
        email TEXT PRIMARY KEY,
        code TEXT,
        expires_at INTEGER,
        sent_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages (user_id, id);
`);

// 2. 为了防止旧数据库报错，尝试动态添加字段（如果已存在会报错，直接忽略）
// SQLite 不允许 ALTER TABLE 直接加 UNIQUE 列，只能先加普通列再建唯一索引
try { db.exec("ALTER TABLE users ADD COLUMN uid TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN signature TEXT DEFAULT '这个人很懒，什么都没写';"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN birthday TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN created_at DATETIME;"); } catch (e) {}
try { db.exec("ALTER TABLE email_codes ADD COLUMN sent_at INTEGER;"); } catch (e) {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users (uid);"); } catch (e) {}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('缺少环境变量 JWT_SECRET，请在 .env 中配置后重新启动');
    process.exit(1);
}

// 每个用户每天最多可以发多少条 AI 消息
const CHAT_DAILY_LIMIT = Math.max(1, Number(process.env.CHAT_DAILY_LIMIT) || 50);
const CHAT_MODEL = process.env.CHAT_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

// 生成不重复的 8 位随机 UID
function generateUID() {
    let uid;
    let isUnique = false;
    while (!isUnique) {
        // 生成 10000000 到 99999999 之间的数字
        uid = Math.floor(10000000 + Math.random() * 90000000).toString();
        const existing = db.prepare('SELECT id FROM users WHERE uid = ?').get(uid);
        if (!existing) isUnique = true;
    }
    return uid;
}
function ensureUid(user) {
    if (user.uid) return user.uid;
    const uid = generateUID();
    db.prepare('UPDATE users SET uid = ? WHERE id = ?').run(uid, user.id);
    user.uid = uid;
    return uid;
}

function backfillUids() {
    const rows = db.prepare("SELECT id FROM users WHERE uid IS NULL OR uid = ''").all();
    const update = db.prepare('UPDATE users SET uid = ? WHERE id = ?');
    rows.forEach((row) => update.run(generateUID(), row.id));
}
backfillUids();

function readUser(req) {
    const header = req.headers.authorization || '';
    const raw = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!raw) return { status: 401, error: '未登录' };
    try {
        const decoded = jwt.verify(raw, JWT_SECRET);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
        if (!user) return { status: 404, error: '用户不存在' };
        return { user, decoded };
    } catch (err) {
        return { status: 401, error: '登录已过期' };
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

// 今天已用掉的 AI 消息条数（按服务器本地时区自然日）
function chatUsedToday(userId) {
    const row = db.prepare(
        "SELECT COUNT(*) AS n FROM chat_messages WHERE user_id = ? AND role = 'user' AND date(created_at, 'localtime') = date('now', 'localtime')"
    ).get(userId);
    return row ? row.n : 0;
}

function chatQuota(userId) {
    const used = chatUsedToday(userId);
    return { used, limit: CHAT_DAILY_LIMIT, remaining: Math.max(0, CHAT_DAILY_LIMIT - used) };
}
// 注册接口
app.post('/api/register', async (req, res) => {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();

    if (!username || !password || !email || !code) return res.status(400).json({ error: '请填写完整信息' });
    if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名需要 2-20 个字符' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
    if (!isValidEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });

    const codeRecord = db.prepare('SELECT * FROM email_codes WHERE email = ?').get(email);
    if (!codeRecord || codeRecord.code !== code) return res.status(400).json({ error: '验证码错误' });
    if (Date.now() > codeRecord.expires_at) return res.status(400).json({ error: '验证码已过期' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUid = generateUID(); // 生成随机8位UID

        const insert = db.prepare("INSERT INTO users (uid, username, password, email, created_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))");
        insert.run(newUid, username, hashedPassword, email);

        db.prepare('DELETE FROM email_codes WHERE email = ?').run(email);
        res.json({ message: '注册成功' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: '用户名或邮箱已被注册' });
        }
        res.status(500).json({ error: '服务器错误：' + err.message });
    }
});

// 登录接口
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) return res.status(400).json({ error: '用户不存在' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: '密码错误' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, username: user.username, avatar: user.avatar });
});

// ========== 用户中心接口 (重点修复) ==========

app.get('/api/user/profile', (req, res) => {
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const user = auth.user;
    const postCount = db.prepare('SELECT COUNT(*) AS n FROM posts WHERE username = ?').get(user.username).n;
    res.json({
        uid: ensureUid(user),
        username: user.username,
        email: user.email || '',
        signature: user.signature || '这个人很懒，什么都没写',
        avatar: user.avatar,
        birthday: user.birthday || '',
        created_at: user.created_at || '',
        stats: {
            posts: postCount,
            chat: chatQuota(user.id)
        }
    });
});

app.post('/api/user/delete', (req, res) => {
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const confirmName = (req.body && req.body.confirm) || '';
    if (confirmName !== auth.user.username) {
        return res.status(400).json({ error: '请输入正确的用户名以确认注销' });
    }
    db.prepare('DELETE FROM posts WHERE username = ?').run(auth.user.username);
    db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(auth.user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(auth.user.id);
    res.json({ message: '账号已注销' });
});

app.post('/api/login-email', (req, res) => {
    const { email, code } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !code) return res.status(400).json({ error: '邮箱和验证码不能为空' });
    const codeRecord = db.prepare('SELECT * FROM email_codes WHERE email = ?').get(normalized);
    if (!codeRecord || codeRecord.code !== String(code).trim()) return res.status(400).json({ error: '验证码错误' });
    if (Date.now() > codeRecord.expires_at) return res.status(400).json({ error: '验证码已过期' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
    if (!user) return res.status(400).json({ error: '该邮箱未注册' });
    db.prepare('DELETE FROM email_codes WHERE email = ?').run(normalized);
    const loginToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token: loginToken, username: user.username, avatar: user.avatar });
});
// 更新用户信息
app.post('/api/user/update', (req, res) => {
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { avatar, signature, birthday } = req.body || {};
    try {
        if (typeof avatar === 'string' && avatar) {
            db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, auth.user.id);
        }
        if (signature !== undefined) {
            db.prepare('UPDATE users SET signature = ? WHERE id = ?').run(String(signature).slice(0, 200), auth.user.id);
        }
        if (birthday !== undefined) {
            const value = String(birthday).trim();
            if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return res.status(400).json({ error: '生日格式不正确' });
            db.prepare('UPDATE users SET birthday = ? WHERE id = ?').run(value, auth.user.id);
        }
        res.json({ message: '更新成功' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '更新失败' });
    }
});

// 修改密码
app.post('/api/user/change-password', async (req, res) => {
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json({ error: '请填写当前密码和新密码' });
    if (String(newPassword).length < 6) return res.status(400).json({ error: '新密码至少 6 位' });

    try {
        const valid = await bcrypt.compare(String(oldPassword), auth.user.password);
        if (!valid) return res.status(400).json({ error: '当前密码不正确' });
        const hashed = await bcrypt.hash(String(newPassword), 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, auth.user.id);
        res.json({ message: '密码已修改，请重新登录' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '修改失败，请稍后再试' });
    }
});

// 更换绑定邮箱（验证码发到新邮箱）
app.post('/api/user/bind-email', (req, res) => {
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { email, code } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    const inputCode = String(code || '').trim();
    if (!normalized || !inputCode) return res.status(400).json({ error: '请填写新邮箱和验证码' });
    if (!isValidEmail(normalized)) return res.status(400).json({ error: '邮箱格式不正确' });

    const codeRecord = db.prepare('SELECT * FROM email_codes WHERE email = ?').get(normalized);
    if (!codeRecord || codeRecord.code !== inputCode) return res.status(400).json({ error: '验证码错误' });
    if (Date.now() > codeRecord.expires_at) return res.status(400).json({ error: '验证码已过期' });

    const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalized, auth.user.id);
    if (taken) return res.status(400).json({ error: '该邮箱已被其他账号绑定' });

    try {
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalized, auth.user.id);
        db.prepare('DELETE FROM email_codes WHERE email = ?').run(normalized);
        res.json({ message: '邮箱已更新', email: normalized });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: '该邮箱已被其他账号绑定' });
        console.error(e);
        res.status(500).json({ error: '绑定失败，请稍后再试' });
    }
});

// ================= 原有功能 =================
app.post('/api/send-code', async (req, res) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: '请输入邮箱' });
    if (!isValidEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('send-code 失败：.env 中缺少 EMAIL_USER 或 EMAIL_PASS');
        return res.status(500).json({ error: '服务器还没有配置发件邮箱，暂时无法发送验证码' });
    }

    const existing = db.prepare('SELECT sent_at FROM email_codes WHERE email = ?').get(email);
    if (existing && existing.sent_at && Date.now() - existing.sent_at < 60 * 1000) {
        return res.status(429).json({ error: '发送太频繁了，请 1 分钟后再试' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    try {
        db.prepare('INSERT OR REPLACE INTO email_codes (email, code, expires_at, sent_at) VALUES (?, ?, ?, ?)')
            .run(email, code, expiresAt, Date.now());
        await transporter.sendMail({
            from: `"日向的网站" <${process.env.EMAIL_USER}>`, to: email, subject: '【日向的网站】验证码',
            html: `<p>您的验证码是：<strong>${code}</strong>，5 分钟内有效。</p><p>如果不是你本人操作，请忽略这封邮件。</p>`
        });
        res.json({ message: '发送成功' });
    } catch (error) {
        console.error('验证码邮件发送失败：', error.code || '', error.message);
        let hint = '邮件发送失败，请稍后再试';
        if (error.code === 'EAUTH' || /535|authentication/i.test(error.message)) {
            hint = '发件邮箱授权码不正确，请联系管理员检查邮箱配置';
        } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
            hint = '服务器连接邮箱服务超时，请稍后再试';
        } else if (error.code === 'EENVELOPE') {
            hint = '收件邮箱地址不可用，请检查是否填写正确';
        }
        res.status(500).json({ error: hint });
    }
});

app.post('/api/posts', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: '请先登录' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: '登录已过期' });
        const { content } = req.body;
        db.prepare('INSERT INTO posts (username, content) VALUES (?, ?)').run(decoded.username, content);
        res.json({ message: '发帖成功' });
    });
});

app.get('/api/posts', (req, res) => {
    const posts = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
    res.json(posts);
});

// 读取当前用户的聊天记录和今日额度
app.get('/api/chat/history', (req, res) => {
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const rows = db.prepare(
        'SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 100'
    ).all(auth.user.id).reverse();
    res.json({ messages: rows, quota: chatQuota(auth.user.id) });
});

// 清空当前用户的聊天记录
app.delete('/api/chat/history', (req, res) => {
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(auth.user.id);
    res.json({ message: '已清空' });
});

app.post('/api/chat', async (req, res) => {
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const message = String((req.body && req.body.message) || '').trim();
    if (!message) return res.status(400).json({ error: '消息不能为空' });
    if (message.length > 2000) return res.status(400).json({ error: '消息太长了，请控制在 2000 字以内' });

    const quota = chatQuota(auth.user.id);
    if (quota.remaining <= 0) {
        return res.status(429).json({
            error: `今天的 ${CHAT_DAILY_LIMIT} 条额度已经用完啦，明天再来吧`,
            quota
        });
    }

    const recent = db.prepare(
        'SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 10'
    ).all(auth.user.id).reverse();

    try {
        const response = await openai.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                { role: 'system', content: '你是日向论坛网站上的 AI 助手「日向」，用简洁、友好的中文回答。' },
                ...recent,
                { role: 'user', content: message }
            ]
        });
        const reply = (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) || '';

        const insert = db.prepare('INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)');
        insert.run(auth.user.id, 'user', message);
        insert.run(auth.user.id, 'assistant', reply);

        res.json({ reply, quota: chatQuota(auth.user.id) });
    } catch (error) {
        console.error('AI 调用失败：', error.message);
        res.status(502).json({ error: 'AI 暂时不可用，请稍后再试' });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`后端已启动: http://localhost:${port}`); });
