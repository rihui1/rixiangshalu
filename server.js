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
// 经过 Cloudflare 隧道，需要信任代理才能拿到真实 IP
app.set('trust proxy', true);

// 简单的请求计数，供超管后台展示实时信息
let requestCount = 0;
app.use((req, res, next) => { requestCount += 1; next(); });

// ================= 反爬虫与基础防护 =================
app.disable('x-powered-by');

// 常见采集器 / AI 爬虫的 UA 特征，命中直接拒绝
const BAD_UA = /(python-requests|python-urllib|aiohttp|httpx|scrapy|curl\/|wget\/|libwww-perl|httpclient|go-http-client|okhttp|java\/|node-fetch|axios\/|headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|ahrefsbot|semrushbot|mj12bot|dotbot|blexbot|petalbot|serpstatbot|bytespider|gptbot|chatgpt-user|oai-searchbot|ccbot|claudebot|anthropic-ai|perplexitybot|amazonbot|imagesiftbot|diffbot|dataforseobot|zoominfobot)/i;
// 主流搜索引擎保留收录，避免误伤正常流量
const GOOD_UA = /(googlebot|google-inspectiontool|bingbot|baiduspider|sogou|360spider|yisouspider|msnbot|duckduckbot)/i;
// 探测后台、备份、源码的典型路径
const BAD_PATH = /(^|\/)(\.env|\.git|\.svn|\.hg|\.htaccess|\.DS_Store|wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|pma|adminer|config\.json|config\.php|backup|dump\.sql)|\.(php|asp|aspx|jsp|cgi|env|sql|bak|old|swp|zip|tar|gz|rar|7z)$/i;
// /api 限流：同一 IP 每分钟最多 180 次请求
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 180;
const rateHits = new Map();

function safeDecode(pathname) {
    try { return decodeURIComponent(pathname); } catch (e) { return pathname; }
}

app.use((req, res, next) => {
    const ua = String(req.headers['user-agent'] || '');
    if (!GOOD_UA.test(ua) && (!ua || BAD_UA.test(ua))) {
        return res.status(403).type('text/plain').send('403 Forbidden：本站禁止自动化采集');
    }
    if (BAD_PATH.test(safeDecode(req.path))) {
        return res.status(404).type('text/plain').send('404 Not Found');
    }
    next();
});

app.use('/api', (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    let rec = rateHits.get(ip);
    if (!rec || now - rec.start >= RATE_WINDOW_MS) rec = { start: now, count: 0 };
    rec.count += 1;
    rateHits.set(ip, rec);
    if (rateHits.size > 5000) {
        rateHits.forEach((v, k) => { if (now - v.start >= RATE_WINDOW_MS) rateHits.delete(k); });
    }
    if (rec.count > RATE_MAX) {
        res.setHeader('Retry-After', String(Math.ceil((rec.start + RATE_WINDOW_MS - now) / 1000)));
        return res.status(429).json({ error: '请求太频繁了，请稍后再试' });
    }
    next();
});

