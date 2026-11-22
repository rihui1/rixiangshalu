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
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const openai = new OpenAI({
    apiKey: 'sk-cyscaygfporxnhagizpoezntsrrgovanhcwxumdxmytxfcwy',
    baseURL: 'https://api.siliconflow.cn/v1'
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
        expires_at INTEGER
    );
`);

// 2. 为了防止旧数据库报错，尝试动态添加字段（如果已存在会报错，直接忽略）
try { db.exec("ALTER TABLE users ADD COLUMN uid TEXT UNIQUE;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN signature TEXT DEFAULT '这个人很懒，什么都没写';"); } catch (e) {}

const JWT_SECRET = 'your_super_secret_key';

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

// 注册接口
app.post('/api/register', async (req, res) => {
    const { username, password, email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: '邮箱和验证码不能为空' });

    const codeRecord = db.prepare('SELECT * FROM email_codes WHERE email = ?').get(email);
    if (!codeRecord || codeRecord.code !== code) return res.status(400).json({ error: '验证码错误' });
    if (Date.now() > codeRecord.expires_at) return res.status(400).json({ error: '验证码已过期' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUid = generateUID(); // 生成随机8位UID
        
        const insert = db.prepare('INSERT INTO users (uid, username, password, email) VALUES (?, ?, ?, ?)');
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

// 获取用户信息
app.get('/api/user/profile', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: '未登录' });
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: '登录已过期' });
        
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
        if (!user) return res.status(404).json({ error: '用户不存在' });
        
        res.json({ 
            uid: user.uid || '未分配', 
            username: user.username, 
            signature: user.signature || '这个人很懒，什么都没写',
            avatar: user.avatar 
        });
    });
});

// 更新用户信息
app.post('/api/user/update', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: '未登录' });
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: '登录已过期' });
        
        const { avatar, signature } = req.body;
        try {
            if (avatar) {
                db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, decoded.id);
            }
            if (signature !== undefined) {
                db.prepare('UPDATE users SET signature = ? WHERE id = ?').run(signature, decoded.id);
            }
            res.json({ message: '更新成功' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: '更新失败' });
        }
    });
});

// ================= 原有功能 =================
app.post('/api/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱' });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    try {
        db.prepare('INSERT OR REPLACE INTO email_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);
        await transporter.sendMail({
            from: `"日向的网站" <${process.env.EMAIL_USER}>`, to: email, subject: '【日向的网站】验证码',
            html: `<p>您的验证码是：<strong>${code}</strong>，5分钟内有效。</p>`
        });
        res.json({ message: '发送成功' });
    } catch (error) { res.status(500).json({ error: '发送失败' }); }
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

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    try {
        const response = await openai.chat.completions.create({
            model: "Qwen/Qwen2.5-7B-Instruct",
            messages: [{ role: "user", content: message }],
        });
        res.json({ reply: response.choices[0].message.content });
    } catch (error) { res.status(500).json({ error: 'AI开小差' }); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`后端已启动: http://localhost:${port}`); });