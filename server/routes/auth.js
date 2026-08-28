const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { generateToken, authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();
function readUsers() {
  return db.list('users').map((user) => (
    user.role === 'salesperson' ? { ...user, role: 'seller' } : user
  ));
}

// POST /api/auth/login
//处理用户登录并返回用户信息与JWT令牌
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ code: 400, message: 'Username and password are required' });
    }

    const users = readUsers();
    //根据用户名查找登录用户
    const loginName = String(username).trim().toLowerCase();
    const user = users.find(u => String(u.username).toLowerCase() === loginName);

    if (!user) {
      await db.recordUserEvent({ eventType: 'auth.login_failed', ip: req.ip, userAgent: req.get('user-agent'), data: { username: loginName } });
      return res.status(401).json({ code: 401, message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await db.recordUserEvent({ userId: user.id, eventType: 'auth.login_failed', ip: req.ip, userAgent: req.get('user-agent') });
      return res.status(401).json({ code: 401, message: 'Invalid username or password' });
    }

    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    await db.recordUserEvent({ userId: user.id, eventType: 'auth.login_succeeded', ip: req.ip, userAgent: req.get('user-agent') });

    res.json({
      code: 200,
      message: 'Login successful',
      data: {
        user: safeUser,
        token
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// POST /api/auth/register
//处理新用户注册并生成登录令牌
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, quoteReference } = req.body;

    if (!username || !password) {
      return res.status(400).json({ code: 400, message: 'Username and password are required' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ code: 400, message: 'Password must be at least 6 characters' });
    }

    const users = readUsers();
    const normalizedUsername = String(username).trim();
    const accountUsername = normalizedUsername.includes('@') ? normalizedUsername.toLowerCase() : normalizedUsername;
    
    //检查注册用户名是否已经存在
    if (users.some(u => String(u.username).toLowerCase() === accountUsername.toLowerCase())) {
      return res.status(409).json({ code: 409, message: 'An account already uses this email or username' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      username: accountUsername,
      password: hashedPassword,
      role: 'user',
      name: name || accountUsername
    };

    await db.upsert('users', newUser.id, newUser);

    if (quoteReference && accountUsername.includes('@')) {
      const quotes = db.list('quotes');
      const quote = quotes.find((item) => item.reference === quoteReference && item.customer?.email?.toLowerCase() === accountUsername);
      if (quote) {
        quote.userId = newUser.id;
        quote.accountLinkedAt = new Date().toISOString();
        await db.upsert('quotes', quote.id, quote);
      }
    }

    const token = generateToken(newUser);
    const { password: _, ...safeUser } = newUser;
    await db.recordUserEvent({ userId: newUser.id, eventType: 'auth.registered', ip: req.ip, userAgent: req.get('user-agent') });

    res.status(201).json({
      code: 201,
      message: 'Registration successful',
      data: {
        user: safeUser,
        token
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// GET /api/auth/me
//返回当前已登录用户信息
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    code: 200,
    data: req.user
  });
});

module.exports = router;
