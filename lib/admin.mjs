import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';

export function mountAdmin(app, store, root) {
  const csrfToken = randomBytes(32).toString('hex');
  const activeSessions = new Map(); // token -> { expiresAt, ip }
  const failedAttempts = new Map(); // ip -> { count, lockedUntil }

  const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
  const MAX_FAILED = 5;
  const LOCKOUT_MS = 15 * 60 * 1000; // 15 mins lockout

  function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  }

  function getCookie(req, name) {
    const raw = req.headers.cookie;
    if (!raw) return null;
    const match = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function getAdminPassword() {
    return (process.env.ADMIN_PASSWORD || '').trim() || 'swearingbunny2026!';
  }

  function isAuthenticated(req) {
    const token = getCookie(req, 'sb_admin_session') || req.get('X-Admin-Token');
    if (!token || !activeSessions.has(token)) return false;
    const session = activeSessions.get(token);
    if (Date.now() > session.expiresAt) {
      activeSessions.delete(token);
      return false;
    }
    return true;
  }

  function requireAuth(req, res, next) {
    res.set('Cache-Control', 'no-store');
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'Admin authentication required.', requiresAuth: true });
    }
    next();
  }

  // Rate limiter check
  function checkRateLimit(ip) {
    const record = failedAttempts.get(ip);
    if (!record) return { allowed: true };
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      const waitMins = Math.ceil((record.lockedUntil - Date.now()) / 60000);
      return { allowed: false, error: `Too many failed login attempts. Please try again in ${waitMins} minute(s).` };
    }
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
      failedAttempts.delete(ip);
      return { allowed: true };
    }
    return { allowed: true };
  }

  function recordFailedLogin(ip) {
    const record = failedAttempts.get(ip) || { count: 0, lockedUntil: null };
    record.count += 1;
    if (record.count >= MAX_FAILED) {
      record.lockedUntil = Date.now() + LOCKOUT_MS;
    }
    failedAttempts.set(ip, record);
  }

  function clearFailedLogin(ip) {
    failedAttempts.delete(ip);
  }

  // 1. Session status check endpoint
  app.get('/api/admin/session', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ authenticated: isAuthenticated(req) });
  });

  // 2. Admin Login endpoint
  app.post('/api/admin/login', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const ip = getClientIp(req);
    const limitCheck = checkRateLimit(ip);
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: limitCheck.error });
    }

    const { password } = req.body || {};
    const adminPass = getAdminPassword();

    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const passBuffer = Buffer.from(password);
    const targetBuffer = Buffer.from(adminPass);
    const match = passBuffer.length === targetBuffer.length && timingSafeEqual(passBuffer, targetBuffer);

    if (!match) {
      recordFailedLogin(ip);
      const remaining = MAX_FAILED - (failedAttempts.get(ip)?.count || 0);
      return res.status(401).json({
        error: remaining > 0 
          ? `Incorrect password. ${remaining} attempt(s) remaining before temporary lockout.` 
          : 'Too many failed attempts. Locked out for 15 minutes.'
      });
    }

    clearFailedLogin(ip);
    const sessionToken = randomBytes(32).toString('hex');
    activeSessions.set(sessionToken, {
      expiresAt: Date.now() + SESSION_TTL,
      ip
    });

    res.setHeader('Set-Cookie', `sb_admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    res.json({ success: true, token: sessionToken, csrfToken });
  });

  // 3. Admin Logout endpoint
  app.post('/api/admin/logout', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const token = getCookie(req, 'sb_admin_session') || req.get('X-Admin-Token');
    if (token) activeSessions.delete(token);
    res.setHeader('Set-Cookie', 'sb_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // 4. Admin HTML interface
  app.get('/admin', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(resolve(root, 'admin', 'index.html'));
  });

  // 5. Protected Product APIs
  app.get('/api/admin/products', requireAuth, async (req, res, next) => {
    try {
      res.json({ ...await store.read(), csrfToken });
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/admin/products', requireAuth, async (req, res, next) => {
    try {
      const supplied = req.get('X-CSRF-Token') || '';
      if (Buffer.byteLength(supplied) !== Buffer.byteLength(csrfToken) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(csrfToken))) {
        return res.status(403).json({ error: 'Your editing session expired. Reload the page and try again.' });
      }
      const updated = await store.save(req.body.products, req.body.version);
      res.json({ ...updated, csrfToken });
    } catch (err) {
      next(err);
    }
  });
}
