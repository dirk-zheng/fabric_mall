const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, authenticateToken } = require('../middleware/auth');
const db = require('../database');
const { assertVisitorAvailable, bindVisitor, findAccount, normalizeUserName, normalizeVisitorId, safeAccount } = require('../services/identity');
const supportConversations = require('../services/supportConversations');

const router = express.Router();
function requestVisitorId(req) {
  return normalizeVisitorId(req.body?.visitorId || req.get('x-visitor-id'));
}

// POST /api/auth/login
//处理用户登录并返回用户信息与JWT令牌
router.post('/login', async (req, res) => {
  try {
    const userName = normalizeUserName(req.body?.userName);
    const { password } = req.body || {};
    const visitorId = requestVisitorId(req);

    if (!userName || !password) {
      return res.status(400).json({ code: 400, message: 'user_name and password are required' });
    }

    const user = findAccount(userName);

    if (!user) {
      await db.recordUserEvent({ visitorId, eventType: 'auth.login_failed', ip: req.ip, userAgent: req.get('user-agent'), data: { userName } });
      return res.status(401).json({ code: 401, message: 'Invalid user_name or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await db.recordUserEvent({ visitorId, eventType: 'auth.login_failed', ip: req.ip, userAgent: req.get('user-agent'), data: { userName } });
      return res.status(401).json({ code: 401, message: 'Invalid user_name or password' });
    }

    const boundUser = await bindVisitor(user, visitorId, { lastLoginAt: new Date().toISOString() });
    supportConversations.linkVisitorToUser(visitorId, boundUser);
    const token = generateToken(boundUser);
    await db.recordUserEvent({ visitorId, eventType: 'auth.login_succeeded', ip: req.ip, userAgent: req.get('user-agent'), data: { userName } });
    const behavior = await db.listUserBehavior(userName);

    res.json({
      code: 200,
      message: 'Login successful',
      data: {
        user: safeAccount(boundUser),
        token,
        behavior,
      }
    });
  } catch (err) {
    if (err.code === 'VISITOR_ALREADY_LINKED') return res.status(409).json({ code: 409, message: err.message });
    if (/visitorId/.test(err.message)) return res.status(400).json({ code: 400, message: err.message });
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// POST /api/auth/register
//处理新用户注册并生成登录令牌
router.post('/register', async (req, res) => {
  try {
    const userName = normalizeUserName(req.body?.userName);
    const { password, name, quoteReference } = req.body || {};
    const visitorId = requestVisitorId(req);

    if (!userName || !password) {
      return res.status(400).json({ code: 400, message: 'user_name and password are required' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ code: 400, message: 'Password must be at least 6 characters' });
    }

    if (findAccount(userName)) {
      return res.status(409).json({ code: 409, message: 'An account already uses this user_name' });
    }

    assertVisitorAvailable(userName, visitorId);

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      visitorId,
      userName,
      password: hashedPassword,
      role: 'user',
      name: name || userName,
      createdAt: new Date().toISOString(),
    };

    await db.upsert('users', visitorId, newUser);
    supportConversations.linkVisitorToUser(visitorId, newUser);

    if (quoteReference && userName.includes('@')) {
      const quotes = db.list('quotes');
      const quote = quotes.find((item) => item.reference === quoteReference && item.customer?.email?.toLowerCase() === userName);
      if (quote) {
        quote.visitorId = visitorId;
        quote.userName = userName;
        quote.accountLinkedAt = new Date().toISOString();
        await db.upsert('quotes', quote.id, quote);
      }
    }

    const token = generateToken(newUser);
    await db.recordUserEvent({ visitorId, eventType: 'auth.registered', ip: req.ip, userAgent: req.get('user-agent'), data: { userName } });
    const behavior = await db.listUserBehavior(userName);

    res.status(201).json({
      code: 201,
      message: 'Registration successful',
      data: {
        user: safeAccount(newUser),
        token,
        behavior,
      }
    });
  } catch (err) {
    if (err.code === 'VISITOR_ALREADY_LINKED') return res.status(409).json({ code: 409, message: err.message });
    if (/visitorId/.test(err.message)) return res.status(400).json({ code: 400, message: err.message });
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// GET /api/auth/me
//返回当前已登录用户信息
router.get('/me', authenticateToken, async (req, res) => {
  const behavior = await db.listUserBehavior(req.user.userName);
  res.json({
    code: 200,
    data: { user: req.user, behavior }
  });
});

module.exports = router;