app.use(['/admin.html', '/api/admin'], (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

app.use(['/admin.html', '/api'], (req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
});

app.use(express.static('public'));

// 复制粘贴时容易带上空格或换行，这里统一去掉首尾空白
const EMAIL_USER = String(process.env.EMAIL_USER || '').trim();
const EMAIL_PASS = String(process.env.EMAIL_PASS || '').replace(/\s/g, '');

const transporter = nodemailer.createTransport({
    host: 'smtp.163.com',
    port: 465,
    secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    connectionTimeout: 10000
});

if (EMAIL_USER && EMAIL_PASS) {
    console.log(`发件邮箱：${EMAIL_USER}（授权码 ${EMAIL_PASS.length} 位）`);
    transporter.verify()
        .then(() => console.log('SMTP 登录成功，验证码邮件可以正常发送'))
        .catch((err) => console.error('SMTP 配置有问题，验证码将无法发送：', err.code || '', err.message));
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        hidden INTEGER DEFAULT 0
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
    CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin TEXT,
        action TEXT,
        target TEXT,
        detail TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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
// 超管后台需要的字段
try { db.exec("ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN chat_bonus INTEGER DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN last_active_at TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE posts ADD COLUMN hidden INTEGER DEFAULT 0;"); } catch (e) {}

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
        if (decoded.typ === 'admin') return { status: 401, error: '未登录' };
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
        if (!user) return { status: 404, error: '用户不存在' };
        if (user.banned) return { status: 403, error: '账号已被封禁，如有疑问请联系管理员' };
        // 记录活跃时间，供超管后台统计在线人数
        db.prepare("UPDATE users SET last_active_at = datetime('now', 'localtime') WHERE id = ?").run(user.id);
        return { user, decoded };
    } catch (err) {
        return { status: 401, error: '登录已过期' };
    }
}

// 记录登录成功的时间与次数
function markLogin(userId) {
    db.prepare(
        "UPDATE users SET last_login_at = datetime('now', 'localtime'), last_active_at = datetime('now', 'localtime'), login_count = COALESCE(login_count, 0) + 1 WHERE id = ?"
    ).run(userId);
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

// 每位用户的每日额度 = 全局默认额度 + 超管单独下发的额外额度
function chatQuota(user) {
    const bonus = Math.max(0, Number(user && user.chat_bonus) || 0);
    const limit = CHAT_DAILY_LIMIT + bonus;
    const used = chatUsedToday(user.id);
    return { used, limit, remaining: Math.max(0, limit - used), bonus, base: CHAT_DAILY_LIMIT };
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
    if (user.banned) return res.status(403).json({ error: '账号已被封禁，如有疑问请联系管理员' });

    markLogin(user.id);
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
            chat: chatQuota(user)
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
    if (user.banned) return res.status(403).json({ error: '账号已被封禁，如有疑问请联系管理员' });
    db.prepare('DELETE FROM email_codes WHERE email = ?').run(normalized);
    markLogin(user.id);
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
    if (!EMAIL_USER || !EMAIL_PASS) {
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
            from: `"日向的网站" <${EMAIL_USER}>`, to: email, subject: '【日向的网站】验证码',
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
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const content = String((req.body && req.body.content) || '').trim();
    if (!content) return res.status(400).json({ error: '内容不能为空' });
    db.prepare("INSERT INTO posts (username, content, created_at) VALUES (?, ?, datetime('now', 'localtime'))").run(auth.user.username, content);
    res.json({ message: '发帖成功' });
});

app.get('/api/posts', (req, res) => {
    const posts = db.prepare('SELECT * FROM posts WHERE COALESCE(hidden, 0) = 0 ORDER BY created_at DESC').all();
    res.json(posts);
});

// 读取当前用户的聊天记录和今日额度
app.get('/api/chat/history', (req, res) => {
    const auth = readUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const rows = db.prepare(
        'SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 100'
    ).all(auth.user.id).reverse();
    res.json({ messages: rows, quota: chatQuota(auth.user) });
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

    const quota = chatQuota(auth.user);
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

        res.json({ reply, quota: chatQuota(auth.user) });
    } catch (error) {
        console.error('AI 调用失败：', error.message);
        res.status(502).json({ error: 'AI 暂时不可用，请稍后再试' });
    }
});

// ================= 翻译 =================
const LANG_NAMES = {
    zh: '简体中文',
    en: '英语',
    ja: '日语',
    ko: '韩语',
    fr: '法语',
    de: '德语',
    es: '西班牙语',
    ru: '俄语',
    pt: '葡萄牙语',
    it: '意大利语',
    ar: '阿拉伯语',
    th: '泰语'
};
// 翻译限流：同一 IP 每分钟最多 20 次
const TRANSLATE_LIMIT = 20;
const translateHits = new Map();

app.post('/api/translate', async (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    let rec = translateHits.get(ip);
    if (!rec || now - rec.start >= 60000) rec = { start: now, count: 0 };
    rec.count += 1;
    translateHits.set(ip, rec);
    if (translateHits.size > 5000) {
        translateHits.forEach((v, k) => { if (now - v.start >= 60000) translateHits.delete(k); });
    }
    if (rec.count > TRANSLATE_LIMIT) {
        return res.status(429).json({ error: '翻译太频繁了，休息一下再试' });
    }

    const text = String((req.body && req.body.text) || '').trim();
    const from = String((req.body && req.body.from) || 'auto');
    const to = String((req.body && req.body.to) || 'zh');
    if (!text) return res.status(400).json({ error: '内容不能为空' });
    if (text.length > 4000) return res.status(400).json({ error: '内容太长，请控制在 4000 字以内' });
    if (!LANG_NAMES[to]) return res.status(400).json({ error: '不支持的目标语言' });
    if (from !== 'auto' && !LANG_NAMES[from]) return res.status(400).json({ error: '不支持的源语言' });
    if (from === to) return res.json({ text });

    const targetName = LANG_NAMES[to] === '简体中文' ? '中文' : LANG_NAMES[to];
    const sourceNote = from === 'auto' ? '请自动识别原文语言。' : '原文语言是' + LANG_NAMES[from] + '。';

    try {
        const response = await openai.chat.completions.create({
            model: CHAT_MODEL,
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: '你是专业翻译引擎。' + sourceNote + '把用户提供的内容准确、自然地翻译成' +
                        targetName + '。只输出译文本身，不要解释、不要加引号、不要附带原文。'
                },
                { role: 'user', content: text }
            ]
        });
        const out = String((response.choices && response.choices[0] && response.choices[0].message &&
            response.choices[0].message.content) || '').trim();
        if (!out) return res.status(502).json({ error: '翻译没有返回内容，请稍后再试' });
        res.json({ text: out });
    } catch (error) {
        console.error('翻译调用失败：', error.message);
        res.status(502).json({ error: '翻译服务暂时不可用，请稍后再试' });
    }
});

