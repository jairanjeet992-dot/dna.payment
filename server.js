const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { GoogleGenAI, Modality, Type } = require('@google/genai');


// --- CRASH PROTECTION ---
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception prevents server crash:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection prevents server crash:', reason);
});
// ------------------------

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });
const port = 3000;
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Body parsing middleware for JSON and raw data (supporting base64 PDFs and images up to 25MB)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ============================================================
// AUTOMATED DATABASE BACKUP ENGINE (FOR SUPABASE FREE TIER)
// ============================================================
const BACKUPS_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Load Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aacvwozpfjuhcvihnaen.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3Z3b3pwZmp1aGN2aWhuYWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzc2MjUsImV4cCI6MjEwMjM1MzYyNX0.nPHpd2YeC-VgF-xKCKO7kLzr_5TncD84b8IOzoiKAIk';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let isBackupInProgress = false;

async function executeDatabaseBackup(triggerType = 'scheduled') {
  if (isBackupInProgress) {
    return { success: false, message: 'Backup already in progress.' };
  }
  isBackupInProgress = true;
  console.log(`[BACKUP] Starting automated database backup (${triggerType})...`);

  try {
    // 1. Fetch all core tables in parallel
    const [casesRes, invRes, settingsRes, expensesRes, activityRes] = await Promise.all([
      supabase.from('cases').select('*').order('id', { ascending: true }),
      supabase.from('investigators').select('*').order('id', { ascending: true }),
      supabase.from('agency_settings').select('*').order('id', { ascending: true }),
      supabase.from('investigator_expenses').select('*').order('id', { ascending: true }),
      supabase.from('activity_log').select('*').order('id', { ascending: false }).limit(2000)
    ]);

    const cases = casesRes.data || [];
    const investigators = invRes.data || [];
    const settingsList = settingsRes.data || [];
    const expenses = expensesRes.data || [];
    const activityLog = activityRes.data || [];

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `dna_backup_${dateStr}_${timeStr}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);

    // Prepare unified payload (both structured and backwards-compatible with client restore)
    const backupPayload = {
      version: '2.0',
      timestamp: now.toISOString(),
      triggerType,
      cases: cases, // backwards compatible with restoreBackup()
      settings: settingsList[0] || null,
      investigators: investigators,
      investigator_expenses: expenses,
      activity_log: activityLog,
      stats: {
        totalCases: cases.length,
        totalInvestigators: investigators.length,
        totalExpenses: expenses.length,
        totalActivityLogs: activityLog.length
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), 'utf8');

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
app.get('/api/backup/status', (req, res) => {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/backup/list', (req, res) => {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/backup/trigger', async (req, res) => {
  const result = await executeDatabaseBackup('manual_admin_trigger');
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

app.get('/api/backup/download-latest', (req, res) => {
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
    res.status(500).send('Error downloading backup: ' + err.message);
  }
});

app.get('/api/backup/download/:filename', (req, res) => {
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
    res.status(500).send('Error downloading backup: ' + err.message);
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

app.post('/api/gemini/parse-case', rateLimiter, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY is not configured on the server.' });
    }
    const ai = getAi();
    const { text, fileBase64, mimeType } = req.body;
    if (!text && !fileBase64) {
      return res.status(400).json({ success: false, error: 'Please provide text or upload a document.' });
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
    return res.status(500).json({ success: false, error: err.message || 'Failed to extract case details with Gemini' });
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

// Serve static files from the root directory
app.use(express.static(__dirname));

// Default fallback to index.html for single-page routing
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) {
    next();
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
