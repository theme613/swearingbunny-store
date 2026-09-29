import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve, extname, basename, join } from 'node:path';
import { writeFile, mkdir, readdir } from 'node:fs/promises';

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

  // 6. Protected Image Upload & Asset Management
  app.get('/api/admin/assets', requireAuth, async (req, res, next) => {
    try {
      const assetsDir = resolve(root, 'public', 'assets');
      const uploadsDir = resolve(root, 'public', 'assets', 'uploads');
      const validExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);

      let mainAssets = [];
      try {
        const files = await readdir(assetsDir, { withFileTypes: true });
        mainAssets = files
          .filter(f => f.isFile() && validExts.has(extname(f.name).toLowerCase()))
          .map(f => `assets/${f.name}`);
      } catch { /* ignore */ }

      let uploadAssets = [];
      try {
        const uFiles = await readdir(uploadsDir, { withFileTypes: true });
        uploadAssets = uFiles
          .filter(f => f.isFile() && validExts.has(extname(f.name).toLowerCase()))
          .map(f => `assets/uploads/${f.name}`);
      } catch { /* ignore */ }

      res.json({ assets: [...uploadAssets, ...mainAssets] });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/upload-image', requireAuth, async (req, res, next) => {
    try {
      const { filename, data } = req.body || {};
      if (!data || typeof data !== 'string') {
        return res.status(400).json({ error: 'Image data is required.' });
      }

      const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let extension = '.png';

      const allowedMimes = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/svg+xml': '.svg'
      };

      if (matches && matches.length === 3) {
        const mimeType = matches[1].toLowerCase();
        if (!allowedMimes[mimeType]) {
          return res.status(400).json({ error: 'Unsupported image type. Please upload a PNG, JPG, WEBP, GIF, or SVG.' });
        }
        extension = allowedMimes[mimeType];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(data, 'base64');
        if (filename) {
          const rawExt = extname(filename).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(rawExt)) {
            extension = rawExt === '.jpeg' ? '.jpg' : rawExt;
          }
        }
      }

      if (buffer.length > 15 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image file size exceeds maximum limit of 15MB.' });
      }

      const rawBase = filename ? basename(filename, extname(filename)) : 'upload';
      const cleanName = rawBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
      const uniqueSuffix = randomBytes(4).toString('hex');
      const finalFilename = `${cleanName}-${uniqueSuffix}${extension}`;

      const uploadDir = resolve(root, 'public', 'assets', 'uploads');
      await mkdir(uploadDir, { recursive: true });
      const targetPath = join(uploadDir, finalFilename);
      await writeFile(targetPath, buffer);

      const assetPath = `assets/uploads/${finalFilename}`;
      res.json({ success: true, url: assetPath, filename: finalFilename });
    } catch (err) {
      next(err);
    }
  });
}