// ================= 超管后台 =================
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || '').trim();
const ADMIN_PASSWORD_HASH = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
const ADMIN_TOKEN_TTL = '2h';
// 登录失败限流：同一 IP 连续失败 5 次，锁定 10 分钟
const adminLoginFails = new Map();

function requireAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    const raw = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!raw) return res.status(401).json({ error: '请先登录超管后台' });
    try {
        const decoded = jwt.verify(raw, JWT_SECRET);
        if (decoded.typ !== 'admin' || decoded.username !== ADMIN_USERNAME) {
            return res.status(403).json({ error: '没有超管权限' });
        }
        req.admin = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

function logAdmin(req, action, target, detail) {
    db.prepare('INSERT INTO admin_logs (admin, action, target, detail) VALUES (?, ?, ?, ?)')
        .run((req.admin && req.admin.username) || 'unknown', action, String(target || ''), String(detail || ''));
}

app.post('/api/admin/login', async (req, res) => {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
        return res.status(503).json({ error: '服务器还没有配置超管账号（ADMIN_USERNAME / ADMIN_PASSWORD_HASH）' });
    }
    const ip = req.ip || 'unknown';
    const rec = adminLoginFails.get(ip) || { count: 0, until: 0 };
    if (rec.until > Date.now()) {
        const mins = Math.ceil((rec.until - Date.now()) / 60000);
        return res.status(429).json({ error: `尝试次数过多，请 ${mins} 分钟后再试` });
    }

    const username = String((req.body && req.body.username) || '').trim();
    const password = String((req.body && req.body.password) || '');
    let passOk = false;
    try { passOk = await bcrypt.compare(password, ADMIN_PASSWORD_HASH); } catch (e) { passOk = false; }

    if (username !== ADMIN_USERNAME || !passOk) {
        rec.count += 1;
        if (rec.count >= 5) { rec.count = 0; rec.until = Date.now() + 10 * 60 * 1000; }
        adminLoginFails.set(ip, rec);
        console.warn(`超管登录失败：ip=${ip} 账号=${username}`);
        return res.status(401).json({ error: '账号或密码不正确' });
    }

    adminLoginFails.delete(ip);
    db.prepare('INSERT INTO admin_logs (admin, action, target, detail) VALUES (?, ?, ?, ?)')
        .run(username, 'login', ip, '超管登录成功');
    const token = jwt.sign({ typ: 'admin', username: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: ADMIN_TOKEN_TTL });
    res.json({ token, username: ADMIN_USERNAME });
});

