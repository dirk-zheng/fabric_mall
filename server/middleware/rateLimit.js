const buckets = new Map();

function rateLimit({ windowMs = 15 * 60_000, max = 20, keyPrefix = 'request' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ code: 429, message: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

module.exports = rateLimit;
