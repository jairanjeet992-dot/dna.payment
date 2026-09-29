const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { GoogleGenAI, Modality, Type } = require('@google/genai');


// --- CRASH PROTECTION & LIFECYCLE ---
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
  if (err.code === 'EADDRINUSE') {
    console.error('[CRITICAL] Port in use, exiting for supervisor restart.');
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection:', reason);
});

function handleShutdown(signal) {
  console.log(`[SERVER] Received ${signal}. Shutting down gracefully...`);
  try { if (typeof wss !== 'undefined') wss.close(); } catch (e) {}
  try {
    if (typeof server !== 'undefined') {
      server.close(() => {
        console.log('[SERVER] Server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch (e) {
    process.exit(0);
  }
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
// ------------------------------------

const app = express();
app.disable('x-powered-by');
const compression = require('compression');

// Smart Gzip/Brotli compression middleware (skips <1KB and streaming endpoints)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression'] || req.path.startsWith('/live') || req.path.startsWith('/api/gemini/parse-case')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });
const port = 3000;
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// HTTP Security Headers (Protection against Clickjacking, MIME-sniffing, XSS)
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// CORS middleware to support Cloudflare Pages (https://dna-payments.pages.dev) and local development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://dna-payments.pages.dev',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];
  if (allowedOrigins.includes(origin) || (origin && origin.endsWith('.pages.dev'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token, x-investigator-token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Body parsing middleware for JSON and raw data (supporting base64 PDFs and images up to 25MB)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Public Health Check & Uptime Keep-Alive Endpoint (Keeps both Render and Supabase active)
app.get('/api/health', async (req, res) => {
  try {
    const start = Date.now();
    const { data, error } = await supabase.from('agency_settings').select('id').limit(1);
    const latency = Date.now() - start;
    res.json({
      status: 'ok',
      service: 'dna-payment-backend',
      uptimeSeconds: Math.floor(process.uptime()),
      database: error ? `error: ${error.message}` : 'connected',
      latencyMs: latency,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================
// AUTOMATED DATABASE BACKUP ENGINE (FOR SUPABASE FREE TIER)
// ============================================================
const BACKUPS_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Load Supabase credentials (uses service role key for automated backend backups if provided)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aacvwozpfjuhcvihnaen.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3Z3b3pwZmp1aGN2aWhuYWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzc2MjUsImV4cCI6MjEwMjM1MzYyNX0.nPHpd2YeC-VgF-xKCKO7kLzr_5TncD84b8IOzoiKAIk';
const SUPABASE_SERVER_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Auth helper middleware for protected endpoints
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ')) 
      ? authHeader.slice(7) 
      : (req.query.token || req.headers['x-admin-token']);

    // Dedicated admin secret support
    if (process.env.ADMIN_SECRET_KEY && req.headers['x-admin-token'] === process.env.ADMIN_SECRET_KEY) {
      return next();
    }

    if (!token) {
      // Direct local development check (cannot be spoofed via HTTP Host header or reverse proxy)
      const clientIp = req.socket.remoteAddress || '';
      const isDirectLocal = !req.headers['x-forwarded-for'] && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIp);
      if (isDirectLocal) {
        return next();
      }
      return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(403).json({ success: false, error: 'Access denied: Invalid or expired session.' });
    }
    req.user = data.user;
    next();
  } catch (err) {
    console.error('[AUTH ERROR]', err);
    return res.status(500).json({ success: false, error: 'Authentication verification failed.' });
  }
}

let isBackupInProgress = false;

async function executeDatabaseBackup(triggerType = 'scheduled') {
  if (isBackupInProgress) {
    return { success: false, message: 'Backup already in progress.' };
  }
  isBackupInProgress = true;
  console.log(`[BACKUP] Starting automated database backup (${triggerType})...`);

  try {
    // 1. Fetch all core tables in parallel
    const [invRes, settingsRes, expensesRes, activityRes, payoutsRes] = await Promise.all([
      supabase.from('investigators').select('*').order('id', { ascending: true }),
      supabase.from('agency_settings').select('*').order('id', { ascending: true }),
      supabase.from('investigator_expenses').select('*').order('id', { ascending: true }),
      supabase.from('activity_log').select('*').order('id', { ascending: false }).limit(2000),
      supabase.from('investigator_payouts').select('*').order('id', { ascending: true })
    ]);

    // Fetch all cases in ranges to bypass Supabase PostgREST default 1,000 row cap
    let cases = [];
    let start = 0;
    const CHUNK_SIZE = 1000;
    while (true) {
      const { data, error } = await supabase.from('cases')
        .select('*')
        .order('id', { ascending: true })
        .range(start, start + CHUNK_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      cases.push(...data);
      if (data.length < CHUNK_SIZE) break;
      start += CHUNK_SIZE;
    }

    const investigators = invRes.data || [];
    const settingsList = settingsRes.data || [];
    const expenses = expensesRes.data || [];
    const activityLog = activityRes.data || [];
    const payouts = payoutsRes?.data || [];

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `dna_backup_${dateStr}_${timeStr}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);

    // Prepare unified payload (both structured and backwards-compatible with client restore)
    const backupPayload = {
      version: '2.1',
      timestamp: now.toISOString(),
      triggerType,
      cases: cases, // backwards compatible with restoreBackup()
      settings: settingsList[0] || null,
      investigators: investigators,
      investigator_expenses: expenses,
      investigator_payouts: payouts,
      activity_log: activityLog,
      stats: {
        totalCases: cases.length,
        totalInvestigators: investigators.length,
        totalExpenses: expenses.length,
        totalPayouts: payouts.length,
        totalActivityLogs: activityLog.length
      }
    };

    await fs.promises.writeFile(filePath, JSON.stringify(backupPayload, null, 2), 'utf8');

    // 2. Prune old backups — keep latest 14 snapshots
    pruneOldBackups(14);

    console.log(`[BACKUP] ✓ Successfully created snapshot ${filename} (${cases.length} cases)`);
    return {
      success: true,
      filename,
      timestamp: now.toISOString(),
      stats: backupPayload.stats
    };
  } catch (err) {
    console.error('[BACKUP] Backup execution error:', err);
    return { success: false, error: err.message };
  } finally {
    isBackupInProgress = false;
  }
}

function pruneOldBackups(keepCount = 14) {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('dna_backup_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(BACKUPS_DIR, f);
        const stats = fs.statSync(fullPath);
        return { name: f, fullPath, mtime: stats.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime); // newest first

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const item of toDelete) {
        fs.unlinkSync(item.fullPath);
        console.log(`[BACKUP] Pruned old backup file: ${item.name}`);
      }
    }
  } catch (err) {
    console.error('[BACKUP] Prune error:', err);
  }
}

// Scheduled check: Runs daily backup (interval checks every 1 hour)
function startBackupScheduler() {
  console.log('[BACKUP] Automated Backup Scheduler initialized.');
  // Check if any backup exists from the last 24 hours; if not, create one on startup
  setTimeout(() => {
    try {
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('dna_backup_') && f.endsWith('.json'));
      if (files.length === 0) {
        executeDatabaseBackup('initial_startup');
      } else {
        const newestMtime = files.reduce((latest, f) => {
          const mtime = fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs;
          return Math.max(latest, mtime);
        }, 0);
        const hoursSinceLast = (Date.now() - newestMtime) / (1000 * 60 * 60);
        if (hoursSinceLast >= 24) {
          executeDatabaseBackup('daily_catchup');
        }
      }
    } catch (e) {
      console.warn('[BACKUP] Initial check failed:', e);
    }
  }, 3000);

  // Periodic hourly check
  setInterval(() => {
    try {
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('dna_backup_') && f.endsWith('.json'));
      let shouldBackup = false;
      if (files.length === 0) {
        shouldBackup = true;
      } else {
        const newestMtime = files.reduce((latest, f) => {
          const mtime = fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs;
          return Math.max(latest, mtime);
        }, 0);
        const hoursSinceLast = (Date.now() - newestMtime) / (1000 * 60 * 60);
        if (hoursSinceLast >= 24) {
          shouldBackup = true;
        }
      }
      if (shouldBackup) {
        executeDatabaseBackup('scheduled_daily');
      }
    } catch (err) {
      console.error('[BACKUP] Scheduled interval error:', err);
    }
  }, 1000 * 60 * 60); // every 1 hour
}

startBackupScheduler();

// Backup API Routes
app.get('/api/backup/status', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('dna_backup_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(BACKUPS_DIR, f);
        const stats = fs.statSync(fullPath);
        return { name: f, size: stats.size, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);

    let latestDetails = null;
    if (files.length > 0) {
      try {
        const raw = fs.readFileSync(path.join(BACKUPS_DIR, files[0].name), 'utf8');
        const parsed = JSON.parse(raw);
        latestDetails = {
          filename: files[0].name,
          size: files[0].size,
          timestamp: parsed.timestamp || files[0].mtime,
          stats: parsed.stats || {}
        };
      } catch (err) {
        latestDetails = { filename: files[0].name, size: files[0].size, timestamp: files[0].mtime };
      }
    }

    res.json({
      success: true,
      totalBackups: files.length,
      latest: latestDetails,
      scheduler: 'Active (Daily Interval)'
    });
  } catch (err) {
    console.error('[API /api/backup/status Error]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve backup status. Please try again later.' });
  }
});

app.get('/api/backup/list', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('dna_backup_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(BACKUPS_DIR, f);
        const stats = fs.statSync(fullPath);
        let recordCount = 0;
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          recordCount = (content.cases ? content.cases.length : 0);
        } catch(e) {}
        return {
          filename: f,
          sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
          sizeBytes: stats.size,
          mtime: stats.mtime,
          recordCount
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    res.json({ success: true, backups: files });
  } catch (err) {
    console.error('[API /api/backup/list Error]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve backup list. Please try again later.' });
  }
});

app.post('/api/backup/trigger', requireAuth, async (req, res) => {
  const result = await executeDatabaseBackup('manual_admin_trigger');
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json({ success: false, error: 'Database backup failed to complete. Please try again later.' });
  }
});

app.get('/api/backup/download-latest', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('dna_backup_') && f.endsWith('.json'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      return res.status(404).send('No backup files found.');
    }
    const filePath = path.join(BACKUPS_DIR, files[0].name);
    res.download(filePath, files[0].name);
  } catch (err) {
    console.error('[BACKUP DOWNLOAD ERROR]', err);
    res.status(500).send('Unable to download backup at this time.');
  }
});

app.get('/api/backup/download/:filename', requireAuth, (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    if (!safeName.startsWith('dna_backup_') || !safeName.endsWith('.json')) {
      return res.status(400).send('Invalid backup filename.');
    }
    const filePath = path.join(BACKUPS_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Backup file not found.');
    }
    res.download(filePath, safeName);
  } catch (err) {
    console.error('[BACKUP DOWNLOAD ERROR]', err);
    res.status(500).send('Unable to download requested backup file.');
  }
});

// ============================================================
// SERVER-SIDE AUTH PROXY & BRUTE-FORCE RATE LIMITER
// ============================================================
const authRateLimitMap = new Map();
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15-minute lock on 5 failures

// Automated cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of authRateLimitMap.entries()) {
    if (now > record.resetTime) {
      authRateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

app.post('/api/auth/login', async (req, res) => {
  try {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const clientIp = rawIp.split(',')[0].trim();
    const { email, password } = req.body || {};

    const normalizedEmail = (email || '').toString().trim().toLowerCase();
    const rawPassword = (password || '').toString();

    const now = Date.now();
    const ipKey = `ip:${clientIp}`;
    const userKey = `user:${clientIp}:${normalizedEmail}`;

    const ipRecord = authRateLimitMap.get(ipKey) || { count: 0, resetTime: now + AUTH_LOCKOUT_WINDOW_MS };
    const userRecord = authRateLimitMap.get(userKey) || { count: 0, resetTime: now + AUTH_LOCKOUT_WINDOW_MS };

    // Check if either IP or this IP+Email is locked
    const isIpLocked = ipRecord.count >= (AUTH_MAX_ATTEMPTS * 3) && now < ipRecord.resetTime;
    const isUserLocked = userRecord.count >= AUTH_MAX_ATTEMPTS && now < userRecord.resetTime;

    if (isIpLocked || isUserLocked) {
      const activeReset = isIpLocked ? ipRecord.resetTime : userRecord.resetTime;
      const remainingSecs = Math.max(Math.ceil((activeReset - now) / 1000), 1);
      const remainingMins = Math.ceil(remainingSecs / 60);
      console.warn(`[SECURITY] Login rate limit enforced for ${normalizedEmail || 'unknown'} from IP ${clientIp}`);
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Access temporarily locked for ${remainingMins} minute(s). Please try again later.`,
        remainingSecs
      });
    }

    // Strict server-side input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      !normalizedEmail || 
      !rawPassword || 
      normalizedEmail.length > 254 || 
      rawPassword.length < 6 || 
      rawPassword.length > 256 || 
      !emailRegex.test(normalizedEmail)
    ) {
      userRecord.count++;
      userRecord.resetTime = now + AUTH_LOCKOUT_WINDOW_MS;
      authRateLimitMap.set(userKey, userRecord);
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // Authenticate securely via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: rawPassword
    });

    if (error || !data?.session) {
      // Record failure on both IP and account key
      userRecord.count++;
      userRecord.resetTime = now + AUTH_LOCKOUT_WINDOW_MS;
      authRateLimitMap.set(userKey, userRecord);

      ipRecord.count++;
      ipRecord.resetTime = now + AUTH_LOCKOUT_WINDOW_MS;
      authRateLimitMap.set(ipKey, ipRecord);

      const remaining = Math.max(0, AUTH_MAX_ATTEMPTS - userRecord.count);
      console.warn(`[SECURITY] Failed login for ${normalizedEmail} from ${clientIp}. Remaining attempts: ${remaining}`);

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // Successful login: clear lockout counters
    authRateLimitMap.delete(userKey);
    if (ipRecord.count > 0) {
      ipRecord.count = Math.max(0, ipRecord.count - 1);
      authRateLimitMap.set(ipKey, ipRecord);
    }

    console.log(`[AUTH] Successful login for ${normalizedEmail} from IP ${clientIp}`);
    return res.json({
      success: true,
      session: data.session,
      user: data.user
    });
  } catch (err) {
    console.error('[AUTH ERROR] Exception in /api/auth/login:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication service temporarily unavailable. Please try again in a few moments.'
    });
  }
});

// ============================================================
// INVESTIGATOR PORTAL & TA APPROVAL ENGINE (SECURE & ROLE-LOCKED)
// ============================================================
const INV_PORTAL_SECRET = process.env.ADMIN_SECRET_KEY || 'dna-inv-portal-jwt-secret-secure-2026';
const invAuthRateLimitMap = new Map();
const INV_AUTH_MAX_ATTEMPTS = 5;
const INV_AUTH_LOCKOUT_MS = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of invAuthRateLimitMap.entries()) {
    if (now > v.resetTime) invAuthRateLimitMap.delete(k);
  }
}, 5 * 60 * 1000);

function generateInvToken(inv) {
  const payload = Buffer.from(JSON.stringify({
    name: inv.name,
    phone: inv.phone,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', INV_PORTAL_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyInvToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', INV_PORTAL_SECRET).update(payload).digest('base64url');
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function requireInvestigatorAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : (req.query.token || req.headers['x-investigator-token']);
  const invData = verifyInvToken(token);
  if (!invData) {
    return res.status(401).json({ success: false, error: 'Unauthorized or session expired. Please sign in again.' });
  }
  req.investigator = invData;
  next();
}

// 1. Investigator Login with 10-Digit Mobile & 4-Digit Security PIN
app.post('/api/investigator/login', async (req, res) => {
  try {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const clientIp = rawIp.split(',')[0].trim();
    const { phone, pin } = req.body || {};

    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    const cleanPin = String(pin || '').trim();
    const now = Date.now();
    const rateKey = `inv:${clientIp}:${cleanPhone}`;

    const record = invAuthRateLimitMap.get(rateKey) || { count: 0, resetTime: now + INV_AUTH_LOCKOUT_MS };
    if (record.count >= INV_AUTH_MAX_ATTEMPTS && now < record.resetTime) {
      const waitMins = Math.ceil((record.resetTime - now) / 60000);
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Account locked for ${waitMins} minute(s).`
      });
    }

    // Input Validation
    if (!/^\d{10}$/.test(cleanPhone) || !/^\d{4}$/.test(cleanPin)) {
      record.count++;
      invAuthRateLimitMap.set(rateKey, record);
      return res.status(400).json({ success: false, error: 'Invalid mobile number or 4-digit PIN.' });
    }

    // Query investigator from Supabase
    const { data: investigators, error: invErr } = await supabase
      .from('investigators')
      .select('*')
      .eq('removed', false);

    if (invErr || !investigators || investigators.length === 0) {
      record.count++;
      invAuthRateLimitMap.set(rateKey, record);
      return res.status(401).json({ success: false, error: 'Invalid mobile number or 4-digit PIN.' });
    }

    // Match by last 10 digits of phone
    const matchedInv = investigators.find(i => {
      const p = String(i.phone || '').replace(/\D/g, '').slice(-10);
      return p === cleanPhone;
    });

    if (!matchedInv) {
      record.count++;
      invAuthRateLimitMap.set(rateKey, record);
      return res.status(401).json({ success: false, error: 'Invalid mobile number or 4-digit PIN.' });
    }

    // Fetch PIN from agency_settings
    const { data: settingsData } = await supabase
      .from('agency_settings')
      .select('field_permissions')
      .eq('id', 1)
      .single();

    const storedPins = (settingsData?.field_permissions?.investigator_pins) || {};
    const customPin = storedPins[matchedInv.name];
    // Default PIN: Last 4 digits of phone number
    const defaultPin = cleanPhone.slice(-4);
    const validPin = customPin || defaultPin;

    if (cleanPin !== validPin) {
      record.count++;
      invAuthRateLimitMap.set(rateKey, record);
      return res.status(401).json({ success: false, error: 'Invalid mobile number or 4-digit PIN.' });
    }

    // Login successful
    invAuthRateLimitMap.delete(rateKey);
    const token = generateInvToken(matchedInv);

    return res.json({
      success: true,
      token,
      investigator: {
        id: matchedInv.id,
        name: matchedInv.name,
        phone: matchedInv.phone,
        payment_type: matchedInv.payment_type || 'Per Case'
      }
    });
  } catch (err) {
    console.error('[INV AUTH ERROR]', err);
    return res.status(500).json({ success: false, error: 'Authentication service error. Please try again.' });
  }
});

// 2. Fetch Assigned Cases for the Authenticated Investigator (Confidential fields locked)
app.get('/api/investigator/my-cases', requireInvestigatorAuth, async (req, res) => {
  try {
    const rawInvName = (req.investigator.name || '').trim();
    if (!rawInvName) {
      return res.status(400).json({ success: false, error: 'Investigator profile name missing.' });
    }

    // Query exact investigator or shared assignment without loose substring leakage
    const cleanTarget = rawInvName.replace(/[%_,()]/g, ' ').trim();
    const { data: allCases, error } = await supabase
      .from('cases')
      .select('*')
      .or(`inv1.ilike.${cleanTarget},inv2.ilike.${cleanTarget},inv1.ilike.%/${cleanTarget}%,inv1.ilike.%${cleanTarget}/%,inv2.ilike.%/${cleanTarget}%,inv2.ilike.%${cleanTarget}/%`)
      .order('date', { ascending: false })
      .limit(5000);

    if (error) throw error;

    // Filter and sanitize: STRICTLY NO AGENCY FINANCIALS (received, profit, invoice, tds)
    // Matches exact name or delimited pair (e.g. "Raj / Amit"), preventing "Raj" from seeing "Rajesh" cases
    const target = rawInvName.toLowerCase();
    const isSalary = (req.investigator.payment_type || '').toLowerCase() === 'salary';

    const sanitized = (allCases || []).filter(c => {
      const i1 = (c.inv1 || '').trim().toLowerCase();
      const i2 = (c.inv2 || '').trim().toLowerCase();
      const names1 = i1.split(/[\/,+&]/).map(s => s.trim());
      const names2 = i2.split(/[\/,+&]/).map(s => s.trim());
      return names1.includes(target) || names2.includes(target) || i1 === target || i2 === target;
    }).map(c => {
      const i1 = (c.inv1 || '').trim().toLowerCase();
      const names1 = i1.split(/[\/,+&]/).map(s => s.trim());
      const isInv1 = names1.includes(target) || i1 === target;
      
      const assignedFee = isSalary ? 0 : (isInv1 ? (Number(c.fee1) || 0) : (Number(c.fee2) || 0));
      const currentTa = isInv1 ? (Number(c.ta1) || 0) : (Number(c.ta2) || 0);
      const rawStatus = isInv1 ? (c.inv1_status || '') : (c.inv2_status || '');
      const isPaid = (rawStatus || '').trim().toLowerCase() === 'paid';
      const paymentStatus = isPaid ? 'Paid' : (rawStatus.trim() || 'Pending');

      return {
        doc_code: c.doc_code,
        date: c.date,
        company: c.company,
        case_type: c.case_type,
        claim_no: c.claim_no,
        policy_no: c.policy_no,
        insured_name: c.insured_name,
        hospital: c.hospital,
        location: c.location,
        outcome: c.outcome || 'Pending',
        investigation_status: c.investigation_status || '',
        remarks: c.remarks || '',
        assigned_fee: assignedFee,
        current_ta: currentTa,
        is_paid: isPaid,
        payment_status: paymentStatus,
        role: isInv1 ? 'Primary (Inv 1)' : 'Secondary (Inv 2)',
        ta_request: c.custom_data?.ta_request || null
      };
    });

    return res.json({ success: true, cases: sanitized, count: sanitized.length });
  } catch (err) {
    console.error('[MY CASES ERROR]', err);
    return res.status(500).json({ success: false, error: 'Could not load your cases.' });
  }
});

// 3. Submit Case Outcome & Outstation TA Claim (with Duplicate Batch-Visit Check)
app.post('/api/investigator/submit-case-update', requireInvestigatorAuth, async (req, res) => {
  try {
    const invName = req.investigator.name;
    const {
      doc_code,
      outcome,
      investigation_status,
      remarks,
      is_outstation,
      distance_km,
      requested_ta,
      reason
    } = req.body || {};

    if (!doc_code) {
      return res.status(400).json({ success: false, error: 'Doc code is required.' });
    }

    // Verify case belongs to investigator
    const { data: c, error: cErr } = await supabase
      .from('cases')
      .select('*')
      .eq('doc_code', doc_code)
      .single();

    if (cErr || !c) {
      return res.status(404).json({ success: false, error: 'Case not found.' });
    }

    const isInv1 = (c.inv1 || '').trim().toLowerCase() === invName.toLowerCase();
    const isInv2 = (c.inv2 || '').trim().toLowerCase() === invName.toLowerCase();
    if (!isInv1 && !isInv2) {
      return res.status(403).json({ success: false, error: 'You are not assigned to this case.' });
    }

    const updates = {};
    if (outcome) updates.outcome = String(outcome).trim();
    if (investigation_status !== undefined) updates.investigation_status = String(investigation_status || '').trim();
    if (remarks !== undefined) updates.remarks = String(remarks || '').trim();

    const customData = c.custom_data || {};

    if (is_outstation) {
      const dist = Math.max(0, parseFloat(distance_km) || 0);
      const reqTa = Math.max(0, parseFloat(requested_ta) || 0);

      if (reqTa <= 0) {
        return res.status(400).json({ success: false, error: 'Please enter a valid requested TA amount (> 0).' });
      }
      if (reqTa > 15000) {
        return res.status(400).json({ success: false, error: 'Requested TA exceeds maximum allowed threshold.' });
      }

      // Multi-Case Batch Visit Check: Did this investigator visit the same hospital on the same date?
      let isBatchHospital = false;
      const { data: sameDateCases } = await supabase
        .from('cases')
        .select('doc_code, hospital, date, inv1, inv2, custom_data')
        .eq('date', c.date)
        .neq('doc_code', c.doc_code);

      if (sameDateCases && sameDateCases.length > 0) {
        const hName = String(c.hospital || '').toLowerCase().trim();
        if (hName.length > 2) {
          isBatchHospital = sameDateCases.some(sc => {
            const hasInv = (sc.inv1 === invName || sc.inv2 === invName);
            const matchesHosp = String(sc.hospital || '').toLowerCase().trim().includes(hName) ||
                                hName.includes(String(sc.hospital || '').toLowerCase().trim());
            return hasInv && matchesHosp;
          });
        }
      }

      customData.ta_request = {
        status: 'pending',
        inv_name: invName,
        doc_code: c.doc_code,
        claim_no: c.claim_no || '',
        insured_name: c.insured_name || '',
        hospital: c.hospital || '',
        date: c.date,
        distance_km: dist,
        requested_amount: reqTa,
        reason: String(reason || '').trim().slice(0, 300),
        is_batch_hospital: isBatchHospital,
        requested_at: new Date().toISOString()
      };
    } else {
      // Local visit (₹0 TA)
      if (!customData.ta_request || customData.ta_request.status === 'pending') {
        customData.ta_request = {
          status: 'local_zero',
          inv_name: invName,
          requested_amount: 0,
          updated_at: new Date().toISOString()
        };
      }
    }

    updates.custom_data = customData;

    const { error: upErr } = await supabase
      .from('cases')
      .update(updates)
      .eq('doc_code', doc_code);

    if (upErr) throw upErr;

    return res.json({
      success: true,
      message: is_outstation ? 'Update submitted. TA request sent to Admin for approval.' : 'Case updated successfully.'
    });
  } catch (err) {
    console.error('[SUBMIT CASE ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to update case.' });
  }
});

// 4. Change Investigator 4-Digit Security PIN
app.post('/api/investigator/change-pin', requireInvestigatorAuth, async (req, res) => {
  try {
    const invName = req.investigator.name;
    const { old_pin, new_pin } = req.body || {};

    if (!/^\d{4}$/.test(String(new_pin || ''))) {
      return res.status(400).json({ success: false, error: 'New PIN must be exactly 4 numeric digits.' });
    }

    const { data: settingsData } = await supabase
      .from('agency_settings')
      .select('field_permissions')
      .eq('id', 1)
      .single();

    const fp = settingsData?.field_permissions || {};
    const pins = fp.investigator_pins || {};
    const cleanPhone = String(req.investigator.phone || '').replace(/\D/g, '').slice(-10);
    const validCurrentPin = pins[invName] || cleanPhone.slice(-4);

    if (String(old_pin || '').trim() !== validCurrentPin) {
      return res.status(401).json({ success: false, error: 'Current PIN is incorrect.' });
    }

    pins[invName] = String(new_pin).trim();
    fp.investigator_pins = pins;

    const { error: setErr } = await supabase
      .from('agency_settings')
      .update({ field_permissions: fp })
      .eq('id', 1);

    if (setErr) throw setErr;

    return res.json({ success: true, message: 'PIN updated successfully.' });
  } catch (err) {
    console.error('[CHANGE PIN ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to update PIN.' });
  }
});

// 5. Admin TA Approval Queue API: List All Pending Requests
app.get('/api/admin/ta-approval/list', requireAuth, async (req, res) => {
  try {
    const { data: allCases, error } = await supabase
      .from('cases')
      .select('id, doc_code, date, claim_no, insured_name, hospital, location, inv1, inv2, fee1, fee2, ta1, ta2, custom_data')
      .order('date', { ascending: false });

    if (error) throw error;

    const requests = [];
    (allCases || []).forEach(c => {
      const tr = c.custom_data?.ta_request;
      if (tr && (tr.status === 'pending' || tr.status === 'approved' || tr.status === 'rejected')) {
        requests.push({
          doc_code: c.doc_code,
          date: c.date,
          claim_no: c.claim_no,
          insured_name: c.insured_name,
          hospital: c.hospital,
          location: c.location,
          inv_name: tr.inv_name || c.inv1,
          requested_amount: tr.requested_amount || 0,
          distance_km: tr.distance_km || 0,
          reason: tr.reason || '',
          status: tr.status,
          is_batch_hospital: !!tr.is_batch_hospital,
          requested_at: tr.requested_at,
          approved_amount: tr.approved_amount || 0,
          current_case_ta: (c.inv1 === tr.inv_name ? c.ta1 : c.ta2) || 0
        });
      }
    });

    return res.json({ success: true, requests });
  } catch (err) {
    console.error('[ADMIN TA LIST ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch TA requests.' });
  }
});

// 6. Admin TA Approval Action: Approve / Modify / Reject
app.post('/api/admin/ta-approval/action', requireAuth, async (req, res) => {
  try {
    const { doc_code, action, approved_amount, admin_remarks } = req.body || {};
    if (!doc_code || !action) {
      return res.status(400).json({ success: false, error: 'Doc code and action are required.' });
    }

    const { data: c, error: cErr } = await supabase
      .from('cases')
      .select('*')
      .eq('doc_code', doc_code)
      .single();

    if (cErr || !c) return res.status(404).json({ success: false, error: 'Case not found.' });

    const customData = c.custom_data || {};
    const tr = customData.ta_request || {};
    const applicant = tr.inv_name || c.inv1;
    const isInv1 = (c.inv1 || '').trim().toLowerCase() === applicant.toLowerCase();

    const updates = {};

    if (action === 'approve' || action === 'modify') {
      const finalAmt = Math.max(0, parseFloat(approved_amount !== undefined ? approved_amount : tr.requested_amount) || 0);
      if (isInv1) updates.ta1 = finalAmt;
      else updates.ta2 = finalAmt;

      tr.status = 'approved';
      tr.approved_amount = finalAmt;
      tr.approved_at = new Date().toISOString();
      tr.admin_remarks = admin_remarks || '';
      customData.ta_request = tr;
      updates.custom_data = customData;

      // Recalculate total_payable
      const f1 = Number(c.fee1) || 0, f2 = Number(c.fee2) || 0;
      const t1 = isInv1 ? finalAmt : (Number(c.ta1) || 0);
      const t2 = !isInv1 ? finalAmt : (Number(c.ta2) || 0);
      updates.total_payable = f1 + f2 + t1 + t2;
      const rec = Number(c.received) || 0, tds = Number(c.tds_deducted) || 0;
      updates.profit = (rec + tds) - updates.total_payable;
    } else if (action === 'reject') {
      if (isInv1) updates.ta1 = 0;
      else updates.ta2 = 0;

      tr.status = 'rejected';
      tr.reject_reason = admin_remarks || 'Not approved by admin';
      tr.rejected_at = new Date().toISOString();
      customData.ta_request = tr;
      updates.custom_data = customData;

      const f1 = Number(c.fee1) || 0, f2 = Number(c.fee2) || 0;
      const t1 = isInv1 ? 0 : (Number(c.ta1) || 0);
      const t2 = !isInv1 ? 0 : (Number(c.ta2) || 0);
      updates.total_payable = f1 + f2 + t1 + t2;
      const rec = Number(c.received) || 0, tds = Number(c.tds_deducted) || 0;
      updates.profit = (rec + tds) - updates.total_payable;
    }

    const { error: upErr } = await supabase
      .from('cases')
      .update(updates)
      .eq('doc_code', doc_code);

    if (upErr) throw upErr;

    return res.json({ success: true, message: `TA request ${action}d successfully.`, updates });
  } catch (err) {
    console.error('[ADMIN TA ACTION ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to process TA action.' });
  }
});

// 7. Admin Reset / Set Investigator Security PIN
app.post('/api/admin/reset-inv-pin', requireAuth, async (req, res) => {
  try {
    const { investigator_name, new_pin } = req.body || {};
    if (!investigator_name || !/^\d{4}$/.test(String(new_pin || ''))) {
      return res.status(400).json({ success: false, error: 'Investigator name and 4-digit PIN required.' });
    }

    const { data: settingsData } = await supabase
      .from('agency_settings')
      .select('field_permissions')
      .eq('id', 1)
      .single();

    const fp = settingsData?.field_permissions || {};
    const pins = fp.investigator_pins || {};
    pins[investigator_name] = String(new_pin).trim();
    fp.investigator_pins = pins;

    const { error: setErr } = await supabase
      .from('agency_settings')
      .update({ field_permissions: fp })
      .eq('id', 1);

    if (setErr) throw setErr;

    return res.json({ success: true, message: `PIN for ${investigator_name} reset to ${new_pin}.` });
  } catch (err) {
    console.error('[ADMIN RESET PIN ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to reset PIN.' });
  }
});

let aiClient = null;
function getAi() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// AI OCR & Mandate Extraction API

// --- RATE LIMITING ---
const rateLimitMap = new Map();
function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + 60000 };
  
  if (now > record.resetTime) { record.count = 1; record.resetTime = now + 60000; } 
  else { record.count++; }
  rateLimitMap.set(ip, record);
  
  if (record.count > 30) {
    console.warn('[SECURITY] Rate limit exceeded for IP:', ip);
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }
  next();
}
// setInterval to cleanup memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, 60000);
// ---------------------

app.post('/api/gemini/parse-case', rateLimiter, requireAuth, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY is not configured on the server.' });
    }
    const ai = getAi();
    const { text, fileBase64, mimeType } = req.body;
    if (!text && !fileBase64) {
      return res.status(400).json({ success: false, error: 'Please provide text or upload a document.' });
    }

    // Server-side validation
    if (text && typeof text === 'string' && text.length > 250000) {
      return res.status(400).json({ success: false, error: 'Payload exceeds allowable text size limit.' });
    }

    if (fileBase64) {
      if (typeof fileBase64 !== 'string' || fileBase64.length > 15 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'Uploaded document exceeds maximum allowed size (10MB).' });
      }
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!mimeType || !allowedMimes.includes(mimeType.toLowerCase())) {
        return res.status(400).json({ success: false, error: 'Unsupported file format. Please upload PDF, PNG, or JPEG.' });
      }
    }

    const parts = [];
    if (fileBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: fileBase64,
        }
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const prompt = `You are an expert document extraction and OCR assistant for DNA Professional Investigation Agency.
Analyze the provided insurance mandate document, assignment email, case sheet, FIR, or raw text.
Extract all case information accurately.

Rules:
1. "company": Identify the insurance company or TPA (e.g. ADITYA BIRLA, BRAINBIRD, CARE, CHOLA, IFFCO TOKIO, KOTAK, MAGMA, RELIANCE, SBI, STAR HEALTH, TATA AIA, TATA AIG, VIDAL HEALTH, ICICI LOMBARD, HDFC ERGO, NIVA BUPA, BAJAJ ALLIANZ). Return uppercase name.
2. "date": Extract allocation or incident date in YYYY-MM-DD format. If only DD/MM/YYYY or DD-MM-YYYY is present, convert to YYYY-MM-DD. If none found, use today's date (${todayStr}).
3. "case_type": Map to standard types if applicable: PA, CASHLESS, REIMBURSEMENT, MB, FVR, SPOT, PROJECT, HOSPICASH, POST FACTO, PRE-AUTH. Default to REIMBURSEMENT or CASHLESS if indicated.
4. "claim_no": Extract the claim / mandate reference number (clean alphanumeric, remove extra prefixes like 'Claim No:').
5. "policy_no": Extract the policy or certificate number.
6. "insured_name": Extract the patient / insured person's full name.
7. "hospital": Extract hospital name and/or address.
8. "location": Extract the city, town, or district.
9. "sla_hours": Extract SLA in hours (e.g. 24, 48, 72). If not mentioned, set to null.
10. "fee1": Extract investigator fee if specified as a number, otherwise null.
11. "ta1": Extract travel allowance if specified, otherwise null.
12. "received": Extract company approved payout/billing amount if specified, otherwise null.
13. "invoice_no": Extract invoice or bill reference if specified, otherwise null.
14. "remarks": Include any investigation instructions, trigger reasons, suspicious points, or scope of investigation.

${text ? 'Text content:\n' + text : ''}`;

    parts.push({ text: prompt });

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              company: { type: Type.STRING, description: "Insurance company or TPA name in uppercase" },
              date: { type: Type.STRING, description: "Allocation date YYYY-MM-DD" },
              case_type: { type: Type.STRING, description: "Type of case (e.g., REIMBURSEMENT, CASHLESS, PRE-AUTH, PA, MB, FVR, SPOT)" },
              claim_no: { type: Type.STRING, description: "Claim or case reference number" },
              policy_no: { type: Type.STRING, description: "Policy number" },
              insured_name: { type: Type.STRING, description: "Name of insured/patient" },
              hospital: { type: Type.STRING, description: "Hospital or clinic name" },
              location: { type: Type.STRING, description: "City or region" },
              sla_hours: { type: Type.INTEGER, description: "SLA in hours" },
              fee1: { type: Type.NUMBER, description: "Investigator fee" },
              ta1: { type: Type.NUMBER, description: "TA/expense allowance" },
              received: { type: Type.NUMBER, description: "Approved payout or billing amount" },
              invoice_no: { type: Type.STRING, description: "Invoice number" },
              remarks: { type: Type.STRING, description: "Investigation remarks, trigger reasons, instructions" },
            }
          }
        }
      });
    } catch (primaryErr) {
      console.warn('[API /api/gemini/parse-case] gemini-flash-latest retry with gemini-3.1-flash-lite:', primaryErr.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: { parts },
        config: {
          responseMimeType: 'application/json'
        }
      });
    }

    const parsedJson = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsedJson });
  } catch (err) {
    console.error('[API /api/gemini/parse-case] Error:', err);
    return res.status(500).json({ success: false, error: 'Unable to process document at this time. Please try again.' });
  }
});

const FILL_CASE_TOOL = {
  functionDeclarations: [{
    name: "update_case_fields",
    description: "Update one or more fields in the 'Add New Case' form based on user input. Only update fields that the user explicitly mentions or that can be clearly inferred.",
    parameters: {
      type: "OBJECT",
      properties: {
        company: { type: "STRING", description: "Insurance company name" },
        date: { type: "STRING", description: "Allocation date (YYYY-MM-DD)" },
        case_type: { type: "STRING", description: "Type of case (e.g., REIMBURSEMENT, PRE-AUTH)" },
        claim_no: { type: "STRING", description: "Claim number" },
        policy_no: { type: "STRING", description: "Policy number" },
        insured_name: { type: "STRING", description: "Name of the insured person" },
        hospital: { type: "STRING", description: "Hospital name or address" },
        location: { type: "STRING", description: "City or location" },
        sla_hours: { type: "NUMBER", description: "SLA in hours" },
        inv1: { type: "STRING", description: "Name of Investigator 1" },
        inv2: { type: "STRING", description: "Name of Investigator 2" },
        fee1: { type: "NUMBER", description: "Fee for Investigator 1" },
        fee2: { type: "NUMBER", description: "Fee for Investigator 2" },
        ta1: { type: "NUMBER", description: "TA/Expense for Investigator 1" },
        ta2: { type: "NUMBER", description: "TA/Expense for Investigator 2" },
        received: { type: "NUMBER", description: "Payment received from company" },
        invoice_no: { type: "STRING", description: "Invoice number" },
        remarks: { type: "STRING", description: "Any additional remarks" }
      }
    }
  }]
};

wss.on('connection', async (clientWs) => {
  console.log('[LIVE] Client connected');
  
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[LIVE] GEMINI_API_KEY is not configured on the server.');
    clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }));
    clientWs.close();
    return;
  }

  let session = null;

  try {
    const ai = getAi();
    session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: "You are a helpful assistant for DNA Professional Investigation Agency. You are helping an administrator fill out a 'New Case' form. Your goal is to listen to the user and call the 'update_case_fields' tool whenever they provide information for the form. Be professional, concise, and confirm the information you are filling. The form fields include company, date, claim number, insured name, fees, and investigators.",
        tools: [FILL_CASE_TOOL]
      },
      callbacks: {
        onmessage: (message) => {
          // Handle audio
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ audio }));
          }

          // Handle interruptions
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }

          // Handle tool calls
          const toolCalls = message.serverContent?.modelTurn?.parts?.filter(p => p.functionCall);
          if (toolCalls && toolCalls.length > 0) {
            toolCalls.forEach(tc => {
              console.log('[LIVE] Tool call:', tc.functionCall.name, tc.functionCall.args);
              clientWs.send(JSON.stringify({ 
                toolCall: {
                  name: tc.functionCall.name,
                  args: tc.functionCall.args,
                  id: tc.functionCall.id
                }
              }));
              
              // Immediately respond to the tool call to keep the session alive
              session.sendToolResponse({
                functionResponses: [{
                  name: tc.functionCall.name,
                  response: { success: true },
                  id: tc.functionCall.id
                }]
              });
            });
          }
        },
      },
    });

    clientWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
      } catch (err) {
        console.error('[LIVE] Error parsing client message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('[LIVE] Client disconnected');
      if (session) session.close();
    });

  } catch (err) {
    console.error('[LIVE] Session initialization failed:', err);
    clientWs.close();
  }
});

// Log requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Security: Prevent serving server-side source code, database scripts, and environment files
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (
    p.endsWith('.sql') ||
    p.endsWith('.env') ||
    p.endsWith('.md') ||
    p.endsWith('.txt') ||
    p.endsWith('.log') ||
    p.endsWith('.bak') ||
    p.endsWith('.py') ||
    p.endsWith('.sh') ||
    p.endsWith('.sqlite') ||
    p.endsWith('.db') ||
    p.endsWith('.yml') ||
    p.endsWith('.yaml') ||
    p.startsWith('/.env') ||
    p.startsWith('/.git') ||
    p.startsWith('/node_modules') ||
    p === '/server.js' ||
    p.startsWith('/db_scripts') ||
    p.startsWith('/backups') ||
    p.startsWith('/patch_') ||
    p.startsWith('/fix_') ||
    p.startsWith('/test') ||
    p.startsWith('/revert_') ||
    p.startsWith('/smart_') ||
    p.startsWith('/hc') ||
    p === '/package.json' ||
    p === '/package-lock.json' ||
    p === '/bun.lock' ||
    p === '/metadata.json' ||
    p === '/eslint.config.js'
  ) {
    return res.status(403).send('Forbidden: Direct access to source scripts, backups, and diagnostic logs is restricted.');
  }
  next();
});

// Dynamic configuration endpoint: ensures config.js is always available and up-to-date
// from environment variables (Settings / process.env) even if the file is removed from disk
app.get('/config.js', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://aacvwozpfjuhcvihnaen.supabase.co';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3Z3b3pwZmp1aGN2aWhuYWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzc2MjUsImV4cCI6MjEwMjM1MzYyNX0.nPHpd2YeC-VgF-xKCKO7kLzr_5TncD84b8IOzoiKAIk';
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '1051883487866-cn5qo2dvblq0hgcg92o6p1ne2kmf98c0.apps.googleusercontent.com';

  res.setHeader('Content-Type', 'application/javascript');
  res.send(`// Dynamic client configuration generated by server
window.APP_CONFIG = {
  supabase: {
    url: ${JSON.stringify(supabaseUrl)},
    anonKey: ${JSON.stringify(supabaseAnonKey)}
  },
  googleDrive: {
    clientId: ${JSON.stringify(googleClientId)}
  }
};
`);
});

// Provide offline / fallback endpoint for Supabase client UMD bundle
app.get('/vendor/supabase.js', (req, res) => {
  const localSupabase = path.join(__dirname, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
  if (fs.existsSync(localSupabase)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(localSupabase);
  } else {
    res.status(404).send('// Supabase local bundle not found');
  }
});

// Serve static files from the root directory with 1-hour browser cache for assets
app.use(express.static(__dirname, {
  maxAge: '1h',
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      // index.html should never be heavily cached so updates are instant
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Default fallback to index.html for single-page routing
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) {
    next();
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

server.on('error', (err) => {
  console.error('[SERVER ERROR]', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`[CRITICAL] Port ${port} is already in use. Exiting process.`);
    process.exit(1);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
  console.log(`Ready on port ${port}`);
});