// 概览：用户量、在线、发帖、AI 用量、服务器实时状态
app.get('/api/admin/overview', requireAdmin, (req, res) => {
    const os = require('os');
    const fs = require('fs');
    const count = (sql) => db.prepare(sql).get().n;
    const mem = process.memoryUsage();
    let dbSize = 0;
    try { dbSize = fs.statSync('./database.db').size; } catch (e) {}

    res.json({
        server_time: new Date().toLocaleString('zh-CN', { hour12: false }),
        server: {
            uptimeSec: Math.floor(process.uptime()),
            requests: requestCount,
            rssMB: +(mem.rss / 1048576).toFixed(1),
            memUsedMB: Math.round((os.totalmem() - os.freemem()) / 1048576),
            memTotalMB: Math.round(os.totalmem() / 1048576),
            loadavg: Number(os.loadavg()[0]).toFixed(2),
            node: process.version,
            platform: os.platform() + ' ' + os.arch(),
            dbSizeMB: +(dbSize / 1048576).toFixed(2)
        },
        users: {
            total: count('SELECT COUNT(*) AS n FROM users'),
            banned: count('SELECT COUNT(*) AS n FROM users WHERE COALESCE(banned, 0) = 1'),
            todayNew: count("SELECT COUNT(*) AS n FROM users WHERE date(created_at) = date('now', 'localtime')"),
            activeToday: count("SELECT COUNT(*) AS n FROM users WHERE date(last_active_at) = date('now', 'localtime')"),
            online5m: count("SELECT COUNT(*) AS n FROM users WHERE last_active_at >= datetime('now', 'localtime', '-5 minutes')")
        },
        posts: {
            total: count('SELECT COUNT(*) AS n FROM posts'),
            hidden: count('SELECT COUNT(*) AS n FROM posts WHERE COALESCE(hidden, 0) = 1'),
            today: count("SELECT COUNT(*) AS n FROM posts WHERE date(created_at) = date('now', 'localtime')")
        },
        chat: {
            todayMessages: count("SELECT COUNT(*) AS n FROM chat_messages WHERE role = 'user' AND date(created_at, 'localtime') = date('now', 'localtime')"),
            totalMessages: count('SELECT COUNT(*) AS n FROM chat_messages'),
            defaultLimit: CHAT_DAILY_LIMIT
        },
        recentLogins: db.prepare(
            'SELECT username, last_login_at FROM users WHERE last_login_at IS NOT NULL ORDER BY last_login_at DESC LIMIT 8'
        ).all(),
        logs: db.prepare('SELECT admin, action, target, detail, created_at FROM admin_logs ORDER BY id DESC LIMIT 12').all()
    });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = 20;
    const like = '%' + q + '%';
    const where = q ? 'WHERE username LIKE ? OR email LIKE ? OR COALESCE(uid, \'\') LIKE ?' : '';
    const params = q ? [like, like, like] : [];

    const total = db.prepare('SELECT COUNT(*) AS n FROM users ' + where).get(...params).n;
    const users = db.prepare(
        'SELECT id, uid, username, email, created_at, last_login_at, last_active_at, login_count, chat_bonus, banned FROM users ' +
        where + ' ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(...params, size, (page - 1) * size).map((u) => ({
        ...u,
        chatToday: chatUsedToday(u.id),
        chatLimit: CHAT_DAILY_LIMIT + Math.max(0, Number(u.chat_bonus) || 0)
    }));

    res.json({ total, page, size, users });
});

// 给某个账号下发额外聊天额度
app.post('/api/admin/users/quota', requireAdmin, (req, res) => {
    const id = Number(req.body && req.body.id);
    const bonus = Math.max(0, Math.min(100000, Math.floor(Number(req.body && req.body.bonus) || 0)));
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    db.prepare('UPDATE users SET chat_bonus = ? WHERE id = ?').run(bonus, id);
    logAdmin(req, 'quota', user.username, '额外额度设为 ' + bonus);
    res.json({ message: '已更新', bonus });
});

app.post('/api/admin/users/ban', requireAdmin, (req, res) => {
    const id = Number(req.body && req.body.id);
    const banned = req.body && req.body.banned ? 1 : 0;
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned, id);
    logAdmin(req, banned ? 'ban' : 'unban', user.username, banned ? '封禁账号' : '解封账号');
    res.json({ message: banned ? '已封禁' : '已解封', banned });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    db.prepare('DELETE FROM posts WHERE username = ?').run(user.username);
    db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    logAdmin(req, 'delete_user', user.username, '删除账号及其帖子、聊天记录');
    res.json({ message: '已删除' });
});

app.get('/api/admin/posts', requireAdmin, (req, res) => {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = 20;
    const like = '%' + q + '%';
    const where = q ? 'WHERE content LIKE ? OR username LIKE ?' : '';
    const params = q ? [like, like] : [];

    const total = db.prepare('SELECT COUNT(*) AS n FROM posts ' + where).get(...params).n;
    const posts = db.prepare('SELECT * FROM posts ' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?')
        .all(...params, size, (page - 1) * size);
    res.json({ total, page, size, posts });
});

app.post('/api/admin/posts/hide', requireAdmin, (req, res) => {
    const id = Number(req.body && req.body.id);
    const hidden = req.body && req.body.hidden ? 1 : 0;
    const post = db.prepare('SELECT id, username FROM posts WHERE id = ?').get(id);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    db.prepare('UPDATE posts SET hidden = ? WHERE id = ?').run(hidden, id);
    logAdmin(req, hidden ? 'hide_post' : 'show_post', post.username, (hidden ? '隐藏帖子 #' : '恢复帖子 #') + id);
    res.json({ message: hidden ? '已隐藏' : '已恢复', hidden });
});

app.delete('/api/admin/posts/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const post = db.prepare('SELECT id, username FROM posts WHERE id = ?').get(id);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    logAdmin(req, 'delete_post', post.username, '删除帖子 #' + id);
    res.json({ message: '已删除' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`后端已启动: http://localhost:${port}`); });
