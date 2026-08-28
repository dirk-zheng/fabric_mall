const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const knownWeakSecrets = new Set([
  'digital-mall-secret-key-2024',
  'your-secret-key',
  'your-secret-key-here',
  'change-me',
]);

function resolveJwtSecret() {
  const configured = String(process.env.JWT_SECRET || '').trim();
  const isStrong = configured.length >= 32 && !knownWeakSecrets.has(configured.toLowerCase());

  if (isStrong) return configured;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a unique random value of at least 32 characters in production.');
  }

  console.warn('JWT_SECRET is missing or weak; using an ephemeral development secret. Existing sessions will expire after restart.');
  return crypto.randomBytes(48).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();

// Generate JWT Token
//生成用户身份认证JWT令牌
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Authentication middleware
//校验请求中的JWT令牌并写入当前用户信息
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ code: 401, message: 'Not authenticated. Please sign in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ code: 403, message: 'Token expired. Please sign in again.' });
  }
}

// Admin authorization middleware
//校验当前用户是否拥有管理员权限
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: 'Access denied. Admin only.' });
  }
  next();
}

module.exports = { JWT_SECRET, generateToken, authenticateToken, requireAdmin };
