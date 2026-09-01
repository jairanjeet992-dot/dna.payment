// ============================================================
// SUPABASE CLIENT
// ============================================================
// Uses dynamic configuration from config.js
// If config is missing, falls back to default project credentials
const getSupabaseConfig = () => {
  const config = window.APP_CONFIG?.supabase;
  if (!config?.url || !config?.anonKey) {
    console.warn('[APP_CONFIG] Supabase config not found on window.APP_CONFIG. Using fallback credentials.');
    return {
      url: 'https://aacvwozpfjuhcvihnaen.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3Z3b3pwZmp1aGN2aWhuYWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzc2MjUsImV4cCI6MjEwMjM1MzYyNX0.nPHpd2YeC-VgF-xKCKO7kLzr_5TncD84b8IOzoiKAIk'
    };
  }
  return config;
};


window.getGoogleClientId = () => {
  const localId = localStorage.getItem('GOOGLE_CLIENT_ID');
  if (localId) return localId;
  return window.APP_CONFIG?.googleDrive?.clientId || window.APP_CONFIG?.googleClientId || '1051883487866-db1eelsu3ue0f2ue4b29aqa0qt2ca4qv.apps.googleusercontent.com';
};

const SUPABASE_CONFIG = getSupabaseConfig();
const supabaseClient = (SUPABASE_CONFIG && window.supabase)
  ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
  : null;

if (supabaseClient) {
  window.supabaseClient = supabaseClient;  // expose for investigator-360 module
} else {
  console.error('[ERROR] Failed to initialize Supabase client. Check your configuration.');
}

// ============================================================
// DATA CONSTANTS
// ============================================================
// Investigators now live entirely in Supabase's `investigators` table
// (seeded in Phase 1 with is_base=true for the original ~82 names). These
// stay as in-memory caches, refreshed via loadInvestigatorsFromDB(), so the
// ~15 places elsewhere in this file that read INVESTIGATORS/INVESTIGATOR_PHONES
// synchronously keep working unchanged.
let INVESTIGATORS = [];        // array of names, sorted — replaces getAllInvestigators()
let INVESTIGATOR_PHONES = {};  // name -> phone, replaces the old localStorage map
let investigatorRows = [];     // full rows (id, name, phone, is_base, removed) — needed for id-based updates
let COMPANIES = ["ADITYA BIRLA","BRAINBIRD","CARE","CHOLA","IFFCO TOKIO","KOTAK","MAGMA","RELIANCE","SBI","STAR HEALTH","TATA AIA","TATA AIG","VIDAL HEALTH"];
let CASE_TYPES = ["PA","CASHLESS","REIMBURSEMENT","MB","FVR","SPOT","PROJECT","HOSPICASH","POST FACTO"];

function refreshDynamicCompanies() {
  // Update Add Case dropdown
  const fCompany = document.getElementById('f-company');
  if (fCompany) {
    const val = fCompany.value;
    fCompany.innerHTML = '<option value="">-- Select --</option>' + COMPANIES.map(c => `<option value="${escAttr(c)}">${escAttr(c)}</option>`).join('');
    fCompany.value = val;
  }
  
  // Update Case Type dropdown
  const fCaseType = document.getElementById('f-casetype');
  if (fCaseType) {
    const val = fCaseType.value;
    fCaseType.innerHTML = '<option value="">-- Select --</option>' + CASE_TYPES.map(c => `<option value="${escAttr(c)}">${escAttr(c)}</option>`).join('');
    fCaseType.value = val;
  }

  // Update Filter dropdowns
  const fc = document.getElementById('filter-company');
  if (fc) {
    const val = fc.value;
    fc.innerHTML = '<option value="">All Companies</option>' + COMPANIES.map(c => `<option value="${escAttr(c)}">${escAttr(c)}</option>`).join('');
    fc.value = val;
  }
  
  const fct = document.getElementById('filter-casetype');
  if (fct) {
    const val = fct.value;
    fct.innerHTML = '<option value="">All Types</option>' + CASE_TYPES.map(c => `<option value="${escAttr(c)}">${escAttr(c)}</option>`).join('');
    fct.value = val;
  }

  


  // Update Report dropdown
  const reportWrap = document.getElementById('report-target-wrap');
  if (reportWrap && document.getElementById('report-type')?.value === 'company') {
    const sel = reportWrap.querySelector('select');
    if (sel) {
      const val = sel.value;
      sel.innerHTML = COMPANIES.map(c => `<option value="${escAttr(c)}">${escAttr(c)}</option>`).join('');
      sel.value = val;
    }
  }
}

// Dynamically generated — covers Jan 2024 to Dec 2030 so old and future
// dated cases both work. No more hardcoded single-FY array that silently
// breaks once the year rolls over.
function generateMonths() {
  const arr = [];
  const codes = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  for (let y = 2024; y <= 2030; y++) {
    for (let m = 1; m <= 12; m++) {
      arr.push({label: `${['January','February','March','April','May','June','July','August','September','October','November','December'][m-1]} ${y}`, m, y, code: codes[m-1]+String(y).slice(-2)});
    }
  }
  return arr;
}
const MONTHS = generateMonths();
// Financial year (April–March) that contains "today" — used for the Yearly tab default.
function getCurrentFY() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1; // April=index3
  return MONTHS.filter(mo => (mo.y===y && mo.m>=4) || (mo.y===y+1 && mo.m<=3));
}
// Months that actually have case data, plus the current real-world month
// (so "add a case this month" always has a button to land on even before
// any case exists for it). Replaces the old hard FY-only limitation —
// Monthly/Yearly can now reach any month or year present in the data,
// past or future, driven by what's actually in `cases` rather than a
// fixed calendar window.
function getAvailableMonths() {
  const now = new Date();
  const present = new Set(cases.filter(c=>c.date).map(c => {
    const d = new Date(c.date);
    return (d.getMonth()+1)+'-'+d.getFullYear();
  }));
  present.add((now.getMonth()+1)+'-'+now.getFullYear());
  return MONTHS.filter(mo => present.has(mo.m+'-'+mo.y));
}
// All financial years (Apr–Mar) that have at least one case, plus the
// current real-world FY — used to populate the Yearly view's year selector.
function getAvailableFYs() {
  const now = new Date();
  const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
  const years = new Set([currentFYStart]);
  cases.forEach(c => {
    if (!c.date) return;
    const d = new Date(c.date);
    const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear()-1;
    years.add(fyStart);
  });
  return Array.from(years).sort((a,b)=>b-a).map(y => ({
    startYear: y, label: `FY ${y}-${String(y+1).slice(-2)}`,
    months: MONTHS.filter(mo => (mo.y===y && mo.m>=4) || (mo.y===y+1 && mo.m<=3))
  }));
}
let activeFYStart = null; // set on first renderYearly() call to the current FY's start year

// ============================================================
// STATE
// ============================================================
let cases = [];
let bulkEditConfig = null;
window.cases = cases; // expose for investigator-360 + reports modules
let investigatorExpenses = [];
window.investigatorExpenses = investigatorExpenses; // expose for vouchers & ledger
// Safe placeholder shown before login — RLS blocks reading agency_settings
// until authenticated, so the real values load via loadSettingsFromDB() in
// enterApp() once a session exists.
let settings = { agencyName: 'DNA Professional Investigation Agency', agencyAddress: '', logo: null };
let currentUser = null;
let editIdx = -1;
let activeMonth = 0; // corrected to real current month in init() below, once MONTHS is generated

// ============================================================
// INIT
// ============================================================
// Global helper for html2canvas to prevent modern color function crashes
window.sanitizeHtml2Canvas = function(doc) {
  const style = doc.createElement('style');
  style.innerHTML = '* { outline-color: transparent !important; text-decoration-color: transparent !important; caret-color: transparent !important; column-rule-color: transparent !important; -webkit-tap-highlight-color: transparent !important; }';
  doc.head.appendChild(style);
  
  if (doc.defaultView && window.applyHtml2CanvasPatch) {
    window.applyHtml2CanvasPatch(doc.defaultView);
  }
};
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      alert(`Error attempting to enable fullscreen mode. Please open the app in a new tab if you are viewing this in a preview iframe: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('fs-toggle-btn');
  if (btn) {
    if (document.fullscreenElement) {
      btn.textContent = '⛌';
      btn.title = 'Exit Fullscreen';
      document.body.classList.add('is-fullscreen');
    } else {
      btn.textContent = '⛶';
      btn.title = 'Fullscreen';
      document.body.classList.remove('is-fullscreen');
    }
  }
});

// ============================================================
// DARK MODE
// ============================================================
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('dna_dark_mode', isDark ? '1' : '0');
  const btn = document.getElementById('dark-toggle-btn');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}
function applySavedDarkMode() {
  if (localStorage.getItem('dna_dark_mode') === '1') {
    document.body.classList.add('dark-mode');
    const btn = document.getElementById('dark-toggle-btn');
    if (btn) btn.textContent = '☀️';
  }
}

function init() {
  const now = new Date();
  const todayIdx = MONTHS.findIndex(m => m.m === now.getMonth()+1 && m.y === now.getFullYear());
  if (todayIdx >= 0) activeMonth = todayIdx;
  applySavedDarkMode();
  populateStaticSelects();
  applySettingsToForm();

  // Supabase manages session persistence itself (localStorage under the hood,
  // refreshed automatically) — no manual sessionStorage handling needed.
  // onAuthStateChange fires immediately on load with the current session (if
  // any), and again whenever the user signs in/out in ANY tab, so multi-tab
  // logout/login now stays in sync automatically — the old sessionStorage
  // approach didn't do this.
  if (supabaseClient?.auth) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        currentUser = {id: session.user.id, email: session.user.email};
        if (document.getElementById('app').style.display !== 'block') enterApp();
        updateUserChip();
      } else {
        currentUser = null;
        if (document.getElementById('login-screen').style.display !== 'flex') {
          document.getElementById('app').style.display = 'none';
          document.getElementById('login-screen').style.display = 'flex';
        }
      }
    });
  }

  }

function applySettingsToForm() {
  document.getElementById('agency-name').value = settings.agencyName;
  document.getElementById('agency-address').value = settings.agencyAddress || '';
  if (settings.logo) {
    document.getElementById('logo-preview-img').src = settings.logo;
    document.getElementById('logo-preview-img').style.display = 'block';
    document.getElementById('logo-placeholder').style.display = 'none';
  } else {
    document.getElementById('logo-preview-img').style.display = 'none';
    document.getElementById('logo-placeholder').style.display = 'block';
  }
}

function updateUserChip() {
  if (!currentUser) return;
  const label = document.getElementById('user-label');
  const initial = document.getElementById('user-initial');
  const settingsEmail = document.getElementById('settings-current-email');
  if (label) label.textContent = currentUser.email;
  if (initial) initial.textContent = currentUser.email.charAt(0).toUpperCase();
  if (settingsEmail) settingsEmail.textContent = currentUser.email;
}

function populateStaticSelects() {
  const fc = document.getElementById('filter-company');
  if (fc) fc.innerHTML = '<option value="">All Companies</option>' + COMPANIES.map(c => `<option>${escAttr(c)}</option>`).join('');
  const ft = document.getElementById('filter-casetype');
  if (ft) ft.innerHTML = '<option value="">All Types</option>' + CASE_TYPES.map(t => `<option>${escAttr(t)}</option>`).join('');

  const fco = document.getElementById('f-company');
  if (fco) {
    // f-company is now an input with a datalist, populated dynamically by refreshDynamicCompanies()
    fco.addEventListener('change', updateInvestigatorRecommendations);
    fco.addEventListener('input', updateInvestigatorRecommendations);
  }
  const flocation = document.getElementById('f-location');
  if (flocation) flocation.addEventListener('input', updateInvestigatorRecommendations);
  
  const fct = document.getElementById('f-casetype');
  if (fct) fct.innerHTML = '<option value="">-- Select --</option>' + CASE_TYPES.map(t => `<option>${escAttr(t)}</option>`).join('');

  const now = new Date();
  const slipMonths = MONTHS.filter(m => {
    const diff = (m.y - now.getFullYear())*12 + (m.m - (now.getMonth()+1));
    return diff >= -12 && diff <= 3;
  });
  const sm = document.getElementById('slip-month');
  sm.innerHTML += slipMonths.map(m => `<option value="${m.code}">${m.label}</option>`).join('');
  const bsm = document.getElementById('bulk-slip-month');
  bsm.innerHTML += slipMonths.map(m => `<option value="${m.code}">${m.label}</option>`).join('');
  bsm.addEventListener('change', buildBulkSlipSummary);

  // Investigator dropdowns start empty (INVESTIGATORS isn't loaded yet at
  // page-load time) — refreshInvestigatorDropdowns() fills them once data
  // arrives, called from enterApp() after loadInvestigatorsFromDB().
  refreshInvestigatorDropdowns();
  
  loadDriveSettingsFromDB();
}

// ============================================================
// LOGIN
// ============================================================
async function doLogin() {
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  errEl.style.display = 'none';

  if (!email || !pass) {
    errEl.textContent = 'Enter both email and password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  // 1. Try Supabase Auth
  if (supabaseClient?.auth) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
      btn.disabled = false;
      btn.textContent = 'Sign In';

      if (error) {
        let msg = error.message;
        if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
          msg = 'Connection error. Please check your internet or Supabase project status.';
        }
        errEl.textContent = msg === 'Invalid login credentials' ? 'Incorrect email or password.' : msg;
        errEl.style.display = 'block';
      }
    } catch (supabaseErr) {
      btn.disabled = false;
      btn.textContent = 'Sign In';
      console.error('[SUPABASE AUTH EXCEPTION]', supabaseErr);
      errEl.textContent = 'Connection error (Supabase unreachable). Please check your internet or contact admin.';
      errEl.style.display = 'block';
    }
  } else {
    btn.disabled = false;
    btn.textContent = 'Sign In';
    errEl.textContent = 'Auth service unavailable.';
    errEl.style.display = 'block';
  }
}

async function logout() {
  if (supabaseClient?.auth) {
    await supabaseClient.auth.signOut();
  }
  // onAuthStateChange handles showing the login screen.
}

let realtimeSubscribed = false;
let activityChannel = null;

async function fetchActivityLog() {
  if (!window.supabaseClient) return;
  const { data, error } = await window.supabaseClient
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
    
  if (error) return;
  renderActivityLog(data);
}

function escActivity(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderActivityLog(logs) {
  const container = document.getElementById('live-activity-log');
  if (!container) return;
  if (!logs || logs.length === 0) {
    container.innerHTML = '<div style="color:var(--sub); padding:10px 0;">No recent activity</div>';
    return;
  }
  let html = '';
  logs.forEach(log => {
    const time = new Date(log.created_at).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: false});
    html += `
      <div style="display:flex; gap:10px; padding:8px 0; border-bottom:1px solid var(--line);">
        <div style="font-family:var(--mono); color:var(--sub); font-size:11px; white-space:nowrap; padding-top:2px;">${time}</div>
        <div style="color:var(--ink); line-height:1.4;">${escActivity(log.action)}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

window.logActivity = async function(module, actionStr, referenceId = null) {
  if (!window.supabaseClient) return;
  let username = 'System';
  if (window.currentUser) {
     username = window.currentUser.email ? window.currentUser.email.split('@')[0] : 'Admin';
  }
  const action = `${username} ${actionStr}`;
  await window.supabaseClient.from('activity_log').insert({
    user_id: window.currentUser ? window.currentUser.id : null,
    module: module,
    action: action,
    reference_id: referenceId
  });
};

function setupActivityLogRealtime() {
  if (!window.supabaseClient || activityChannel) return;
  activityChannel = window.supabaseClient.channel('activity_log_channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_log' },
      () => { fetchActivityLog(); }
    )
    .subscribe();
}
async function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  
  // Init Google Drive if Client ID is present
  if (window.getGoogleClientId()) {
    if (typeof google !== "undefined" && google.accounts) { window.googleDriveService.init(window.getGoogleClientId()); } else { console.log("[APP] Waiting for Google Sign-In script to load..."); }
  }

  updateUserChip();
  showToast('Loading data…');
  await Promise.all([
    loadCasesFromDB(), 
    loadInvestigatorsFromDB(), 
    loadSettingsFromDB(),
    loadInvestigatorExpensesDB()
    ]);
  refreshInvestigatorDropdowns(); 
  applySettingsToForm();
  const fyLabelEl = document.getElementById('topbar-fy-label');
  if (fyLabelEl) {
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
    fyLabelEl.textContent = `PAYMENT MANAGEMENT · FY ${fyStart}-${String(fyStart+1).slice(-2)}`;
  }
  renderAll();
  checkOverdueAlerts();
  checkWeeklyBackupReminder();
  if (!realtimeSubscribed) { subscribeToCasesRealtime(); setupActivityLogRealtime(); fetchActivityLog(); realtimeSubscribed = true; }
}

// ============================================================
// GOOGLE DRIVE INTEGRATION
// ============================================================
window.driveSettings = null;

async function loadDriveSettingsFromDB() {
  if (settings && settings.fieldPermissions && settings.fieldPermissions._driveSettings) {
    window.driveSettings = settings.fieldPermissions._driveSettings;
    if (sessionStorage.getItem('drive_token')) {
      window.googleDriveService.setToken(sessionStorage.getItem('drive_token'));
    }
    updateDriveUI();
  }
}

function updateDriveUI() {
  const statusUi = document.getElementById('drive-status-ui');
  const connectedUi = document.getElementById('drive-connected-ui');
  const emailEl = document.getElementById('drive-email');
  const lastSyncEl = document.getElementById('drive-last-sync');
  const searchPanel = document.getElementById('drive-search-panel');

  if (window.driveSettings && window.driveSettings.google_email) {
    if (statusUi) statusUi.style.display = 'none';
    if (connectedUi) connectedUi.style.display = 'block';
    if (emailEl) emailEl.textContent = window.driveSettings.google_email;
    if (lastSyncEl) lastSyncEl.textContent = 'Connected on ' + new Date(window.driveSettings.connected_at).toLocaleDateString();
    if (searchPanel) searchPanel.style.display = 'block';
  } else {
    if (statusUi) statusUi.style.display = 'block';
    if (connectedUi) connectedUi.style.display = 'none';
    if (searchPanel) searchPanel.style.display = 'none';
  }
}

async function searchDrive() {
  const q = document.getElementById('drive-search-input').value.trim();
  if (!q) return;
  
  const resultsEl = document.getElementById('drive-search-results');
  resultsEl.innerHTML = '<div class="skeleton" style="height:20px; width:100%;"></div>';
  
  try {
    const query = `name contains '${escAttr(q)}' and trashed = false`;
    const files = await window.googleDriveService.listFiles(query);
    
    if (files.length === 0) {
      resultsEl.innerHTML = '<div style="color:var(--sub)">No files found in Google Drive.</div>';
      return;
    }
    
    resultsEl.innerHTML = files.map(f => `
      <div style="padding:8px 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center;">
        <span>${f.name}</span>
        <a href="https://drive.google.com/file/d/${f.id}/view" target="_blank" class="btn btn-ghost btn-sm">Open File</a>
      </div>
    `).join('');
  } catch (err) {
    resultsEl.innerHTML = `<div style="color:var(--red)">Search failed: ${err.message}</div>`;
  }
}

async function connectGoogleDrive() {
  if (!window.getGoogleClientId()) {
    showToast('Google Client ID not configured in config.js.', true);
    return;
  }
  
  window.googleDriveService.onTokenAcquired = async (response) => {
    
    try {
      sessionStorage.setItem('drive_token', response.access_token);
      
      const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${response.access_token}` }
      }).then(r => r.json());
      
      showToast('DNA Drive: Setting up folders...');
      const baseFolders = await window.googleDriveService.setupBaseFolders();
      
      window.driveSettings = {
        google_email: userInfo.email,
        connected_at: new Date().toISOString(),
        ...baseFolders
      };
      
      if (!settings.fieldPermissions) settings.fieldPermissions = {};
      settings.fieldPermissions._driveSettings = window.driveSettings;
      await saveSettings();
      updateDriveUI();
      showToast('Google Drive connected!');
    } catch (err) {
      
      showToast('Drive setup failed: ' + err.message, true);
    }
  };
  
  window.googleDriveService.requestToken();
}

async function disconnectGoogleDrive() {
  if (!confirm('Disconnect Google Drive? This will stop folder automation.')) return;
  
  try {
    if (settings.fieldPermissions) {
      delete settings.fieldPermissions._driveSettings;
      await saveSettings();
    }
    window.driveSettings = null;
    window.googleDriveService.accessToken = null;
    sessionStorage.removeItem('drive_token');
    updateDriveUI();
    showToast('Google Drive disconnected.');
  } catch (err) {
    
    showToast('Disconnect failed: ' + err.message, true);
  }
}

async function backupEntireSystem() {
  if (!window.driveSettings || !window.googleDriveService.accessToken) {
    showToast('Google Drive not connected.', true);
    return;
  }
  
  showToast('Generating backup...');
  try {
    const data = {
      cases: cases,
      investigators: investigatorRows,
      settings: settings,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const filename = `DNA_Backup_${new Date().toISOString().split('T')[0]}.json`;
    
    showToast('Uploading to Drive...');
    await window.googleDriveService.uploadFile(blob, {
      name: filename,
      parents: [window.driveSettings.backupsId]
    });
    
    showToast('Full System Backup Uploaded to Drive!');
  } catch (err) {
    showToast('Backup failed: ' + err.message, true);
  }
}



// ============================================================
// TABS / VIEWS
// ============================================================
function showView(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  if (el) el.classList.add('active');
  const targetView = document.getElementById('view-'+name);
  if (targetView) targetView.classList.add('active');
  const notifPanel = document.getElementById('notif-panel');
  if (notifPanel) notifPanel.classList.remove('open');
  
  if (name === 'cases') filterCases();
  if (name === 'investigators') filterInvestigators();
  if (name === 'monthly') renderMonthly(activeMonth);
  if (name === 'salary') renderSalary();
  if (name === 'yearly') renderYearly();
  if (name === 'documents') renderDocuments();
  if (name === 'reports') buildBulkSlipSummary();
  if (name === 'intelligence') renderIntelligenceView();
}

// ============================================================
// CASES DATA LAYER (Supabase-backed)
// `cases` stays as an in-memory array so the ~100 read-only render/filter
// functions elsewhere in this file (cases.filter/.reduce/.find, etc.) keep
// working unchanged — it's just refreshed from the DB after every mutation
// instead of being the source of truth itself.
// ============================================================
async function loadCasesFromDB() {
  const limit = 1000;
  let start = 0;
  
  // Fetch initial chunk to get UI up immediately
  const { data, error, count } = await supabaseClient.from('cases')
    .select('*', { count: 'exact' })
    .order('date', {ascending: false})
    .range(start, start + limit - 1);
    
  if (error) { showToast('Failed to load cases: ' + error.message, true); return; }
  
  cases = (data || []).map(row => ({...row, total_payable: Number(row.total_payable), profit: Number(row.profit),
    fee1: Number(row.fee1)||0, fee2: Number(row.fee2)||0, ta1: Number(row.ta1)||0, ta2: Number(row.ta2)||0, received: Number(row.received)||0}));
  window.cases = cases; // keep exposed copy in sync
  refreshDynamicCompanies();
  start += limit;

  // Background fetch for remaining cases (solves Client-Side Memory Bloat & Load Time)
  if (count && count > limit) {
    (async () => {
      let hasMore = true;
      let newlyLoaded = 0;
      
      const MAX_CLIENT_RECORDS = 5000; // Hard cap to prevent browser OOM (Memory crash)
      while (hasMore && cases.length < MAX_CLIENT_RECORDS) {
        const { data: bgData, error: bgError } = await supabaseClient.from('cases')
          .select('*')
          .order('date', {ascending: false})
          .range(start, start + limit - 1);
          
        if (bgError) { console.error('Background load error:', bgError); break; }
        
        if (bgData && bgData.length > 0) {
          const parsedBg = bgData.map(row => ({...row, total_payable: Number(row.total_payable), profit: Number(row.profit),
            fee1: Number(row.fee1)||0, fee2: Number(row.fee2)||0, ta1: Number(row.ta1)||0, ta2: Number(row.ta2)||0, received: Number(row.received)||0}));
          cases.push(...parsedBg);
          newlyLoaded += parsedBg.length;
          start += limit;
        }
        
        if (!bgData || bgData.length < limit) {
          hasMore = false;
        }
      }
      
      if (newlyLoaded > 0) {
        window.cases = cases;
        refreshDynamicCompanies();
        renderAll();
        console.log(`Background sync complete. Loaded ${newlyLoaded} older cases. Total: ${cases.length}`);
      }
    })();
  }
}

function parseDateComponents(dateStr) {
  if (!dateStr) dateStr = new Date().toISOString().slice(0, 10);
  const parts = String(dateStr).trim().split(/[-/]/);
  let y, m;
  if (parts.length >= 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
    } else {
      // DD-MM-YYYY or MM-DD-YYYY
      y = parseInt(parts[2], 10);
      m = parseInt(parts[1], 10);
    }
  } else {
    const d = new Date(dateStr);
    y = d.getFullYear();
    m = d.getMonth() + 1;
  }
  const codes = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const monthIdx = (m >= 1 && m <= 12) ? m - 1 : 0;
  const shortYear = String(y).slice(-2);
  const code = `${codes[monthIdx]}${shortYear}`;
  return { y, m, code };
}

async function genDocCodeDB(dateStr) {
  const { code: monthCode } = parseDateComponents(dateStr);
  // Calls the next_doc_code() Postgres function — an atomic sequence
  // increment, so two staff members adding cases at the same instant can
  // never collide on the same doc_code (the old client-side counter could).
  const { data, error } = await supabaseClient.rpc('next_doc_code', { p_month_code: monthCode });
  if (error) { showToast('Failed to generate document code: ' + error.message, true); throw error; }
  return data;
}

async function insertCaseDB(caseObj) {
  const { error } = await supabaseClient.from('cases').insert(caseObj);
  if (error) throw error;
}

async function updateCaseDB(docCode, updates) {
  const { error } = await supabaseClient.from('cases').update(updates).eq('doc_code', docCode);
  if (error) throw error;
}

async function deleteCaseDB(docCode) {
  const { error } = await supabaseClient.from('cases').delete().eq('doc_code', docCode);
  if (error) throw error;
}

async function deleteCasesDB(docCodes) {
  const { data, error } = await supabaseClient.from('cases').delete().in('doc_code', docCodes).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Deletion blocked by database permissions (RLS). Please ensure you have the 'admin' role in the user_roles table in Supabase.");
  }
}

// ============================================================
// INVESTIGATORS DATA LAYER (Supabase-backed)
// Mirrors the cases pattern: INVESTIGATORS/INVESTIGATOR_PHONES stay as
// in-memory caches refreshed from the DB, so existing synchronous reads
// throughout the file don't need to change.
// ============================================================
async function loadInvestigatorsFromDB() {
  const { data, error } = await supabaseClient.from('investigators').select('*').eq('removed', false).order('name');
  if (error) { showToast('Failed to load investigators: ' + error.message, true); return; }
  investigatorRows = data;
  INVESTIGATORS = data.map(r => r.name);
  INVESTIGATOR_PHONES = {};
  data.forEach(r => { if (r.phone) INVESTIGATOR_PHONES[r.name] = r.phone; });
  window.dispatchEvent(new CustomEvent('dna:investigators-ready'));
}

function getAllInvestigators() { return INVESTIGATORS; } // kept as a function — ~15 call sites use it as such

async function insertInvestigatorDB(invData) {
  if (typeof invData === 'string') {
    invData = { name: invData, phone: null, payment_type: 'Per Case', salary_amount: 0 }; // backward compat
  }
  const payload = {
    name: invData.name, 
    phone: invData.phone || null, 
    email: invData.email || null, 
    city: invData.city || null, 
    state: invData.state || null, 
    designation: invData.designation || null, 
    availability: invData.availability || 'available',
    payment_type: invData.payment_type || 'Per Case',
    is_base: false
  };
  
  if (payload.payment_type === 'Salary') {
    payload.salary_amount = invData.salary_amount || 0;
    payload.payment_rate = null;
    payload.payment_rate_type = null;
  } else {
    payload.salary_amount = 0;
  }

  const { error } = await supabaseClient.from('investigators').insert(payload);
  if (error) throw error;
}

async function updateInvestigatorDB(name, invData) {
  const payload = {
    name: invData.name,
    phone: invData.phone || null,
    email: invData.email || null,
    city: invData.city || null,
    state: invData.state || null,
    designation: invData.designation || null,
    availability: invData.availability || 'available',
    payment_type: invData.payment_type || 'Per Case'
  };

  if (payload.payment_type === 'Salary') {
    payload.salary_amount = invData.salary_amount || 0;
    payload.payment_rate = null;
    payload.payment_rate_type = null;
  } else {
    payload.salary_amount = 0;
  }

  const { error } = await supabaseClient.from('investigators').update(payload).eq('name', name);
  if (error) throw error;
}

async function updateInvestigatorNameDB(oldName, newName) {
  const { error } = await supabaseClient.from('investigators').update({name: newName}).eq('name', oldName);
  if (error) throw error;
}

async function updateInvestigatorPhoneDB(name, phone) {
  const { error } = await supabaseClient.from('investigators').update({phone: phone || null}).eq('name', name);
  if (error) throw error;
}

async function removeInvestigatorDB(name) {
  // Soft-delete (removed=true) rather than a hard delete — preserves history
  // and matches the old REMOVED_BASE_INVESTIGATORS behavior for base names,
  // but now applies uniformly to base and custom investigators alike.
  const { error } = await supabaseClient.from('investigators').update({removed: true}).eq('name', name);
  if (error) throw error;
}

// ============================================================
// RENDER ALL
// ============================================================
let renderAllTimeout = null;
function renderAll() {
  if (renderAllTimeout) clearTimeout(renderAllTimeout);
  renderAllTimeout = setTimeout(() => {
    renderDashboard();
    filterCases();
    filterInvestigators();
    renderMonthButtons();
    renderMonthly(activeMonth);
    renderSalary();
    renderDocuments();
    
    // Extra Realtime Syncs for Active Lookups & Modals
    if (typeof executeLookupDoc === 'function' && document.getElementById('doc-search')?.value) {
      executeLookupDoc();
    }
    if (document.getElementById('bulkdoc-modal')?.classList.contains('open')) {
      if (typeof renderBulkDocReceive === 'function') renderBulkDocReceive();
      if (typeof renderBulkDocDispatch === 'function') renderBulkDocDispatch();
    }
    if (document.getElementById('view-match')?.classList.contains('active')) {
      if (typeof renderMatchList === 'function') renderMatchList();
    }
    if (document.getElementById('view-reports')?.classList.contains('active')) {
      if (typeof buildBulkSlipSummary === 'function') buildBulkSlipSummary();
    }
    if (document.getElementById('view-intelligence')?.classList.contains('active')) {
      if (typeof renderIntelligenceView === 'function') renderIntelligenceView();
    }
    if (document.getElementById('view-yearly')?.classList.contains('active')) {
      if (typeof renderYearly === 'function') renderYearly();
    }
  }, 50);
}

// ============================================================
// DASHBOARD
// ============================================================
function renderMissingPhoneBanner() {
  const activeNames = new Set();
  cases.forEach(c => {
    if (c.inv1) activeNames.add(c.inv1);
    if (c.inv2 && c.inv2!=='NA') activeNames.add(c.inv2);
  });
  const missing = INVESTIGATORS.filter(n => activeNames.has(n) && !INVESTIGATOR_PHONES[n]);
  const bannerEl = document.getElementById('missing-phone-banner');
  if (!bannerEl) return;
  if (!missing.length) { bannerEl.innerHTML = ''; return; }
  bannerEl.innerHTML = `<div class="notice" style="margin-bottom:16px;">
    📱 <b>${missing.length} investigator(s)</b> with cases have no saved WhatsApp number — slips can't be sent to them: ${missing.slice(0,10).join(', ')}${missing.length>10?` +${missing.length-10} more`:''}.
    Add numbers from the <a href="#" onclick="showView('investigators', document.querySelector('[data-view=investigators]')); return false;" style="color:var(--navy);font-weight:700;">Investigators tab</a>.
  </div>`;
}

function renderDashboard() {
  const visibleCases = getVisibleCases();
  const nonWithdrawnCases = visibleCases.filter(c => c.exception_type !== 'Withdrawn');
  const total = nonWithdrawnCases.length;
  const totalPayable = visibleCases.reduce((s,c)=>s+(c.total_payable||0),0);
  const totalReceived = visibleCases.reduce((s,c)=>s+(c.received||0),0);
  const totalProfit = totalReceived - totalPayable;
  
  let outstandingInv = 0;
  visibleCases.forEach(c => {
      let paidAmt = 0;
      if (c.inv1_status === 'Paid') paidAmt += (c.fee1||0) + (c.ta1||0);
      if (c.inv2_status === 'Paid') paidAmt += (c.fee2||0) + (c.ta2||0);
      outstandingInv += ((c.total_payable||0) - paidAmt);
  });
  
  const marginPct = totalReceived > 0 ? ((totalProfit / totalReceived) * 100).toFixed(1) : 0;

  renderMissingPhoneBanner();
  
  document.getElementById('kpi-row').innerHTML = `
    <div class="kpi gold"><div class="kpi-label">Revenue</div><div class="kpi-value gold">Rs ${fmt(totalReceived)}</div></div>
    <div class="kpi"><div class="kpi-label">Expenses</div><div class="kpi-value">Rs ${fmt(totalPayable)}</div></div>
    <div class="kpi ${totalProfit>=0?'green':'red'}"><div class="kpi-label">Net Profit</div><div class="kpi-value ${totalProfit>=0?'green':'red'}">Rs ${fmt(totalProfit)}</div></div>
    <div class="kpi"><div class="kpi-label">Margin %</div><div class="kpi-value">${marginPct}%</div></div>
    <div class="kpi red"><div class="kpi-label">Outstanding</div><div class="kpi-value red">Rs ${fmt(outstandingInv)}</div></div>
  `;
  
  const coStats = {};
  visibleCases.forEach(c => {
    if (!c.company) return;
    if (!coStats[c.company]) {
       coStats[c.company] = { cases: 0, revenue: 0, expenses: 0 };
    }
    coStats[c.company].cases++;
    coStats[c.company].revenue += (c.received || 0);
    coStats[c.company].expenses += (c.total_payable || 0);
  });

  let maxRevCo = '—', maxRev = -1;
  let minMarginCo = '—', minMargin = 999;
  
  Object.keys(coStats).forEach(co => {
    const s = coStats[co];
    if (s.revenue > maxRev) { maxRev = s.revenue; maxRevCo = co; }
    const profit = s.revenue - s.expenses;
    // only consider margin if there is revenue, to avoid 0% for unbilled
    if (s.revenue > 0) {
        const margin = (profit / s.revenue) * 100;
        if (margin < minMargin) { minMargin = margin; minMarginCo = co; }
    }
  });
  if (minMargin === 999) minMargin = 0;
  
  const paidCasesCount = visibleCases.filter(c => (c.received || 0) > 0).length;
  const collectionPct = total > 0 ? ((paidCasesCount / total) * 100).toFixed(1) : 0;
  const avgClaimValue = total > 0 ? fmt(totalReceived / total) : 0;

  document.getElementById('company-kpi-row').innerHTML = `
    <div class="kpi"><div class="kpi-label">Highest Collection</div><div class="kpi-value gold" style="font-size:16px;">${maxRevCo}</div></div>
    <div class="kpi"><div class="kpi-label">Lowest Margin</div><div class="kpi-value red" style="font-size:16px;">${minMarginCo} (${minMargin.toFixed(1)}%)</div></div>
    <div class="kpi"><div class="kpi-label">Avg Claim Value</div><div class="kpi-value">Rs ${avgClaimValue}</div></div>
    <div class="kpi"><div class="kpi-label">Collection %</div><div class="kpi-value">${collectionPct}%</div></div>
  `;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let criticalSla = 0;
  let dueToday = 0;
  let overdue = 0;
  let turnaroundSum = 0;
  let turnaroundCount = 0;

  visibleCases.forEach(c => {
    if (c.completed_at && c.date) {
      const ms = new Date(c.completed_at) - new Date(c.date);
      if (ms >= 0) {
        turnaroundSum += ms;
        turnaroundCount++;
      }
    }
    
    if (c.due_date && !c.completed_at) {
      const due = new Date(c.due_date);
      const diffHours = (due - now) / (1000 * 60 * 60);
      
      if (diffHours < 0) overdue++;
      else if (diffHours <= 6) criticalSla++;
      
      if (due.toISOString().split('T')[0] === todayStr) {
        dueToday++;
      }
    }
  });
  
  const avgTurnaroundMs = turnaroundCount > 0 ? turnaroundSum / turnaroundCount : 0;
  const avgTurnaroundHrs = (avgTurnaroundMs / (1000 * 60 * 60)).toFixed(1);
  
  const rejectedCount = visibleCases.filter(c => c.exception_type === 'Rejected').length;
  const withdrawnCount = visibleCases.filter(c => c.exception_type === 'Withdrawn').length;

  document.getElementById('sla-kpi-row').innerHTML = `
    <div class="kpi"><div class="kpi-label">Critical SLA (&lt;6h)</div><div class="kpi-value ${criticalSla>0?'red':'green'}">${criticalSla}</div></div>
    <div class="kpi"><div class="kpi-label">Due Today</div><div class="kpi-value ${dueToday>0?'gold':'green'}">${dueToday}</div></div>
    <div class="kpi red"><div class="kpi-label">Overdue</div><div class="kpi-value red">${overdue}</div></div>
    <div class="kpi"><div class="kpi-label">Avg Turnaround</div><div class="kpi-value">${avgTurnaroundHrs} hrs</div></div>
  `;

  // Inject Exception KPI Row
  let exKpiRow = document.getElementById('exception-kpi-row');
  if (!exKpiRow) {
    const newRow = document.createElement('div');
    newRow.className = 'kpi-row';
    newRow.id = 'exception-kpi-row';
    document.getElementById('sla-kpi-row').after(newRow);
    exKpiRow = newRow;
  }
  exKpiRow.innerHTML = `
    <div class="kpi red"><div class="kpi-label">🔴 Rejected Cases</div><div class="kpi-value red">${rejectedCount}</div></div>
    <div class="kpi" style="border-left-color:#666;"><div class="kpi-label">⚫ Withdrawn Cases</div><div class="kpi-value" style="color:#666;">${withdrawnCount}</div></div>
  `;

  const companyTbody = document.querySelector('#tbl-company tbody');
  companyTbody.innerHTML = '';
  const companyChartData = [];
  let __coHtml = [];
COMPANIES.forEach(co => {
    const rows = visibleCases.filter(c => c.company === co);
    if (!rows.length) return;
    const payable = rows.reduce((s,c)=>s+(c.total_payable||0),0);
    const received = rows.reduce((s,c)=>s+(c.received||0),0);
    __coHtml.push(`<tr><td><strong>${escAttr(co)}</strong></td><td>${rows.length}</td><td>Rs ${fmt(payable)}</td><td>Rs ${fmt(received)}</td></tr>`);
    companyChartData.push({label: co, value: received});
  });
  companyTbody.innerHTML = __coHtml.join('');
  if (!companyTbody.innerHTML) companyTbody.innerHTML = '<tr><td colspan="4" class="empty-state">No data yet</td></tr>';
  renderBarChart('company-chart', companyChartData);

  const ctTbody = document.querySelector('#tbl-casetype tbody');
  ctTbody.innerHTML = '';
  let __ctHtml = [];
CASE_TYPES.forEach(ct => {
    const rows = visibleCases.filter(c => c.case_type === ct);
    if (!rows.length) return;
    const payable = rows.reduce((s,c)=>s+(c.total_payable||0),0);
    const received = rows.reduce((s,c)=>s+(c.received||0),0);
    __ctHtml.push(`<tr><td><strong>${escAttr(ct)}</strong></td><td>${rows.length}</td><td>Rs ${fmt(payable)}</td><td>Rs ${fmt(received)}</td></tr>`);
  });
  ctTbody.innerHTML = __ctHtml.join('');
  if (!ctTbody.innerHTML) ctTbody.innerHTML = '<tr><td colspan="4" class="empty-state">No data yet</td></tr>';

  // Payment status split — reuses visibleCases already in memory, no extra query.
  const paidCount = visibleCases.filter(c => c.inv1_status==='Paid' || c.inv2_status==='Paid').length;
  const pendingCount = total - paidCount;
  renderStatusRing(paidCount, pendingCount, total);

  // --- TOP INVESTIGATORS LEADERBOARD ---
  const invStats = investigatorRows.map(inv => {
    const assigned = cases.filter(c => c.inv1 === inv.name || c.inv2 === inv.name);
    const completed = assigned.filter(c => c.completed_at);
    const totalAssigned = assigned.length;
    const completedCount = completed.length;
    let qualityScore = 100;
    if (totalAssigned > 0) qualityScore = (completedCount / totalAssigned) * 100;
    
    return {
      id: inv.id,
      name: inv.name,
      completed: completedCount,
      quality: qualityScore
    };
  });

  // Sort: Completed DESC, then Quality DESC
  invStats.sort((a, b) => (b.completed - a.completed) || (b.quality - a.quality));
  const topInv = invStats.slice(0, 5);
  const maxCompleted = Math.max(...topInv.map(i => i.completed), 1);

  const lbEl = document.getElementById('investigator-leaderboard');
  if (lbEl) {
    if (topInv.length === 0) {
      lbEl.innerHTML = '<div class="empty-state">No investigators ranked yet</div>';
    } else {
      lbEl.innerHTML = topInv.map((inv, idx) => {
        const pct = (inv.completed / maxCompleted) * 100;
        return `
          <div style="margin-bottom:12px; cursor:pointer;" onclick="openInvestigator360('${inv.id}')">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:10px; font-weight:900; color:var(--gold); width:20px;">#${idx+1}</span>
                <span style="font-size:12px; font-weight:700; color:var(--navy);">${inv.name}</span>
              </div>
              <div style="font-size:11px; font-family:var(--mono);">
                <b style="color:var(--navy);">${inv.completed}</b> <span style="color:var(--sub); font-size:10px;">Cases</span>
                <span style="margin:0 6px; color:var(--line);">|</span>
                <b style="color:var(--green);">${Math.round(inv.quality)}%</b> <span style="color:var(--sub); font-size:10px;">Quality</span>
              </div>
            </div>
            <div style="height:6px; background:var(--paper); border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, var(--navy), var(--gold)); border-radius:3px; transition:width 0.8s ease;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // --- CRITICAL CASES / NEED ATTENTION ---
  const criticalCases = cases.filter(c => {
    if (c.completed_at) return false; // ignore completed
    
    // SLA due within 24h
    let slaCritical = false;
    if (c.due_date) {
        const due = new Date(c.due_date);
        const diffHours = (due - now) / (1000 * 60 * 60);
        if (diffHours < 24) slaCritical = true;
    }

    // Document Pending (hard coded for now as placeholder for logic if field exists)
    const docPending = (c.hard_copy === 'No' || !c.hard_copy); 

    // Payment Hold
    const paymentHold = (c.inv1_status === 'Hold' || c.inv2_status === 'Hold');

    return slaCritical || docPending || paymentHold;
  });

  // Sort by urgency: SLA overdue first, then SLA imminent, then others
  criticalCases.sort((a, b) => {
    const dueA = a.due_date ? new Date(a.due_date) : new Date(8640000000000000);
    const dueB = b.due_date ? new Date(b.due_date) : new Date(8640000000000000);
    return dueA - dueB;
  });

  const critEl = document.getElementById('critical-cases-panel');
  if (critEl) {
    const displayCases = criticalCases.slice(0, 6);
    if (displayCases.length === 0) {
      critEl.innerHTML = '<div class="empty-state">No critical cases found</div>';
    } else {
      critEl.innerHTML = displayCases.map(c => {
        let reason = "";
        let reasonColor = "var(--sub)";
        
        const due = c.due_date ? new Date(c.due_date) : null;
        const diffHours = due ? (due - now) / (1000 * 60 * 60) : null;

        if (diffHours !== null && diffHours < 0) { reason = "Overdue"; reasonColor = "var(--red)"; }
        else if (diffHours !== null && diffHours < 24) { reason = "SLA Due"; reasonColor = "var(--amber)"; }
        else if (c.inv1_status === 'Hold' || c.inv2_status === 'Hold') { reason = "Payment Hold"; reasonColor = "var(--gold)"; }
        else if (c.hard_copy === 'No' || !c.hard_copy) { reason = "Doc Pending"; reasonColor = "var(--navy)"; }

        let timeStr = "—";
        if (diffHours !== null) {
            if (diffHours < 0) timeStr = `${Math.abs(Math.round(diffHours))}h overdue`;
            else timeStr = `${Math.round(diffHours)}h left`;
        }

        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); cursor:pointer;" onclick="openEditCase('${c.id}')">
            <div style="overflow:hidden; flex:1;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                <span style="font-size:10px; font-family:var(--mono); font-weight:700; color:var(--navy); background:var(--paper); padding:1px 4px; border-radius:2px;">${c.doc_code || 'N/A'}</span>
                <span style="font-size:11px; font-weight:700; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.company || '—'}</span>
              </div>
              <div style="font-size:10px; color:var(--sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                Inv: ${c.inv1 || c.inv2 || 'Unassigned'}
              </div>
            </div>
            <div style="text-align:right; min-width:85px;">
              <div style="font-size:9.5px; font-weight:800; color:${reasonColor}; text-transform:uppercase; letter-spacing:0.3px;">${reason}</div>
              <div style="font-size:10px; color:var(--sub); font-family:var(--mono);">${timeStr}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// Lightweight CSS-only horizontal bar chart — no charting library needed,
// keeps the dashboard fast even with 100,000+ cases since it only renders
// the already-aggregated company totals (max ~13 companies), not raw rows.
function renderBarChart(elId, data) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!data.length) { el.innerHTML = '<div class="empty-state" style="padding:24px;">No data to chart yet</div>'; return; }
  const sorted = [...data].sort((a,b) => b.value - a.value).slice(0, 8);
  const max = Math.max(...sorted.map(d => d.value), 1);
  el.innerHTML = sorted.map(d => `
    <div class="bar-row">
      <div class="bar-label">${d.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, (d.value/max)*100)}%"></div></div>
      <div class="bar-value">Rs ${fmt(d.value)}</div>
    </div>`).join('');
}

// Simple paid/pending ring built from conic-gradient — zero JS chart
// library weight, purely derived from counts already computed above.
function renderStatusRing(paid, pending, total) {
  const el = document.getElementById('status-ring');
  if (!el) return;
  const paidPct = total ? Math.round((paid/total)*100) : 0;
  const pendingPct = total ? Math.round((pending/total)*100) : 0;
  const otherDeg = total ? 360 - (paidPct*3.6) - (pendingPct*3.6) : 360;
  el.innerHTML = `
    <div class="ring-chart" style="background:conic-gradient(var(--green) 0deg ${paidPct*3.6}deg, var(--red) ${paidPct*3.6}deg ${paidPct*3.6+pendingPct*3.6}deg, var(--line) ${paidPct*3.6+pendingPct*3.6}deg 360deg);">
      <div class="ring-center"><div class="ring-total">${total}</div><div class="ring-total-label">Cases</div></div>
    </div>
    <div class="ring-legend">
      <div class="ring-legend-item"><span class="dot" style="background:var(--green)"></span>Paid <b>${paid}</b></div>
      <div class="ring-legend-item"><span class="dot" style="background:var(--red)"></span>Pending <b>${pending}</b></div>
      <div class="ring-legend-item"><span class="dot" style="background:var(--line)"></span>Not set <b>${total-paid-pending}</b></div>
    </div>`;
}

function getVisibleCases() {
  return cases;
}

// ============================================================
// CASES TABLE
// ============================================================
let filteredCases = [];
let sortKey = null, sortDir = 1;
let selectedDocCodes = new Set();
let currentPage = 1;
let pageSize = 100;
let searchDebounceTimer = null;
function debouncedFilterCases() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(filterCases, 250);
}
function sortCases(key) {
  if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = 1; }
  applySortToFilteredCases();
  renderCasesTable();
}
function applySortToFilteredCases() {
  if (!sortKey) return;
  filteredCases.sort((a,b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number' || typeof bv === 'number') { av = av||0; bv = bv||0; }
    else { av = (av||'').toString().toLowerCase(); bv = (bv||'').toString().toLowerCase(); }
    if (av < bv) return -1*sortDir;
    if (av > bv) return 1*sortDir;
    return 0;
  });
}
function changePageSize() {
  pageSize = parseInt(document.getElementById('page-size').value);
  currentPage = 1;
  renderCasesTable();
}
function goToPage(p) {
  const maxPage = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  currentPage = Math.min(Math.max(1, p), maxPage);
  renderCasesTable();
}
function resetFilters() {
  document.getElementById('search-case').value = '';
  document.getElementById('filter-company').value = '';
  document.getElementById('filter-casetype').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-inv').value = '';
  filterCases();
}

let lastFilterState = null;
function filterCases() {
  const search = (document.getElementById('search-case').value||'').toLowerCase();
  const company = (document.getElementById('filter-company').value || '').toLowerCase();
  const casetype = (document.getElementById('filter-casetype').value || '').toLowerCase();
  const status = document.getElementById('filter-status').value;
  const inv = (document.getElementById('filter-inv').value || '').toLowerCase();

  const currentFilterState = [search, company, casetype, status, inv].join('|');
  if (lastFilterState !== currentFilterState) {
    currentPage = 1;
    lastFilterState = currentFilterState;
  }

  let base = getVisibleCases();

  filteredCases = base.filter(c => {
    const matchSearch = !search
      || (c.claim_no||'').toLowerCase().includes(search)
      || (c.insured_name||'').toLowerCase().includes(search)
      || (c.doc_code||'').toLowerCase().includes(search)
      || (c.invoice_no||'').toLowerCase().includes(search)
      || (c.policy_no||'').toLowerCase().includes(search)
      || (c.hospital||'').toLowerCase().includes(search)
      || (c.outcome||'').toLowerCase().includes(search)
      || (c.date||'').toLowerCase().includes(search);
    const matchCompany = !company || (c.company||'').toLowerCase() === company;
    const matchType = !casetype || (c.case_type||'').toLowerCase() === casetype;
    const matchStatus = !status || (status==='blank' ? (!c.inv1_status && !c.inv2_status) : (c.inv1_status===status || c.inv2_status===status));
    const matchInv = !inv || (c.inv1||'').toLowerCase() === inv || (c.inv2||'').toLowerCase() === inv;
    return matchSearch && matchCompany && matchType && matchStatus && matchInv;
  });

  applySortToFilteredCases();
  renderCasesTable();
}

function renderCasesTable() {
  document.getElementById('case-count').textContent = filteredCases.length;
  const tbody = document.getElementById('cases-tbody');
  tbody.innerHTML = '';

  if (!filteredCases.length) {
    tbody.innerHTML = '<tr><td colspan="26"><div class="empty-state"><div class="ic">No Data</div>No cases found</div></td></tr>';
    document.getElementById('page-range').textContent = '0';
    document.getElementById('page-total-count').textContent = '0';
    document.getElementById('page-current').textContent = '1';
    document.getElementById('page-max').textContent = '1';
    return;
  }

  const maxPage = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  if (currentPage > maxPage) currentPage = maxPage;
  const startIdx = (currentPage-1) * pageSize;
  const pageRows = filteredCases.slice(startIdx, startIdx + pageSize);

  document.getElementById('page-range').textContent = `${startIdx+1}–${Math.min(startIdx+pageSize, filteredCases.length)}`;
  document.getElementById('page-total-count').textContent = filteredCases.length;
  document.getElementById('page-current').textContent = currentPage;
  document.getElementById('page-max').textContent = maxPage;

  // Note: the old app had an unused 'investigator' role concept that was
  // never actually assignable anywhere — every login always granted admin
  // access. With real Supabase auth, all signed-in staff are treated as
  // equal (matches the current use case: you + 1-2 staff sharing one
  // dataset). If per-investigator restricted views are needed later, that's
  // a real roles table + RLS policy change, not a client-side check.
  const isAdmin = typeof window.isCurrentUserAdmin !== 'undefined' ? window.isCurrentUserAdmin : !!currentUser;
  let __html = [];
pageRows.forEach(c => {
    const idx = cases.indexOf(c);
    const checked = selectedDocCodes.has(c.doc_code) ? 'checked' : '';
    // Exception Badges
    let caseStatusBadge = '';
    if (c.exception_type === 'Rejected') {
      caseStatusBadge = '<span class="badge danger" style="font-size:9px;">REJECTED</span>';
    } else if (c.exception_type === 'Withdrawn') {
      caseStatusBadge = '<span class="badge withdrawn" style="font-size:9px;">WITHDRAWN</span>';
    } else if (c.completed_at) {
      caseStatusBadge = '<span class="badge success" style="font-size:9px;">DONE</span>';
    } else {
      caseStatusBadge = '<span class="badge na">PENDING</span>';
    }

    // Inline-editable cells (admin only). Clicking opens an in-place editor.
    const ed = isAdmin ? 'data-edit="1" onclick="startInlineEdit(this)"' : '';
    const money = v => `Rs ${fmt(v)}`;
    
    let customTds = '';
    if (window.CUSTOM_FIELDS && window.CUSTOM_FIELDS.length > 0) {
      window.CUSTOM_FIELDS.forEach(cf => {
        let val = c.custom_data ? (c.custom_data[cf.id] || '') : '';
        let displayVal = val;
        if (cf.type === 'number' && val) displayVal = money(val);
        customTds += `<td ${ed} data-field="custom_${cf.id}" data-val="${escAttr(val)}" data-type="${cf.type}">${escAttr(displayVal)}</td>`;
      });
    }

    __html.push(`<tr data-idx="${idx}">
      <td class="admin-only">${isAdmin ? `<input type="checkbox" data-doc="${c.doc_code}" ${checked} onchange="toggleCaseSelect('${c.doc_code}',this.checked)">` : ''}</td>
      <td class="mono" style="font-weight:700;color:var(--navy)">${escAttr(c.doc_code||'—')}</td>
      <td>${caseStatusBadge}</td>
      <td ${ed} data-field="date" data-val="${escAttr(c.date||'')}" data-type="date">${escAttr(c.date||'')}</td>
      <td>${slaBadge(c)}</td>
      <td ${ed} data-field="company" data-val="${escAttr(c.company||'')}" data-type="text">${escAttr(c.company||'')}</td>
      <td ${ed} data-field="case_type" data-val="${escAttr(c.case_type||'')}" data-type="text"><span class="badge na">${escAttr(c.case_type||'')}</span></td>
      <td class="mono" ${ed} data-field="claim_no" data-val="${escAttr(c.claim_no||'')}" data-type="text">${escAttr(c.claim_no||'')}</td>
      <td ${ed} data-field="insured_name" data-val="${escAttr(c.insured_name||'')}" data-type="text">${escAttr(c.insured_name||'')}</td>
      <td ${ed} data-field="hospital" data-val="${escAttr(c.hospital||'')}" data-type="text">${escAttr(c.hospital||'')}</td>
      <td ${ed} data-field="location" data-val="${escAttr(c.location||'')}" data-type="text">${escAttr(c.location||'')}</td>
      ${customTds}
      <td class="mono" ${ed} data-field="invoice_no" data-val="${escAttr(c.invoice_no||'')}" data-type="text">${escAttr(c.invoice_no||'')}</td>
      <td class="col-finance" ${ed} data-field="invoice_amount" data-val="${c.invoice_amount||0}" data-type="number">${money(c.invoice_amount)}</td>
      <td ${ed} data-field="inv1" data-val="${escAttr(c.inv1||'')}" data-type="text">${escAttr(c.inv1||'')}</td>
      <td ${ed} data-field="inv2" data-val="${escAttr(c.inv2 === 'NA' ? '' : c.inv2||'')}" data-type="text">${escAttr(c.inv2||'')}</td>
      <td class="col-finance" ${ed} data-field="fee1" data-val="${c.fee1||0}" data-type="number">${money(c.fee1)}</td>
      <td class="col-finance" ${ed} data-field="fee2" data-val="${c.fee2||0}" data-type="number">${money(c.fee2)}</td>
      <td class="col-finance" ${ed} data-field="ta1" data-val="${c.ta1||0}" data-type="number">${money(c.ta1)}</td>
      <td class="col-finance" ${ed} data-field="ta2" data-val="${c.ta2||0}" data-type="number">${money(c.ta2)}</td>
      <td class="col-finance"><strong>Rs ${fmt(c.total_payable)}</strong></td>
      <td class="col-finance" ${ed} data-field="received" data-val="${c.received||0}" data-type="number">${money(c.received)}</td>
      <td class="col-finance" style="color:${(c.profit||0)>=0?'var(--green)':'var(--red)'}"><strong>Rs ${fmt(c.profit)}</strong></td>
      <td class="col-finance" style="text-align:center;">${marginBadge(c)}</td>
      <td ${ed} data-field="inv1_status" data-val="${escAttr(c.inv1_status||'')}" data-type="status">${statusBadge(c.inv1_status)}</td>
      <td ${ed} data-field="inv2_status" data-val="${escAttr(c.inv2_status||'')}" data-type="status">${statusBadge(c.inv2_status)}</td>
      <td ${ed} data-field="hardcopy1_status" data-val="${escAttr(c.hardcopy1_status||'')}" data-type="hardcopy">${hardcopyStatusCell(c)}</td>
      <td ${ed} data-field="outcome" data-val="${escAttr(c.outcome||'Pending')}" data-type="outcome">${outcomeBadge(c.outcome)}</td>
      <td style="white-space:nowrap;">${isAdmin ? `<div style="display:inline-flex;gap:4px;align-items:center;"><button class="btn btn-ghost btn-sm" onclick="editCase(${idx})" title="Edit Case">Edit</button><button class="btn btn-sm" style="padding:2px 6px;background:#25D366;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:700;" onclick="openCaseDispatchModal('${c.doc_code}')" title="Dispatch WhatsApp / Email">📲</button></div>` : ''}</td>
    </tr>`);
  });
  tbody.innerHTML = __html.join('');
  updateBulkDeleteButton();
  const selectAllEl = document.getElementById('select-all-cases');
  if (selectAllEl) selectAllEl.checked = pageRows.length>0 && pageRows.every(c => selectedDocCodes.has(c.doc_code));
  if (typeof window.injectStaffEdit === 'function') window.injectStaffEdit();
}

function statusBadge(s) {
  if (s==='Paid') return '<span class="badge success">Paid</span>';
  if (s==='Pending') return '<span class="badge warning">Pending</span>';
  return '<span class="badge na">—</span>';
}

function outcomeBadge(o) {
  const norm = (o || 'Pending').toLowerCase();
  if (norm.includes('fraud') || norm.includes('repudiat') || norm.includes('fake') || norm.includes('reject')) {
    return `<span class="badge danger" style="font-weight:700;">${escAttr(o||'Fraud')}</span>`;
  }
  if (norm.includes('genuine') || norm.includes('approved')) {
    return `<span class="badge success" style="font-weight:700;">${escAttr(o||'Genuine')}</span>`;
  }
  if (norm.includes('settled') || norm.includes('closed') || norm.includes('paid')) {
    return `<span class="badge paid" style="font-weight:700;">${escAttr(o||'Settled')}</span>`;
  }
  if (norm.includes('suspicious') || norm.includes('doubt') || norm.includes('not found')) {
    return `<span class="badge warning" style="font-weight:700;">${escAttr(o||'Suspicious')}</span>`;
  }
  return `<span class="badge na">${escAttr(o||'Pending')}</span>`;
}

function slaBadge(c) {
  if (!c.due_date || c.completed_at) return '<span class="badge na">—</span>';
  const due = new Date(c.due_date);
  const now = new Date();
  const diff = (due - now) / (1000 * 60 * 60);
  
  if (diff < 0) return `<span class="badge danger" title="Due: ${due.toLocaleString()}">OVERDUE</span>`;
  if (diff <= 6) return `<span class="badge danger" title="Due: ${due.toLocaleString()}">CRITICAL</span>`;
  if (diff <= 24) return `<span class="badge warning" title="Due: ${due.toLocaleString()}">DUE <24h</span>`;
  return `<span class="badge na" title="Due: ${due.toLocaleString()}">On Track</span>`;
}

function marginBadge(c) {
  const payable = c.total_payable || 0;
  const profit = c.profit || 0;
  if (payable <= 0) return '<span class="badge na">—</span>';
  const pct = Math.round((profit / payable) * 100);
  if (pct >= 20) return `<span class="badge success">${pct}%</span>`;
  if (pct >= 10) return `<span class="badge warning">${pct}%</span>`;
  if (pct >= 0) return `<span class="badge danger">${pct}%</span>`;
  return `<span class="badge danger">${pct}%</span>`;
}

// --- EXCEPTION CASES ---

function openExceptionModal() {
  document.getElementById('ex-type').value = '';
  document.getElementById('ex-reason').innerHTML = '<option value="">-- Select Type First --</option>';
  document.getElementById('ex-reason-other').style.display = 'none';
  document.getElementById('ex-impact-notice').style.display = 'none';
  document.getElementById('exception-modal').classList.add('open');
}

function onExceptionTypeChange() {
  const type = document.getElementById('ex-type').value;
  const reasonSelect = document.getElementById('ex-reason');
  const impactNotice = document.getElementById('ex-impact-notice');
  const reasonOther = document.getElementById('ex-reason-other');
  
  let options = '<option value="">-- Select Reason --</option>';
  let impactText = '';
  
  if (type === 'Rejected') {
    options += `
      <option>Documents Incomplete</option>
      <option>Negative Verification</option>
      <option>Policy Mismatch</option>
      <option>Other</option>
    `;
    impactText = '🔴 <b>Rejected Impact:</b> Company Payment will be DISABLED. Investigator Payment remains ENABLED.';
    impactNotice.style.color = 'var(--red)';
  } else if (type === 'Withdrawn') {
    options += `
      <option>Company Cancelled</option>
      <option>Out of Region</option>
      <option>Duplicate Assignment</option>
      <option>Wrong Location</option>
      <option>Other</option>
    `;
    impactText = '⚫ <b>Withdrawn Impact:</b> Both Company and Investigator Payments will be DISABLED. Billing Locked.';
    impactNotice.style.color = '#666';
  }
  
  reasonSelect.innerHTML = options;
  impactNotice.innerHTML = impactText;
  impactNotice.style.display = type ? 'block' : 'none';
  reasonOther.style.display = 'none';
  
  reasonSelect.onchange = () => {
    reasonOther.style.display = (reasonSelect.value === 'Other') ? 'block' : 'none';
  };
}

async function submitException() {
  if (editIdx === -1) return;
  const c = cases[editIdx];
  const type = document.getElementById('ex-type').value;
  let reason = document.getElementById('ex-reason').value;
  if (reason === 'Other') reason = document.getElementById('ex-reason-other').value.trim();
  
  if (!type || !reason) {
    showToast('Please select both type and reason', true);
    return;
  }
  
  const fields = {
    exception_type: type,
    exception_reason: reason,
    exception_at: new Date().toISOString(),
    exception_by: currentUser?.email || 'System'
  };
  
  // Apply Business Rules
  if (type === 'Rejected') {
    fields.received = 0;
    fields.invoice_no = 'REJECTED';
  } else if (type === 'Withdrawn') {
    fields.received = 0;
    fields.fee1 = 0;
    fields.fee2 = 0;
    fields.ta1 = 0;
    fields.ta2 = 0;
    fields.total_payable = 0;
    fields.invoice_no = 'WITHDRAWN';
    fields.inv1_status = 'N/A';
    fields.inv2_status = 'N/A';
  }
  
  try {
    showToast('Marking as exception...');
    const { error } = await supabaseClient.from('cases').update(fields).eq('id', c.id);
    if (error) throw error;
    
    // Update local state
    const updatedCase = cases.find(item => item.id === c.id);
    if (updatedCase) Object.assign(updatedCase, fields);
    
    closeModal('exception-modal');
    closeModal('case-modal');
    renderAll();
    showToast(`Case successfully marked as ${type}`);
  } catch (err) {
    console.error('Exception Error:', err);
    showToast('Failed to mark exception', true);
  }
}

// ============================================================
// BULK DELETE / SELECTION
// ============================================================
function toggleCaseSelect(docCode, checked) {
  if (checked) selectedDocCodes.add(docCode); else selectedDocCodes.delete(docCode);
  updateBulkDeleteButton();
}

function toggleSelectAll(el) {
  const startIdx = (currentPage-1) * pageSize;
  const pageRows = filteredCases.slice(startIdx, startIdx + pageSize);
  if (el.checked) {
    pageRows.forEach(c => selectedDocCodes.add(c.doc_code));
  } else {
    pageRows.forEach(c => selectedDocCodes.delete(c.doc_code));
  }
  renderCasesTable();
}

function updateBulkDeleteButton() {
  const btn = document.getElementById('bulk-delete-btn');
  const countEl = document.getElementById('bulk-delete-count');
  if (selectedDocCodes.size > 0) {
    btn.style.display = 'inline-block';
    countEl.textContent = selectedDocCodes.size;
  } else {
    btn.style.display = 'none';
  }
  const ebtn = document.getElementById('bulk-edit-btn');
  const ecount = document.getElementById('bulk-edit-count');
  if (ebtn && ecount) {
    if (selectedDocCodes.size > 0) {
      ebtn.style.display = 'inline-block';
      ecount.textContent = selectedDocCodes.size;
    } else {
      ebtn.style.display = 'none';
    }
  }
}

// ============================================================
// SMART RECONCILIATION ENGINE
// ============================================================
let reconState = { auto: [], unmatched: [] };

function openReconciliation() {
  reconState = { auto: [], unmatched: [] };
  document.getElementById('recon-file').value = '';
  document.getElementById('recon-summary').textContent = '';
  document.getElementById('recon-auto').innerHTML = '';
  document.getElementById('recon-unmatched').innerHTML = '';
  document.getElementById('recon-apply').style.display = 'none';
  document.getElementById('recon-modal').classList.add('open');
}

function parseReconDate(str, fmt) {
  if (!str) return null;
  str = String(str).trim().replace(/\//g, '-');
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  let d, m, y;
  if (fmt === 'yyyy-mm-dd') { [y, m, d] = parts; }
  else if (fmt === 'mm/dd/yyyy' || fmt === 'mm-dd-yyyy') { [m, d, y] = parts; }
  else { [d, m, y] = parts; } // dd-mm-yyyy
  y = y.length === 2 ? '20' + y : y;
  const dt = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
  return isNaN(dt.getTime()) ? null : dt;
}

function normCompany(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

// crude CSV parser handling quoted fields
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQ = false;
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i+1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

function detectAmountCol(header) {
  const h = header.map((c,i) => ({ c: c.toLowerCase(), i }));
  const byName = h.find(x => /(amount|credit|deposit|received|paid|value)/.test(x.c));
  return byName ? byName.i : 1;
}
function detectDateCol(header) {
  const h = header.map((c,i) => ({ c: c.toLowerCase(), i }));
  const byName = h.find(x => /(date|txn|value date|posting)/.test(x.c));
  return byName ? byName.i : 0;
}
function detectDescCol(header) {
  const h = header.map((c,i) => ({ c: c.toLowerCase(), i }));
  const byName = h.find(x => /(description|particulars|narration|remark|details|name)/.test(x.c));
  return byName ? byName.i : 2;
}

async function runReconciliation() {
  const fileInput = document.getElementById('recon-file');
  if (!fileInput.files || !fileInput.files[0]) { showToast('Please upload a CSV file first.', true); return; }
  const fmt = document.getElementById('recon-datefmt').value;
  const text = await fileInput.files[0].text();
  const rows = parseCSV(text);
  if (rows.length < 2) { showToast('CSV looks empty or malformed.', true); return; }
  const header = rows[0].map(s => s.trim());
  const amtCol = detectAmountCol(header);
  const dateCol = detectDateCol(header);
  const descCol = detectDescCol(header);
  const auto = [], unmatched = [];
  // Candidate cases: not yet fully received, grouped by company
  const candByCompany = {};
  cases.forEach(c => {
    if ((c.received || 0) >= (c.total_payable || 0)) return; // already paid
    const key = normCompany(c.company);
    (candByCompany[key] = candByCompany[key] || []).push(c);
  });
  const used = new Set();
  rows.slice(1).forEach(r => {
    const rawAmt = parseFloat(String(r[amtCol] || '').replace(/[^0-9.-]/g, ''));
    if (isNaN(rawAmt)) return;
    const amt = Math.abs(rawAmt);
    const dt = parseReconDate(r[dateCol], fmt);
    const desc = String(r[descCol] || '').toUpperCase();
    let best = null, bestScore = -1;
    // Try matching company in description, then fuzzy amount+date
    Object.keys(candByCompany).forEach(ck => {
      if (!desc.includes(ck) && !desc.replace(/[^A-Z0-9]/g,'').includes(ck)) return; // company token not in desc
      candByCompany[ck].forEach(c => {
        if (used.has(c.doc_code)) return;
        const amtOk = Math.abs((c.total_payable - c.received) - amt) <= Math.max(5, amt * 0.005);
        if (!amtOk) return;
        const cDate = c.date ? new Date(c.date) : null;
        let dateOk = true, dayDiff = 0;
        if (cDate && dt) {
          dayDiff = Math.abs((cDate - dt) / 86400000);
          dateOk = dayDiff <= 10;
        }
        if (!dateOk) return;
        const score = (desc.includes(ck) ? 2 : 0) + (amtOk ? 2 : 0) + (dateOk ? Math.max(0, 2 - dayDiff/5) : 0);
        if (score > bestScore) { bestScore = score; best = c; }
      });
    });
    if (best && bestScore >= 4) {
      used.add(best.doc_code);
      auto.push({ txn: { amt, date: dt ? dt.toISOString().slice(0,10) : '', desc: r[descCol] || '' }, docCode: best.doc_code, case: best });
    } else {
      unmatched.push({ amt, date: dt ? dt.toISOString().slice(0,10) : '', desc: r[descCol] || '' });
    }
  });
  reconState = { auto, unmatched };
  renderReconResults();
}

function renderReconResults() {
  const { auto, unmatched } = reconState;
  const summary = document.getElementById('recon-summary');
  summary.innerHTML = `✅ <b>${auto.length}</b> auto-matched &nbsp;|&nbsp; ⚠ <b>${unmatched.length}</b> unmatched &nbsp;|&nbsp; Total bank entries: ${auto.length + unmatched.length}`;
  const autoBox = document.getElementById('recon-auto');
  autoBox.innerHTML = auto.length ? `<h4 style="font-size:13px;color:var(--green);margin-bottom:8px;">Auto-Matched (will be marked Paid)</h4>` + auto.map((m,i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;background:var(--green-bg);border:1px solid var(--line);border-radius:4px;padding:8px 10px;margin-bottom:6px;font-size:12px;">
      <div><b>${m.case.doc_code}</b> · ${m.case.company} · ${m.case.insured_name}<br><span style="color:var(--sub);">Bank: ₹${fmt(m.txn.amt)} on ${m.txn.date}</span></div>
      <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" data-recon-i="${i}" checked> Apply</label>
    </div>`).join('') : '<div style="color:var(--sub);font-size:12px;margin-bottom:8px;">No auto-matches found.</div>';
  const unBox = document.getElementById('recon-unmatched');
  unBox.innerHTML = unmatched.length ? unmatched.map(u => `
    <div style="background:var(--paper);border:1px solid var(--line);border-radius:4px;padding:8px 10px;margin-bottom:6px;font-size:12px;">
      <b>₹${fmt(u.amt)}</b> · ${u.date || 'no date'} · ${u.desc || 'no description'}
    </div>`).join('') : '<div style="color:var(--sub);font-size:12px;">All transactions matched.</div>';
  document.getElementById('recon-apply').style.display = auto.length ? 'inline-block' : 'none';
}

async function applyReconciliation() {
  const { auto } = reconState;
  const toApply = auto.filter((_, i) => {
    const cb = document.querySelector(`[data-recon-i="${i}"]`);
    return cb && cb.checked;
  });
  if (!toApply.length) { showToast('No matches selected.', true); return; }
  let ok = 0;
  for (const m of toApply) {
    try {
      const matchAmt = (m.txn && typeof m.txn.amt === 'number') ? m.txn.amt : (m.case.total_payable || 0);
      const newReceived = (m.case.received ? m.case.received + matchAmt : matchAmt);
      await updateCaseDB(m.docCode, { received: newReceived, inv1_status: 'Paid', inv2_status: m.case.inv2 && m.case.inv2 !== 'NA' ? 'Paid' : m.case.inv2_status || '' });
      ok++;
    } catch (e) { /* keep going */ }
  }
  await loadCasesFromDB();
  renderAll();
  closeModal('recon-modal');
  showToast(`Reconciled ${ok} case(s) with bank transactions.`);
}

// ============================================================
// INVESTIGATOR PERFORMANCE SCORECARD
// ============================================================
function openScorecard() {
  const now = new Date();
  document.getElementById('sc-month').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('scorecard-leaderboard').innerHTML = '';
  document.getElementById('scorecard-detail').innerHTML = '';
  document.getElementById('scorecard-modal').classList.add('open');
  renderScorecard();
}

function computeScorecard(monthStr) {
  // monthStr = 'YYYY-MM'
  const prefix = (monthStr || '') + '-';
  const inMonth = c => (c.date || '').startsWith(prefix);
  const rows = [];
  (investigatorRows.length ? investigatorRows : []).forEach(inv => {
    const name = (inv.name || '').toLowerCase();
    const myCases = cases.filter(c => ((c.inv1 || '').toLowerCase() === name || (c.inv2 || '').toLowerCase() === name) && inMonth(c));
    if (!myCases.length) return;
    const completed = myCases.filter(c => (c.inv1_status || '').toLowerCase() === 'paid' || (c.inv2_status || '').toLowerCase() === 'paid');
    const paidDates = myCases.filter(c => c.date && (c.inv1_status || '').toLowerCase() === 'paid' && c.received);
    let avgDays = 0;
    if (paidDates.length) {
      avgDays = paidDates.reduce((s, c) => {
        const d0 = new Date(c.date); const d1 = new Date(c.received_date || c.last_updated || Date.now());
        return s + Math.max(0, (d1 - d0) / 86400000);
      }, 0) / paidDates.length;
    }
    const hcTotal = myCases.length;
    const hcOnTime = myCases.filter(c => (c.hardcopy1_status || '').toLowerCase() === 'received').length;
    const hcPct = hcTotal ? Math.round(hcOnTime / hcTotal * 100) : 0;
    const totalPayable = myCases.reduce((s, c) => s + (c.total_payable || 0), 0);
    const totalReceived = myCases.reduce((s, c) => s + (c.received || 0), 0);
    // Score (0-100): completion 25, speed 25 (faster=more), hardcopy 15, received% 20, volume 15
    const completionPct = myCases.length ? Math.round(completed.length / myCases.length * 100) : 0;
    const receivedPct = totalPayable ? Math.round(totalReceived / totalPayable * 100) : 0;
    const speedScore = avgDays === 0 ? 100 : Math.max(0, 100 - avgDays * 3);
    const volumeScore = Math.min(100, myCases.length * 8);
    const score = Math.round(completionPct * 0.25 + speedScore * 0.25 + hcPct * 0.15 + receivedPct * 0.20 + volumeScore * 0.15);
    rows.push({ name, cases: myCases.length, completed: completed.length, completionPct, avgDays: Math.round(avgDays), hcPct, totalPayable, totalReceived, receivedPct, score });
  });
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

function renderScorecard() {
  const month = document.getElementById('sc-month').value;
  const rows = computeScorecard(month);
  const lb = document.getElementById('scorecard-leaderboard');
  if (!rows.length) { lb.innerHTML = '<div style="color:var(--sub);font-size:12px;">No cases found for this month.</div>'; return; }
  lb.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:var(--navy);color:#fff;">
      <th style="padding:8px 10px;text-align:left;">#</th><th style="padding:8px 10px;text-align:left;">Investigator</th>
      <th style="padding:8px 10px;">Cases</th><th style="padding:8px 10px;">Completed</th>
      <th style="padding:8px 10px;">Avg Days</th><th style="padding:8px 10px;">Hardcopy%</th>
      <th style="padding:8px 10px;">Received%</th><th style="padding:8px 10px;">Score</th>
    </tr></thead><tbody>
    ${rows.map((r, i) => `<tr style="border-bottom:1px solid var(--line);${i % 2 ? 'background:var(--paper);' : ''}">
      <td style="padding:7px 10px;font-weight:700;color:${i === 0 ? 'var(--gold)' : 'var(--navy)'};">${i + 1}</td>
      <td style="padding:7px 10px;font-weight:600;">${r.name}</td>
      <td style="padding:7px 10px;text-align:center;">${r.cases}</td>
      <td style="padding:7px 10px;text-align:center;">${r.completed} (${r.completionPct}%)</td>
      <td style="padding:7px 10px;text-align:center;">${r.avgDays || '—'}</td>
      <td style="padding:7px 10px;text-align:center;">${r.hcPct}%</td>
      <td style="padding:7px 10px;text-align:center;">${r.receivedPct}%</td>
      <td style="padding:7px 10px;text-align:center;font-weight:800;color:${r.score >= 70 ? 'var(--green)' : r.score >= 50 ? 'var(--amber)' : 'var(--red)'};">${r.score}</td>
    </tr>`).join('')}
    </tbody></table>`;
  // Detail cards (top 8)
  document.getElementById('scorecard-detail').innerHTML = rows.slice(0, 8).map(r => `
    <div style="background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:10px 12px;margin-bottom:8px;font-size:12px;">
      <div style="font-weight:700;color:var(--navy);margin-bottom:4px;">${r.name} — Score <b style="color:${r.score >= 70 ? 'var(--green)' : r.score >= 50 ? 'var(--amber)' : 'var(--red)'};">${r.score}</b></div>
      <div style="color:var(--sub);">${r.cases} cases · ${r.completed} completed (${r.completionPct}%) · Avg ${r.avgDays || '—'} days to paid · Hardcopy ${r.hcPct}% · Received ₹${fmt(r.totalReceived)} / ₹${fmt(r.totalPayable)}</div>
    </div>`).join('');
}

function downloadScorecardCSV() {
  const month = document.getElementById('sc-month').value;
  const rows = computeScorecard(month);
  if (!rows.length) { showToast('No data to export.', true); return; }
  const header = 'Rank,Investigator,Cases,Completed,Completion%,AvgDaysToPaid,Hardcopy%,Received%,TotalPayable,TotalReceived,Score\n';
  const csv = rows.map((r, i) => [i + 1, r.name, r.cases, r.completed, r.completionPct, r.avgDays, r.hcPct, r.receivedPct, r.totalPayable, r.totalReceived, r.score].join(',')).join('\n');
  const blob = new Blob([header + csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `investigator-scorecard-${month}.csv`;
  a.click();
  showToast('Scorecard downloaded.');
}



function openBulkEdit() {
  if (selectedDocCodes.size === 0) { showToast('Select at least one case first.', true); return; }
  document.getElementById('bulkedit-summary').textContent = `${selectedDocCodes.size} case(s) selected. The change applies only to these.`;
  document.getElementById('bulkedit-field').value = bulkEditConfig ? bulkEditConfig.field : '';
  document.getElementById('bulkedit-value').value = '';
  onBulkEditFieldChange();
  document.getElementById('bulkedit-count-text').textContent = `${selectedDocCodes.size} Cases Selected`;
  document.getElementById('bulkedit-modal').classList.add('open');
}

function onBulkEditFieldChange() {
  const field = document.getElementById('bulkedit-field').value;
  const selectWrap = document.getElementById('bulkedit-select-wrap');
  const valueWrap = document.getElementById('bulkedit-value-wrap');
  const sel = document.getElementById('bulkedit-select');
  if (!field) { selectWrap.style.display = 'none'; valueWrap.style.display = 'block'; return; }
  const options = {
    inv1_status: ['', 'Paid', 'Pending'],
    inv2_status: ['', 'Paid', 'Pending'],
    hardcopy1_status: ['', 'Received', 'Not Received'],
    hardcopy2_status: ['', 'Received', 'Not Received'],
    outcome: ['Pending', 'Genuine', 'Fraud', 'Suspicious', 'Not Found', 'Settled'],
  };
  if (options[field]) {
    sel.innerHTML = options[field].map(o => `<option value="${escAttr(o)}">${o || '— Not set —'}</option>`).join('');
    selectWrap.style.display = 'block';
    valueWrap.style.display = 'none';
  } else {
    selectWrap.style.display = 'none';
    valueWrap.style.display = 'block';
  }
}

async function applyBulkEdit() {
  const field = document.getElementById('bulkedit-field').value;
  if (!field) { showToast('Select a field to edit.', true); return; }
  const selectWrap = document.getElementById('bulkedit-select-wrap');
  const useSelect = selectWrap.style.display === 'block';
  let newVal;
  if (useSelect) {
    newVal = document.getElementById('bulkedit-select').value;
  } else {
    newVal = document.getElementById('bulkedit-value').value;
  }
  // numeric fields need a value
  const numericFields = ['fee1','fee2','ta1','ta2','received'];
  if (numericFields.includes(field) && (newVal === '' || newVal === null)) {
    showToast('Enter a value for the amount field.', true); return;
  }
  if (newVal === '') { showToast('Enter a value to apply.', true); return; }
  const docCodes = Array.from(selectedDocCodes);
  if (!confirm(`Apply "${field}" = "${newVal}" to ${docCodes.length} selected case(s)?`)) return;
  const update = {};
  update[field] = numericFields.includes(field) ? parseFloat(newVal) : newVal;
  if (Number.isNaN(update[field])) { showToast('Invalid number value.', true); return; }
  const applyBtn = document.querySelector('#bulkedit-modal .modal-foot .btn-navy');
  if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = 'Applying…'; }
  try {
    const { data: updateData, error: updateErr } = await supabaseClient.from('cases').update(update).in('doc_code', docCodes).select('id');
    if (updateErr) throw updateErr;
    if (!updateData || updateData.length === 0) throw new Error("Bulk edit blocked by database permissions (RLS). Please ensure you have the 'admin' role.");
    bulkEditConfig = { field };
    closeModal('bulkedit-modal');
    await loadCasesFromDB();
    renderAll();
    showToast(`Updated ${docCodes.length} case(s).`);
  } catch (err) {
    showToast('Bulk edit failed: ' + err.message, true);
  } finally {
    if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Apply to All Selected'; }
  }
}

async function bulkDeleteSelected() {
  const n = selectedDocCodes.size;
  if (!n) return;
  if (!confirm(`Delete ${n} selected case(s)? You can restore them anytime using Rollback Log.`)) return;

  const docCodes = Array.from(selectedDocCodes);
  if (typeof recordBatchSnapshot === 'function') {
    recordBatchSnapshot({
      action: `Bulk Delete: removed ${n} cases`,
      type: 'delete',
      docCodes
    });
  }

  try {
    await deleteCasesDB(docCodes);
  } catch (err) {
    showToast('Delete failed: ' + err.message, true);
    return;
  }
  selectedDocCodes.clear();
  await loadCasesFromDB();
  renderAll();
  checkOverdueAlerts();
  if (window.logActivity) window.logActivity('Cases', `bulk deleted ${n} cases`);
  showToast(`${n} case(s) deleted. (Undo available in Rollback Log)`);
}

// ============================================================
// INVESTIGATORS
// ============================================================
let filterInvTimer = null;
function filterInvestigators() {
  clearTimeout(filterInvTimer);
  filterInvTimer = setTimeout(() => {
    executeFilterInvestigators();
  }, 250);
}
function executeFilterInvestigators() { 
  // Function logic removed, handled by new investigator 360 UI. 
  // Empty stub to prevent errors from other parts of the code.
}

// ============================================================
// INVESTIGATOR 360° VIEW (button on each card)
// Opens the full 360° profile drawer from the investigator-360
// module. Loads the module on demand if it isn't available yet.
// ============================================================
function ensureInvestigator360ModuleLoaded() {
  if (window.openInvestigator360) return Promise.resolve();
  const hasJs = Array.from(document.querySelectorAll('script')).some(s => (s.src || '').includes('investigator-360.js'));
  const hasCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l => (l.href || '').includes('investigator-360.css'));
  if (hasJs && hasCss) return new Promise(r => setTimeout(r, 400)); // module present, just not ready — give it a beat
  return new Promise(resolve => {
    const assets = [
      ['link',   'dna-inv360-fallback-css',        'frontend/investigator-360/investigator-360.css'],
      ['script', 'dna-inv360-fallback-js',         'frontend/investigator-360/investigator-360.js'],
      ['link',   'dna-inv360-fallback-case-css',   'frontend/investigator-360/investigator-case-breakdown.css'],
      ['script', 'dna-inv360-fallback-case-js',    'frontend/investigator-360/investigator-case-breakdown.js'],
    ];
    const job = ([tag, id, src]) => new Promise(done => {
      if (document.getElementById(id)) return done();
      const el = document.createElement(tag);
      el.id = id;
      if (tag === 'link') { el.rel = 'stylesheet'; el.href = src; el.onload = done; el.onerror = done; }
      else { el.src = src; el.onload = done; el.onerror = done; }
      document.head.appendChild(el);
    });
    Promise.all(assets.map(job)).then(() => setTimeout(resolve, 400));
  });
}

async function openInvestigator360ByName(name) {
  const row = (investigatorRows || []).find(r => (r.name || '').toLowerCase() === (name || '').toLowerCase()) ||
              (investigatorRows || []).find(r => (r.name || '') === (name || ''));
  const id = row && row.id;
  if (!id) { showToast('Investigator record not found.', true); return; }
  await ensureInvestigator360ModuleLoaded();
  if (!window.openInvestigator360) { showToast('360° view is unavailable right now. Please reload.', true); return; }

  // --- PHASE 3: PERFORMANCE 360 ENGINE HOOK ---
  if (!window._openInvestigator360Hooked) {
      window._openInvestigator360Hooked = true;
      const originalOpen360 = window.openInvestigator360;
      window.openInvestigator360 = async function(targetId) {
          await originalOpen360(targetId);
          setTimeout(() => {
              const drawer = document.getElementById('inv360-drawer');
              if (!drawer || drawer.querySelector('#inv360-perf-score')) return;
              const inv = investigatorRows.find(r => r.id === targetId);
              if (!inv) return;
              const myCases = cases.filter(c => c.inv1 === inv.name || c.inv2 === inv.name);
              const totalAssigned = myCases.length;
              let qualityScore = 100, completedCount = 0;
              myCases.forEach(c => {
                  if ((c.inv1 === inv.name && c.inv1_status === 'Paid') || (c.inv2 === inv.name && c.inv2_status === 'Paid')) completedCount++;
              });
              if (totalAssigned > 0) qualityScore = (completedCount / totalAssigned) * 100;
              let slaScore = 100, overdueCount = 0;
              let tatSum = 0, tatCount = 0;
              const now = new Date();
              myCases.forEach(c => {
                  if (c.completed_at && c.date) {
                      const ms = new Date(c.completed_at) - new Date(c.date);
                      if (ms >= 0) { tatSum += ms; tatCount++; }
                  }
                  if (c.due_date && !c.completed_at && new Date(c.due_date) < now) overdueCount++;
              });
              const avgTatHrs = tatCount > 0 ? (tatSum / tatCount / (1000 * 60 * 60)).toFixed(1) : 0;
              if (totalAssigned > 0) slaScore = Math.max(0, 100 - ((overdueCount / totalAssigned) * 100 * 2));
              let prodScore = totalAssigned > 0 ? Math.min(100, (completedCount / 10) * 100) : 50;
              let docScore = 100, hardcopyMissing = 0;
              myCases.forEach(c => {
                  if ((c.inv1 === inv.name && c.hardcopy1_status === 'Not Received') || (c.inv2 === inv.name && c.hardcopy2_status === 'Not Received')) hardcopyMissing++;
              });
              if (totalAssigned > 0) docScore = Math.max(0, 100 - ((hardcopyMissing / totalAssigned) * 100));
              const finalScore = Math.round((qualityScore * 0.4) + (slaScore * 0.3) + (prodScore * 0.2) + (docScore * 0.1));
              let rank = 'Active', color = 'var(--sub)';
              if (finalScore >= 90) { rank = 'Elite'; color = 'var(--gold)'; }
              else if (finalScore >= 75) { rank = 'Pro'; color = 'var(--navy)'; }
              const capacityRemaining = inv.max_active_cases ? Math.max(0, inv.max_active_cases - (totalAssigned - completedCount)) : 'N/A';
              const html = `
              <div id="inv360-perf-score" class="inv360-section" style="background:var(--card); padding:16px; border-radius:10px; border:1px solid var(--line); margin-top:16px; margin-bottom:16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                  <h3 style="margin-top:0; font-size:11.5px; text-transform:uppercase; color:var(--sub); letter-spacing:1px; margin-bottom:14px;">Performance 360 Score</h3>
                  <div style="display:flex; align-items:center; gap:20px;">
                      <div style="position:relative; width:80px; height:80px; border-radius:50%; background:conic-gradient(${color} ${finalScore}%, var(--line) 0); display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                          <div style="position:absolute; inset:6px; background:var(--card); border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                              <b style="font-size:24px; color:${color}; font-family:var(--mono);">${finalScore}</b>
                          </div>
                      </div>
                      <div style="flex:1;">
                          <div style="font-size:16px; font-weight:800; color:${color}; margin-bottom:6px; letter-spacing:0.5px; text-transform:uppercase;">★ ${rank}</div>
                          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:11px; color:var(--ink);">
                              <div>Quality: <b style="color:var(--navy);">${Math.round(qualityScore)}%</b></div>
                              <div>SLA Score: <b style="color:var(--navy);">${Math.round(slaScore)}%</b></div>
                              <div>Productivity: <b style="color:var(--navy);">${Math.round(prodScore)}%</b></div>
                              <div>Doc Accuracy: <b style="color:var(--navy);">${Math.round(docScore)}%</b></div>
                              <div>Avg TAT: <b style="color:var(--navy);">${avgTatHrs}h</b></div>
                              <div>Capacity: <b style="color:var(--navy);">${capacityRemaining}</b></div>
                          </div>
                      </div>
                  </div>
              </div>
              `;
              const targetSection = drawer.querySelector('.inv360-sheet-head');
              if (targetSection && targetSection.nextElementSibling) targetSection.nextElementSibling.insertAdjacentHTML('afterend', html);
          }, 100);
      };
  }
  // ---------------------------------------------

  // Retry briefly — the module loads its row cache asynchronously, and the
  // drawer should be visibly open before we give up.
  for (let i = 0; i < 12; i++) {
    try {
      window.openInvestigator360(id);
      const drawer = document.getElementById('inv360-drawer');
      if (drawer && drawer.classList.contains('open')) {
        // Drawer is now a fixed overlay with its own scroll (CSS in index.html).
        // The profile() function inside investigator-360.js already resets drawer.scrollTop=0.
        window.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }
    } catch (err) { /* module still initialising — retry */ }
    await new Promise(r => setTimeout(r, 250));
  }
  showToast('Could not open the 360° view. Please try again.', true);
}

// ============================================================
// 360° VIEW HELPERS (called from investigator-360.js)
// ============================================================
function inv360Edit(id) {
  const inv = investigatorRows.find(r => r.id === id);
  if (!inv) return;
  // Reuse the existing add/edit investigator modal but pre-fill
  openAddInvestigator(inv); // needs to support editing
}

async function editInvestigatorPhone(name) {
  const current = INVESTIGATOR_PHONES[name] || '';
  const val = prompt(`WhatsApp number for ${name}\n(Include country code, e.g. 91XXXXXXXXXX — no spaces or +)`, current);
  if (val === null) return; // cancelled
  const cleaned = val.replace(/[^\d]/g, '');
  try {
    await updateInvestigatorPhoneDB(name, cleaned || null);
  } catch (err) {
    showToast('Failed to save number: ' + err.message, true);
    return;
  }
  showToast(cleaned ? 'Number saved.' : 'Number removed.');
  await loadInvestigatorsFromDB();
  filterInvestigators();
}

function computeInvStats(name, caseList) {
  const myCases = caseList.filter(c => c.inv1===name || c.inv2===name);
  const invRow = investigatorRows.find(r => r.name === name);
  const isSalary = invRow && invRow.payment_type === 'Salary';
  const typeChangedAt = invRow && invRow.payment_type_changed_at ? new Date(invRow.payment_type_changed_at) : null;

  let totalCases=0, paidCases=0, totalPayable=0, paidAmt=0;
  myCases.forEach(c => {
    if (c.exception_type === 'Withdrawn') return; 
    
    const caseDate = c.date ? new Date(c.date) : (c.created_at ? new Date(c.created_at) : new Date());
    const isActuallySalary = isSalary && (!typeChangedAt || caseDate >= typeChangedAt);

    const both = c.inv1===name && c.inv2===name;
    const onlyAsInv1 = c.inv1===name && c.inv2!==name;
    const onlyAsInv2 = c.inv2===name && c.inv1!==name;

    if (both) totalCases += 1;
    else if (onlyAsInv1 || onlyAsInv2) totalCases += 0.5;

    if (!isActuallySalary) {
      if (both && c.inv1_status==='Paid' && c.inv2_status==='Paid') paidCases += 1;
      else if (onlyAsInv1 && c.inv1_status==='Paid') paidCases += 0.5;
      else if (onlyAsInv2 && c.inv2_status==='Paid') paidCases += 0.5;

      if (c.inv1===name) { totalPayable += (c.fee1||0)+(c.ta1||0); if (c.inv1_status==='Paid') paidAmt += (c.fee1||0)+(c.ta1||0); }
      if (c.inv2===name) { totalPayable += (c.fee2||0)+(c.ta2||0); if (c.inv2_status==='Paid') paidAmt += (c.fee2||0)+(c.ta2||0); }
    }
  });
  return {
    totalCases: round1(totalCases), paidCases: round1(paidCases),
    pendingCases: round1(totalCases-paidCases),
    totalPayable, paidAmt, pendingAmt: totalPayable-paidAmt
  };
}
function round1(n){ return Math.round(n*10)/10; }

// ============================================================
// BULK PAYMENT
// ============================================================
function openBulkPayment() {
  const invSel = document.getElementById('bp-investigator');
  invSel.innerHTML = '<option value="">-- Select --</option>' + INVESTIGATORS.map(i => `<option>${escAttr(i)}</option>`).join('');
  const ctSel = document.getElementById('bp-casetype');
  ctSel.innerHTML = '<option value="">All Types</option>' + CASE_TYPES.map(t => `<option>${escAttr(t)}</option>`).join('');
  document.getElementById('bp-status').value = 'unpaid';
  document.getElementById('bp-list').innerHTML = '';
  document.getElementById('bp-summary').innerHTML = '';
  document.getElementById('bulkpay-modal').classList.add('open');
}

function updateBulkPayCount() {
  const rowEls = document.querySelectorAll('#bp-list tr[data-doccode]');
  let count = 0;
  rowEls.forEach(tr => {
    if (tr.dataset.salary === 'true' || tr.querySelector('.bp-paid').checked || parseFloat(tr.querySelector('.bp-fee').value) > 0 || parseFloat(tr.querySelector('.bp-ta').value) > 0) count++;
  });
  const el = document.getElementById('bulkpay-count-text');
  if (el) el.textContent = `${count} of ${rowEls.length} Cases Pending Update`;
}

function renderBulkPaymentList() {
  const name = document.getElementById('bp-investigator').value;
  const caseType = document.getElementById('bp-casetype').value;
  const statusFilter = document.getElementById('bp-status').value;
  const listEl = document.getElementById('bp-list');
  const summaryEl = document.getElementById('bp-summary');

  if (!name) { listEl.innerHTML = ''; summaryEl.innerHTML = ''; document.getElementById('bp-quickfill').style.display='none'; return; }

  let rows = cases.filter(c => c.inv1===name || c.inv2===name);
  if (caseType) rows = rows.filter(c => c.case_type === caseType);
  rows = rows.filter(c => {
    const role = c.inv1===name ? 1 : 2;
    const st = role===1 ? c.inv1_status : c.inv2_status;
    return statusFilter==='all' ? true : st !== 'Paid';
  });
  rows.sort((a,b) => (a.case_type||'').localeCompare(b.case_type||'') || (a.date||'').localeCompare(b.date||''));

  if (!rows.length) {
    listEl.innerHTML = '<div class="empty-state">No matching cases for this investigator.</div>';
    updateBulkPayCount();
    summaryEl.innerHTML = '';
    document.getElementById('bp-quickfill').style.display = 'none';
    return;
  }
  document.getElementById('bp-quickfill').style.display = 'block';
  document.getElementById('bp-quick-fee').value = '';
  document.getElementById('bp-quick-ta').value = '';
  document.getElementById('bp-quick-paid').checked = false;

  // Group by case type for a clean grouped view
  const groups = {};
  rows.forEach(c => { const k = c.case_type||'(No Type)'; (groups[k] = groups[k]||[]).push(c); });

  const invRow = investigatorRows.find(r => r.name === name);
  const isSalary = invRow && invRow.payment_type === 'Salary';
  const typeChangedAt = invRow && invRow.payment_type_changed_at ? new Date(invRow.payment_type_changed_at) : null;

  summaryEl.innerHTML = `<div class="notice" style="background:var(--light-blue,#D6E4F0);border-left-color:var(--navy);color:var(--navy);">
    <b>${rows.length}</b> case(s) for <b>${name}</b>. ${isSalary ? '<br><span style="color:var(--red)">NOTE: This investigator is currently on Salary. Individual case fees are disabled for cases assigned after their salary start date.</span>' : ''}
  </div>`;

  let html = '';
  Object.keys(groups).forEach(caseType => {
    html += `<div style="font-weight:700;color:var(--navy);font-size:11px;text-transform:uppercase;margin:14px 0 6px;padding-bottom:4px;border-bottom:2px solid var(--gold);">${caseType} (${groups[caseType].length})</div>`;
    html += `<table style="width:100%;margin-bottom:6px;"><thead><tr>
      <th>Doc Code</th><th>Date</th><th>Claim No</th><th>Insured</th><th>Role</th><th>Fee (₹)</th><th>TA (₹)</th><th>Mark Paid</th>
    </tr></thead><tbody>`;
    groups[caseType].forEach(c => {
      const caseDate = c.date ? new Date(c.date) : (c.created_at ? new Date(c.created_at) : new Date());
      const isActuallySalary = isSalary && (!typeChangedAt || caseDate >= typeChangedAt);

      const role = c.inv1===name ? 1 : 2;
      const otherInv = role===1 ? c.inv2 : c.inv1;
      const otherIsBlank = !otherInv || otherInv==='NA';
      const otherIsSameName = otherInv === name;
      let badgeLabel, badgeClass;
      if (otherIsBlank) { badgeLabel = 'Half (0.5)'; badgeClass = 'pending'; }
      else if (otherIsSameName) { badgeLabel = 'Full (1) — solo, both slots'; badgeClass = 'paid'; }
      else { badgeLabel = 'Half (0.5) — shared w/ '+otherInv; badgeClass = 'na'; }
      const existingFee = role===1 ? c.fee1 : c.fee2;
      const existingTa = role===1 ? c.ta1 : c.ta2;
      const existingStatus = role===1 ? c.inv1_status : c.inv2_status;
      html += `<tr data-doccode="${c.doc_code||''}" data-role="${role}" data-salary="${isActuallySalary}">
        <td class="mono">${c.doc_code||''}</td>
        <td>${c.date||''}</td>
        <td class="mono">${c.claim_no||''}</td>
        <td>${c.insured_name||''}</td>
        <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
        <td><input type="number" class="fin bp-fee" style="width:80px;" value="${isActuallySalary ? 0 : (existingFee||'')}" ${isActuallySalary?'disabled':''} placeholder="${isActuallySalary?'Salary':'0'}"></td>
        <td><input type="number" class="fin bp-ta" style="width:70px;" value="${existingTa||''}" placeholder="0"></td>
        <td><input type="checkbox" class="bp-paid" ${existingStatus==='Paid' || isActuallySalary ?'checked':''} ${isActuallySalary?'disabled':''}></td>
      </tr>`;
    });
    html += `</tbody></table>`;
  });
  listEl.innerHTML = html;
}

function applyQuickFill() {
  const fee = document.getElementById('bp-quick-fee').value;
  const ta = document.getElementById('bp-quick-ta').value;
  const markPaid = document.getElementById('bp-quick-paid').checked;
  const caseType = document.getElementById('bp-casetype').value;

  if (fee==='' && ta==='' && !markPaid) { showToast('Enter an amount or tick Mark Paid first.', true); return; }

  const rowEls = document.querySelectorAll('#bp-list tr[data-doccode]');
  if (!rowEls.length) return;

  if (!caseType && !confirm(`No case type selected — this will apply the same amount to ALL ${rowEls.length} case(s) shown, across every case type. Continue?`)) {
    return;
  }

  rowEls.forEach(tr => {
    if (fee !== '') tr.querySelector('.bp-fee').value = fee;
    if (ta !== '') tr.querySelector('.bp-ta').value = ta;
    if (markPaid) tr.querySelector('.bp-paid').checked = true;
  });
  showToast(`Applied to ${rowEls.length} case(s) below — review, then click "Save All Payments".`);
}

async function saveBulkPayment() {
  const name = document.getElementById('bp-investigator').value;
  if (!name) { showToast('Select an investigator first.', true); return; }
  const rows = document.querySelectorAll('#bp-list tr[data-doccode]');
  if (!rows.length) { showToast('No cases to update.', true); return; }

  const btn = document.querySelector('#bulkpay-modal .modal-foot .btn-navy');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const updates = [];
  rows.forEach(tr => {
    const docCode = tr.dataset.doccode;
    const role = parseInt(tr.dataset.role);
    const isActuallySalary = tr.dataset.salary === 'true';
    const fee = isActuallySalary ? 0 : (parseFloat(tr.querySelector('.bp-fee').value) || 0);
    const ta = parseFloat(tr.querySelector('.bp-ta').value) || 0;
    const paid = isActuallySalary ? true : tr.querySelector('.bp-paid').checked;
    const fields = role===1
      ? { fee1: fee, ta1: ta, inv1_status: paid ? 'Paid' : 'Pending' }
      : { fee2: fee, ta2: ta, inv2_status: paid ? 'Paid' : 'Pending' };
    updates.push({ doc_code: docCode, fields });
  });

  const docCodes = updates.map(u => u.doc_code);
  if (typeof recordBatchSnapshot === 'function' && docCodes.length) {
    recordBatchSnapshot({
      action: `Bulk Payment: recorded payments for ${updates.length} case(s) (${name})`,
      type: 'update',
      docCodes
    });
  }

  try {
    // Each row can have different field values, so this has to be one
    // update call per row rather than a single batch update.
    await Promise.all(updates.map(u => updateCaseDB(u.doc_code, u.fields)));
  } catch (err) {
    showToast('Save failed: ' + err.message, true);
    if (btn) { btn.disabled = false; btn.textContent = 'Save All Payments'; }
    return;
  }

  await loadCasesFromDB();
  if (btn) { btn.disabled = false; btn.textContent = 'Save All Payments'; }
  renderAll();
  checkOverdueAlerts();
  closeModal('bulkpay-modal');
  if (window.logActivity) window.logActivity('Cases', `bulk processed payments for ${updates.length} cases for ${name}`);
  showToast(`Updated ${updates.length} case(s) for ${name}. (Undo available in Rollback Log)`);
}

// ============================================================
// MONTHLY
// ============================================================
function renderMonthButtons() {
  const c = document.getElementById('month-buttons');
  const available = getAvailableMonths();
  if (!available.length) {
    c.innerHTML = `<div class="empty-state" style="padding:20px;">No dated cases yet — add a case to see it here.</div>`;
    return;
  }
  // Group by financial year so the selector stays organized regardless of
  // how many years of data exist, instead of one long flat row.
  const groups = {};
  available.forEach(mo => {
    const fyStart = mo.m >= 4 ? mo.y : mo.y - 1;
    const key = `FY ${fyStart}-${String(fyStart+1).slice(-2)}`;
    (groups[key] = groups[key] || []).push(mo);
  });
  const orderedKeys = Object.keys(groups).sort((a,b) => {
    const ay = parseInt(a.match(/\d{4}/)[0]), by = parseInt(b.match(/\d{4}/)[0]);
    return by - ay; // most recent FY first
  });
  c.innerHTML = orderedKeys.map(key => `
    <div class="month-fy-group">
      <div class="month-fy-label">${key}</div>
      <div class="month-pill-row">
        ${groups[key].map(mo => {
          const i = MONTHS.indexOf(mo);
          return `<button class="month-pill ${i===activeMonth?'active':''}" onclick="selectMonth(${i})">${mo.label.split(' ')[0].slice(0,3)} ${mo.y}</button>`;
        }).join('')}
      </div>
    </div>`).join('');
}
function selectMonth(i) { activeMonth = i; renderMonthButtons(); renderMonthly(i); }

// ============================================================
// INVESTIGATOR EXPENSES & VOUCHER LEDGER
// ============================================================
async function loadInvestigatorExpensesDB() {
  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('investigator_expenses')
        .select('*')
        .order('date', { ascending: false });
      if (!error && data) {
        investigatorExpenses = data.map(r => ({ ...r, amount: Number(r.amount) || 0 }));
        window.investigatorExpenses = investigatorExpenses;
        localStorage.setItem('DNA_INVESTIGATOR_EXPENSES', JSON.stringify(investigatorExpenses));
        return;
      }
    }
  } catch (err) {
    console.warn('[EXPENSES] DB load failed, using local cache:', err);
  }
  const cached = localStorage.getItem('DNA_INVESTIGATOR_EXPENSES');
  if (cached) {
    try {
      investigatorExpenses = JSON.parse(cached).map(r => ({ ...r, amount: Number(r.amount) || 0 }));
      window.investigatorExpenses = investigatorExpenses;
    } catch (e) {
      investigatorExpenses = [];
    }
  }
}

async function saveInvestigatorExpenseDB(exp) {
  const id = exp.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
  const record = {
    id,
    investigator_name: exp.investigator_name,
    category: exp.category,
    amount: Number(exp.amount) || 0,
    date: exp.date,
    month_code: exp.month_code,
    status: exp.status || 'Pending',
    remarks: exp.remarks || '',
    created_at: exp.created_at || new Date().toISOString(),
    created_by: currentUser?.email || 'Admin'
  };

  const existingIdx = investigatorExpenses.findIndex(e => e.id === id);
  if (existingIdx >= 0) {
    investigatorExpenses[existingIdx] = record;
  } else {
    investigatorExpenses.unshift(record);
  }
  window.investigatorExpenses = investigatorExpenses;
  localStorage.setItem('DNA_INVESTIGATOR_EXPENSES', JSON.stringify(investigatorExpenses));

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('investigator_expenses').upsert(record);
      if (error) console.warn('[EXPENSES] Supabase upsert error:', error.message);
    }
  } catch (e) {
    console.warn('[EXPENSES] Supabase error:', e);
  }
  return record;
}

async function deleteInvestigatorExpenseDB(id) {
  investigatorExpenses = investigatorExpenses.filter(e => e.id !== id);
  window.investigatorExpenses = investigatorExpenses;
  localStorage.setItem('DNA_INVESTIGATOR_EXPENSES', JSON.stringify(investigatorExpenses));
  try {
    if (supabaseClient) {
      await supabaseClient.from('investigator_expenses').delete().eq('id', id);
    }
  } catch (e) {
    console.warn('[EXPENSES] Supabase delete error:', e);
  }
}

async function toggleExpenseStatusDB(id) {
  const exp = investigatorExpenses.find(e => e.id === id);
  if (!exp) return;
  exp.status = exp.status === 'Paid' ? 'Pending' : 'Paid';
  window.investigatorExpenses = investigatorExpenses;
  localStorage.setItem('DNA_INVESTIGATOR_EXPENSES', JSON.stringify(investigatorExpenses));
  try {
    if (supabaseClient) {
      await supabaseClient.from('investigator_expenses').update({ status: exp.status }).eq('id', id);
    }
  } catch (e) {
    console.warn('[EXPENSES] Supabase update error:', e);
  }
}

function getExpensesForMonth(mo) {
  if (!mo) return [];
  return investigatorExpenses.filter(e => {
    if (e.month_code && e.month_code === mo.code) return true;
    if (e.date) {
      const d = new Date(e.date);
      if (!isNaN(d.getTime())) {
        return (d.getMonth() + 1) === mo.m && d.getFullYear() === mo.y;
      }
    }
    return false;
  });
}

function openAddExpenseModal(defaultInv = '', defaultMonthIdx = null) {
  const selInv = document.getElementById('exp-inv');
  if (selInv) {
    selInv.innerHTML = '<option value="">-- Select Investigator --</option>' + INVESTIGATORS.map(n => `<option value="${escAttr(n)}">${escAttr(n)}</option>`).join('');
    if (defaultInv) selInv.value = defaultInv;
  }
  const idEl = document.getElementById('exp-id');
  if (idEl) idEl.value = '';
  const titleEl = document.getElementById('exp-modal-title');
  if (titleEl) titleEl.textContent = '💵 Add Expense / Voucher';
  const amtEl = document.getElementById('exp-amount');
  if (amtEl) amtEl.value = '';
  const remEl = document.getElementById('exp-remarks');
  if (remEl) remEl.value = '';
  const catEl = document.getElementById('exp-category');
  if (catEl) catEl.value = 'Courier / Hardcopy';
  const stEl = document.getElementById('exp-status');
  if (stEl) stEl.value = 'Pending';
  
  const dateInput = document.getElementById('exp-date');
  if (dateInput) {
    if (defaultMonthIdx !== null && MONTHS[defaultMonthIdx]) {
      const mo = MONTHS[defaultMonthIdx];
      const now = new Date();
      const day = (now.getMonth() + 1 === mo.m && now.getFullYear() === mo.y) ? String(now.getDate()).padStart(2, '0') : '15';
      dateInput.value = `${mo.y}-${String(mo.m).padStart(2, '0')}-${day}`;
    } else {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
  }
  const modal = document.getElementById('expense-modal');
  if (modal) modal.classList.add('open');
}

function editExpenseVoucher(id) {
  const exp = investigatorExpenses.find(e => e.id === id);
  if (!exp) return;
  openAddExpenseModal(exp.investigator_name);
  const idEl = document.getElementById('exp-id');
  if (idEl) idEl.value = exp.id;
  const titleEl = document.getElementById('exp-modal-title');
  if (titleEl) titleEl.textContent = '✏️ Edit Expense / Voucher';
  const catEl = document.getElementById('exp-category');
  if (catEl) catEl.value = exp.category || 'Courier / Hardcopy';
  const amtEl = document.getElementById('exp-amount');
  if (amtEl) amtEl.value = exp.amount || '';
  const dtEl = document.getElementById('exp-date');
  if (dtEl) dtEl.value = exp.date || new Date().toISOString().slice(0, 10);
  const stEl = document.getElementById('exp-status');
  if (stEl) stEl.value = exp.status || 'Pending';
  const remEl = document.getElementById('exp-remarks');
  if (remEl) remEl.value = exp.remarks || '';
}

async function saveExpenseVoucher() {
  const id = document.getElementById('exp-id').value.trim();
  const inv = document.getElementById('exp-inv').value;
  const category = document.getElementById('exp-category').value;
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const date = document.getElementById('exp-date').value;
  const status = document.getElementById('exp-status').value;
  const remarks = document.getElementById('exp-remarks').value.trim();

  if (!inv) {
    showToast('Please select an investigator', true);
    return;
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid amount', true);
    return;
  }
  if (!date) {
    showToast('Please enter an expense date', true);
    return;
  }

  const d = new Date(date);
  const mo = MONTHS.find(m => m.m === (d.getMonth() + 1) && m.y === d.getFullYear());
  const month_code = mo ? mo.code : `${d.getMonth() + 1}-${d.getFullYear()}`;

  const payload = {
    id: id || undefined,
    investigator_name: inv,
    category,
    amount,
    date,
    month_code,
    status,
    remarks
  };

  const btn = document.getElementById('exp-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  await saveInvestigatorExpenseDB(payload);
  if (btn) { btn.disabled = false; btn.textContent = '💾 Save Voucher'; }
  closeModal('expense-modal');
  showToast(`Voucher of ₹${fmt(amount)} saved for ${inv}`);
  renderMonthly(activeMonth);
  renderSalary();
  if (document.getElementById('expense-ledger-modal').classList.contains('open')) {
    renderExpenseLedgerTable();
  }
}

function openExpenseLedgerModal(filterInv = '') {
  const mSel = document.getElementById('ledger-filter-month');
  if (mSel) {
    const available = getAvailableMonths();
    mSel.innerHTML = '<option value="ALL">All Months</option>' + available.map((mo) => {
      const idx = MONTHS.indexOf(mo);
      return `<option value="${idx}" ${idx === activeMonth ? 'selected' : ''}>${mo.label}</option>`;
    }).join('');
  }
  const iSel = document.getElementById('ledger-filter-inv');
  if (iSel) {
    iSel.innerHTML = '<option value="">All Investigators</option>' + INVESTIGATORS.map(n => `<option value="${escAttr(n)}" ${n === filterInv ? 'selected' : ''}>${escAttr(n)}</option>`).join('');
  }
  renderExpenseLedgerTable();
  document.getElementById('expense-ledger-modal').classList.add('open');
}

function renderExpenseLedgerTable() {
  const mVal = document.getElementById('ledger-filter-month')?.value || 'ALL';
  const iVal = document.getElementById('ledger-filter-inv')?.value || '';
  const cVal = document.getElementById('ledger-filter-cat')?.value || '';

  let list = [...investigatorExpenses];

  if (mVal !== 'ALL') {
    const mo = MONTHS[parseInt(mVal)];
    if (mo) {
      list = list.filter(e => {
        if (e.month_code === mo.code) return true;
        const d = new Date(e.date);
        return (d.getMonth() + 1) === mo.m && d.getFullYear() === mo.y;
      });
    }
  }

  if (iVal) {
    list = list.filter(e => e.investigator_name === iVal);
  }

  if (cVal) {
    list = list.filter(e => (e.category || '').toLowerCase().includes(cVal.toLowerCase()));
  }

  const totalAmt = list.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const paidAmt = list.filter(e => e.status === 'Paid').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const pendingAmt = list.filter(e => e.status !== 'Paid').reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const kpiEl = document.getElementById('ledger-kpi-summary');
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div style="flex:1;background:#fff;border:1px solid var(--line);border-radius:6px;padding:8px 12px;">
        <div style="font-size:10px;text-transform:uppercase;color:var(--sub);font-weight:700;">Total Vouchers</div>
        <div style="font-size:16px;font-weight:800;color:var(--navy);margin-top:2px;">${list.length} item(s) &bull; ₹${fmt(totalAmt)}</div>
      </div>
      <div style="flex:1;background:#fff;border:1px solid var(--line);border-radius:6px;padding:8px 12px;">
        <div style="font-size:10px;text-transform:uppercase;color:var(--sub);font-weight:700;">Paid Vouchers</div>
        <div style="font-size:16px;font-weight:800;color:var(--green);margin-top:2px;">₹${fmt(paidAmt)}</div>
      </div>
      <div style="flex:1;background:#fff;border:1px solid var(--line);border-radius:6px;padding:8px 12px;">
        <div style="font-size:10px;text-transform:uppercase;color:var(--sub);font-weight:700;">Pending Vouchers</div>
        <div style="font-size:16px;font-weight:800;color:var(--red);margin-top:2px;">₹${fmt(pendingAmt)}</div>
      </div>
    `;
  }

  const tbody = document.getElementById('expense-ledger-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="ic">🧾</div>No vouchers found for this filter</div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(e => {
    const isPaid = e.status === 'Paid';
    return `
      <tr style="border-bottom:1px solid var(--line);">
        <td style="padding:8px 10px;font-family:var(--mono);">${e.date || '—'}</td>
        <td style="padding:8px 10px;font-weight:700;color:var(--navy);">${escAttr(e.investigator_name)}</td>
        <td style="padding:8px 10px;"><span class="badge" style="background:#f1f5f9;color:#334155;font-weight:600;">${escAttr(e.category)}</span></td>
        <td style="padding:8px 10px;color:var(--sub);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escAttr(e.remarks||'')}">${escAttr(e.remarks || '—')}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;">₹${fmt(e.amount)}</td>
        <td style="padding:8px 10px;text-align:center;">
          <button class="badge ${isPaid ? 'paid' : 'pending'}" style="cursor:pointer;border:none;" onclick="toggleExpenseVoucherStatus('${e.id}')" title="Click to toggle status">
            ${isPaid ? '✓ Paid' : '⏳ Pending'}
          </button>
        </td>
        <td style="padding:8px 10px;text-align:center;">
          <div style="display:flex;gap:4px;justify-content:center;">
            <button class="btn btn-ghost btn-sm admin-only" style="padding:2px 6px;font-size:11px;" onclick="editExpenseVoucher('${e.id}')" title="Edit">✏️</button>
            <button class="btn btn-ghost btn-sm admin-only" style="padding:2px 6px;font-size:11px;color:var(--red);" onclick="deleteExpenseVoucher('${e.id}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleExpenseVoucherStatus(id) {
  await toggleExpenseStatusDB(id);
  renderExpenseLedgerTable();
  renderMonthly(activeMonth);
  renderSalary();
}

async function deleteExpenseVoucher(id) {
  if (!confirm('Are you sure you want to delete this voucher?')) return;
  await deleteInvestigatorExpenseDB(id);
  showToast('Voucher deleted');
  renderExpenseLedgerTable();
  renderMonthly(activeMonth);
  renderSalary();
}

function exportExpenseLedgerCSV() {
  const mVal = document.getElementById('ledger-filter-month')?.value || 'ALL';
  const iVal = document.getElementById('ledger-filter-inv')?.value || '';
  const cVal = document.getElementById('ledger-filter-cat')?.value || '';

  let list = [...investigatorExpenses];
  if (mVal !== 'ALL') {
    const mo = MONTHS[parseInt(mVal)];
    if (mo) {
      list = list.filter(e => {
        if (e.month_code === mo.code) return true;
        const d = new Date(e.date);
        return (d.getMonth() + 1) === mo.m && d.getFullYear() === mo.y;
      });
    }
  }
  if (iVal) list = list.filter(e => e.investigator_name === iVal);
  if (cVal) list = list.filter(e => (e.category || '').toLowerCase().includes(cVal.toLowerCase()));

  if (!list.length) { showToast('No data to export', true); return; }

  const headers = ['Date', 'Investigator', 'Category', 'Amount', 'Status', 'Remarks'];
  const csvRows = [headers.join(',')];
  list.forEach(e => {
    csvRows.push([
      `"${e.date || ''}"`,
      `"${(e.investigator_name || '').replace(/"/g, '""')}"`,
      `"${(e.category || '').replace(/"/g, '""')}"`,
      e.amount || 0,
      `"${e.status || 'Pending'}"`,
      `"${(e.remarks || '').replace(/"/g, '""')}"`
    ].join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DNA_Expenses_Vouchers_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderMonthly(idx) {
  const mo = MONTHS[idx];
  document.getElementById('monthly-title').textContent = `${mo.label} — Investigator Report`;

  const monthCases = getVisibleCases().filter(c => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y;
  });

  const monthExpenses = getExpensesForMonth(mo);
  const totalPayableM = monthCases.reduce((s,c)=>s+(c.total_payable||0),0);
  const totalReceivedM = monthCases.reduce((s,c)=>s+(c.received||0),0);
  const totalExpensesM = monthExpenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const totalNetPayableM = totalPayableM + totalExpensesM;
  const netAgencyProfitM = totalReceivedM - totalNetPayableM;

  document.getElementById('monthly-kpi').innerHTML = `
    <div class="kpi tab-kpi-enhanced">
      <div class="tab-kpi-icon" style="background:#e0f2fe; color:#0284c7;">📊</div>
      <div><div class="kpi-label">Cases This Month</div><div class="kpi-value">${monthCases.length}</div></div>
    </div>
    <div class="kpi tab-kpi-enhanced gold">
      <div class="tab-kpi-icon" style="background:#fef3c7; color:#d97706;">💸</div>
      <div><div class="kpi-label">Case Payable</div><div class="kpi-value gold">Rs ${fmt(totalPayableM)}</div></div>
    </div>
    <div class="kpi tab-kpi-enhanced" style="background:#f8fafc;border-left:3px solid #0284c7;">
      <div class="tab-kpi-icon" style="background:#e0f2fe; color:#0284c7;">📦</div>
      <div><div class="kpi-label">Extra Vouchers (Courier/Bonus)</div><div class="kpi-value" style="color:#0284c7;">Rs ${fmt(totalExpensesM)}</div></div>
    </div>
    <div class="kpi tab-kpi-enhanced" style="background:#fdf4ff;border-left:3px solid #a855f7;">
      <div class="tab-kpi-icon" style="background:#fae8ff; color:#a855f7;">💼</div>
      <div><div class="kpi-label">Net Investigator Payable</div><div class="kpi-value" style="color:#9333ea;">Rs ${fmt(totalNetPayableM)}</div></div>
    </div>
    <div class="kpi tab-kpi-enhanced green">
      <div class="tab-kpi-icon" style="background:#dcfce7; color:#15803d;">💰</div>
      <div><div class="kpi-label">Total Received</div><div class="kpi-value green">Rs ${fmt(totalReceivedM)}</div></div>
    </div>
    <div class="kpi tab-kpi-enhanced ${netAgencyProfitM>=0?'green':'red'}">
      <div class="tab-kpi-icon" style="background:${netAgencyProfitM>=0?'#dcfce7':'#fee2e2'}; color:${netAgencyProfitM>=0?'#15803d':'#be123c'};">${netAgencyProfitM>=0?'📈':'📉'}</div>
      <div><div class="kpi-label">Net Agency Margin</div><div class="kpi-value ${netAgencyProfitM>=0?'green':'red'}">Rs ${fmt(netAgencyProfitM)}</div></div>
    </div>
  `;

  let list = INVESTIGATORS;

  const tbody = document.getElementById('monthly-tbody');
  let __html = [];
  list.forEach(name => {
    const stats = computeInvStats(name, monthCases);
    const invExp = monthExpenses.filter(e => e.investigator_name === name);
    const invExpTotal = invExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const invExpPaid = invExp.filter(e => e.status === 'Paid').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const invExpPending = invExp.filter(e => e.status !== 'Paid').reduce((s, e) => s + (Number(e.amount) || 0), 0);

    if (stats.totalCases === 0 && invExpTotal === 0) return;

    const netPayable = stats.totalPayable + invExpTotal;
    const netPaidAmt = stats.paidAmt + invExpPaid;
    const netPendingAmt = stats.pendingAmt + invExpPending;

    const vouchersDisplay = invExpTotal > 0 
      ? `<span class="badge" style="background:#e0f2fe;color:#0284c7;cursor:pointer;font-weight:700;" onclick="openExpenseLedgerModal('${name.replace(/'/g, "\\'")}')" title="Click to view ${invExp.length} voucher(s)">+Rs ${fmt(invExpTotal)} (${invExp.length})</span>`
      : `<span style="color:var(--sub);font-size:11px;">—</span>`;

    __html.push(`<tr>
      <td><strong>${escAttr(name)}</strong></td>
      <td>${stats.totalCases}</td>
      <td style="color:var(--green)">${stats.paidCases}</td>
      <td style="color:var(--red)">${stats.pendingCases}</td>
      <td>Rs ${fmt(stats.totalPayable)}</td>
      <td>${vouchersDisplay}</td>
      <td><strong>Rs ${fmt(netPayable)}</strong></td>
      <td style="color:var(--green)">Rs ${fmt(netPaidAmt)}</td>
      <td style="color:var(--red)">Rs ${fmt(netPendingAmt)}</td>
      <td>
        <div style="display:flex;gap:4px;align-items:center;">
          ${currentUser ? `<button class="btn btn-ghost btn-sm" onclick="quickSlip('${name.replace(/'/g, "\\'")}',${idx})" title="Generate Statement">Slip</button>` : ''}
          ${currentUser ? `<button class="btn btn-gold btn-sm admin-only" style="padding:2px 6px;font-size:11px;" onclick="openAddExpenseModal('${name.replace(/'/g, "\\'")}',${idx})" title="Add Courier / Bonus Voucher">+💵</button>` : ''}
        </div>
      </td>
    </tr>`);
  });
  tbody.innerHTML = __html.join('');
  if (!tbody.innerHTML) tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="ic">📭</div>No cases or vouchers in ${mo.label} yet</div></td></tr>`;
}

// ============================================================
// SALARY MANAGEMENT
// ============================================================
function renderSalary() {
  const sel = document.getElementById('salary-month-select');
  if (!sel || !sel.options.length) {
    const available = getAvailableMonths();
    if (sel) sel.innerHTML = available.map((mo, i) => `<option value="${i}" ${i===activeMonth?'selected':''}>${mo.label}</option>`).join('');
  }
  if (!sel) return;
  
  const idx = parseInt(sel.value);
  const mo = MONTHS[idx];
  
  const monthCases = getVisibleCases().filter(c => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y;
  });

  const monthExpenses = getExpensesForMonth(mo);
  const salaryInvestigators = investigatorRows.filter(r => r.payment_type === 'Salary');
  const tbody = document.getElementById('salary-tbody');
  if (tbody) tbody.innerHTML = '';
  
  let totalExpense = 0;
  let totalSalariedCases = 0;
  let totalSalaryVouchers = 0;

  salaryInvestigators.forEach(r => {
    const typeChangedAt = r.payment_type_changed_at ? new Date(r.payment_type_changed_at) : null;
    const iCases = monthCases.filter(c => {
       const caseDate = c.date ? new Date(c.date) : (c.created_at ? new Date(c.created_at) : new Date());
       return (c.inv1 === r.name || c.inv2 === r.name) && (!typeChangedAt || caseDate >= typeChangedAt);
    });
    
    totalSalariedCases += iCases.length;

    // Count productivity (0.5 for half case, 1 for full)
    const productivity = iCases.reduce((sum, c) => {
        if (c.exception_type === 'Withdrawn') return sum;
        if (c.inv1 === r.name && c.inv2 === r.name) return sum + 1;
        return sum + 0.5;
    }, 0);

    const invExp = monthExpenses.filter(e => e.investigator_name === r.name);
    const invExpTotal = invExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    totalSalaryVouchers += invExpTotal;

    const salary = r.salary_amount || 0;
    const totalPayout = salary + invExpTotal;
    totalExpense += totalPayout;

    const voucherTag = invExpTotal > 0 
      ? ` <span class="badge" style="background:#e0f2fe;color:#0284c7;cursor:pointer;font-weight:700;" onclick="openExpenseLedgerModal('${r.name.replace(/'/g, "\\'")}')" title="Courier/Bonus vouchers">+₹${invExpTotal.toLocaleString('en-IN')} (${invExp.length})</span>`
      : '';

    if (tbody) tbody.innerHTML += `<tr>
      <td><strong>${escAttr(r.name)}</strong></td>
      <td>₹${salary.toLocaleString('en-IN')}${voucherTag}</td>
      <td>${productivity} case(s)</td>
      <td><strong>₹${totalPayout.toLocaleString('en-IN')}</strong></td>
    </tr>`;
  });

  const kpiEl = document.getElementById('salary-kpi');
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="kpi tab-kpi-enhanced" style="background-color: #ededed;">
        <div class="tab-kpi-icon" style="background: rgba(0,0,0,0.05); color: #191a1c;">👥</div>
        <div><div class="kpi-label" style="color: #191a1c;">Salaried Staff</div><div class="kpi-value" style="color: #191a1c;">${salaryInvestigators.length}</div></div>
      </div>
      <div class="kpi tab-kpi-enhanced gold" style="border-left-color: #e3e3e3; background-color: #e0efef;">
        <div class="tab-kpi-icon" style="background: rgba(0,0,0,0.05); color: #4e3232;">🗂️</div>
        <div><div class="kpi-label" style="color: #4e3232;">Total Cases (Salaried)</div><div class="kpi-value" style="color: #4e3232;">${totalSalariedCases}</div></div>
      </div>
      <div class="kpi tab-kpi-enhanced green" style="background-color: #ececed;">
        <div class="tab-kpi-icon" style="background: rgba(0,0,0,0.05); color: var(--green);">🏦</div>
        <div><div class="kpi-label">Monthly Staff Payout Budget</div><div class="kpi-value green">₹${totalExpense.toLocaleString('en-IN')}</div></div>
      </div>
    `;
  }

  if (tbody && !tbody.innerHTML) tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No salaried investigators found for this month.</div></td></tr>`;
}

// ============================================================
// YEARLY SUMMARY
// ============================================================
function renderYearly() {
  const fys = getAvailableFYs();
  if (activeFYStart === null) activeFYStart = fys[0] ? fys[0].startYear : null;
  const currentFY = fys.find(f => f.startYear === activeFYStart) || fys[0];
  const fyMonths = currentFY ? currentFY.months : [];

  // Year selector — replaces the old hardcoded "FY 2026-27" title
  const selEl = document.getElementById('yearly-fy-select');
  if (selEl) {
    selEl.innerHTML = fys.map(f => `<option value="${f.startYear}" ${f.startYear===activeFYStart?'selected':''}>${f.label}</option>`).join('');
  }
  const titleEl = document.getElementById('yearly-title');
  if (titleEl) titleEl.textContent = currentFY ? `📅 Yearly Summary — ${currentFY.label} (April ${currentFY.startYear} – March ${currentFY.startYear+1})` : '📅 Yearly Summary — No data yet';

  const yearCases = getVisibleCases().filter(c => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return fyMonths.some(m => (d.getMonth()+1)===m.m && d.getFullYear()===m.y);
  });

  const totalPayable = yearCases.reduce((s,c)=>s+(c.total_payable||0),0);
  const totalReceived = yearCases.reduce((s,c)=>s+(c.received||0),0);
  const totalProfit = totalReceived - totalPayable;

  document.getElementById('yearly-kpi').innerHTML = `
    <div class="kpi tab-kpi-enhanced">
      <div class="tab-kpi-icon" style="background:#e0f2fe; color:#0284c7;">📅</div>
      <div><div class="kpi-label">Total Cases (FY)</div><div class="kpi-value">${yearCases.length}</div></div>
    </div>
    <div class="kpi tab-kpi-enhanced gold">
      <div class="tab-kpi-icon" style="background:#fef3c7; color:#d97706;">💸</div>
      <div><div class="kpi-label">Total Payable (FY)</div><div class="kpi-value gold">Rs ${fmt(totalPayable)}</div></div>
    </div>
    <div class="kpi tab-kpi-enhanced green">
      <div class="tab-kpi-icon" style="background:#dcfce7; color:#15803d;">💰</div>
      <div><div class="kpi-label">Total Received (FY)</div><div class="kpi-value green">Rs ${fmt(totalReceived)}</div></div>
    </div>
    <div class="kpi tab-kpi-enhanced ${totalProfit>=0?'green':'red'}">
      <div class="tab-kpi-icon" style="background:${totalProfit>=0?'#dcfce7':'#fee2e2'}; color:${totalProfit>=0?'#15803d':'#be123c'};">${totalProfit>=0?'📈':'📉'}</div>
      <div><div class="kpi-label">Net Profit (FY)</div><div class="kpi-value ${totalProfit>=0?'green':'red'}">Rs ${fmt(totalProfit)}</div></div>
    </div>
  `;

  // Company wise
  const companyTbody = document.querySelector('#yearly-company-table tbody');
  companyTbody.innerHTML = '';
  let __yrCoHtml = [];
  COMPANIES.forEach(co => {
    const rows = yearCases.filter(c => c.company === co);
    if (!rows.length) return;
    const payable = rows.reduce((s,c)=>s+(c.total_payable||0),0);
    const received = rows.reduce((s,c)=>s+(c.received||0),0);
    __yrCoHtml.push(`<tr><td><strong>${escAttr(co)}</strong></td><td>${rows.length}</td><td>Rs ${fmt(payable)}</td><td>Rs ${fmt(received)}</td></tr>`);
  });
  companyTbody.innerHTML = __yrCoHtml.join('');
  if (!companyTbody.innerHTML) companyTbody.innerHTML = '<tr><td colspan="4" class="empty-state">No data yet</td></tr>';

  // Investigator wise
  const invTbody = document.querySelector('#yearly-inv-table tbody');
  invTbody.innerHTML = '';
  let __yrInvHtml = [];
INVESTIGATORS.forEach(name => {
    const stats = computeInvStats(name, yearCases);
    if (stats.totalCases === 0) return;
    __yrInvHtml.push(`<tr><td><strong>${escAttr(name)}</strong></td><td>${stats.totalCases}</td><td>Rs ${fmt(stats.totalPayable)}</td><td style='color:var(--green)'>Rs ${fmt(stats.paidAmt)}</td><td style='color:var(--red)'>Rs ${fmt(stats.pendingAmt)}</td></tr>`);
  });
  invTbody.innerHTML = __yrInvHtml.join('');
  if (!invTbody.innerHTML) invTbody.innerHTML = '<tr><td colspan="5" class="empty-state">No data yet</td></tr>';

  // Month by month
  const monthlyTbody = document.querySelector('#yearly-monthly-table tbody');
  monthlyTbody.innerHTML = fyMonths.map(mo => {
    const rows = yearCases.filter(c => {
      const d = new Date(c.date);
      return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y;
    });
    const payable = rows.reduce((s,c)=>s+(c.total_payable||0),0);
    const received = rows.reduce((s,c)=>s+(c.received||0),0);
    const profit = received - payable;
    return `<tr><td><strong>${mo.label}</strong></td><td>${rows.length}</td><td>Rs ${fmt(payable)}</td><td>Rs ${fmt(received)}</td><td style="color:${profit>=0?'var(--green)':'var(--red)'}">Rs ${fmt(profit)}</td></tr>`;
  }).join('');
}
function selectYearlyFY() {
  activeFYStart = parseInt(document.getElementById('yearly-fy-select').value);
  renderYearly();
}

function quickSlip(name, monthIdx) {
  document.getElementById('slip-inv').value = name;
  document.getElementById('slip-month').value = MONTHS[monthIdx].code;
  // We don't necessarily need to switch view if we show a high-z modal, 
  // but switching to reports view keeps context correct if they close the modal.
  showView('reports', document.querySelector('[data-view="reports"]'));
  generateSlip(true); // pass true to indicate we want preview
}

// ============================================================
// DOCUMENTS
// ============================================================
let docListSorted = [];
let docListPage = 1;
const DOC_LIST_PAGE_SIZE = 150;
function renderDocuments() {
  docListSorted = cases.filter(c => c.doc_code).sort((a,b) => (a.doc_code||'').localeCompare(b.doc_code||''));
  document.getElementById('doc-count').textContent = docListSorted.length;
  renderDocListPage();
}

function hardcopyBadge(status) {
  if (status === 'Received') return '<span class="badge success">Received</span>';
  if (status === 'Not Received') return '<span class="badge danger">Not Received</span>';
  return '<span class="badge na">Not Set</span>';
}

// Builds the hard-copy status display for one case row. Collapses to a
// single badge when there's only one investigator, or when INV1 and INV2
// are the same person (one physical document either way) — otherwise shows
// both investigators' status side by side since their hardcopies can arrive
// independently.
function hardcopyStatusCell(c) {
  const hasInv2 = c.inv2 && c.inv2 !== 'NA';
  const samePerson = hasInv2 && c.inv1 === c.inv2;
  if (!hasInv2 || samePerson) {
    return hardcopyBadge(c.hardcopy1_status);
  }
  return `<div style="display:flex;flex-direction:column;gap:2px;">
    <div>${c.inv1}: ${hardcopyBadge(c.hardcopy1_status)}</div>
    <div>${c.inv2}: ${hardcopyBadge(c.hardcopy2_status)}</div>
  </div>`;
}

function renderDocListPage() {
  const maxPage = Math.max(1, Math.ceil(docListSorted.length / DOC_LIST_PAGE_SIZE));
  if (docListPage > maxPage) docListPage = maxPage;
  
  const tbody = document.getElementById('doc-list-tbody');
  const start = (docListPage-1) * DOC_LIST_PAGE_SIZE;
  const pageRows = docListSorted.slice(start, start + DOC_LIST_PAGE_SIZE);
  tbody.innerHTML = pageRows.map(c => `<tr data-id="${c.id}" data-doccode="${c.doc_code || ''}" style="cursor:pointer;">
    <td class="mono" style="font-weight:700;color:var(--navy)">${c.doc_code}</td>
    <td>${c.date||''}</td><td>${c.company||''}</td><td class="mono">${c.claim_no||''}</td><td>${c.insured_name||''}</td>
    <td>${c.inv1||''}${c.inv2 && c.inv2!=='NA' ? ' / '+c.inv2 : ''}</td>
    <td>${hardcopyStatusCell(c)}</td>
  </tr>`).join('') || '<tr><td colspan="7"><div class="empty-state">No documents yet</div></td></tr>';
  const rangeEl = document.getElementById('doc-page-range');
  if (rangeEl) rangeEl.textContent = docListSorted.length ? `${start+1}–${Math.min(start+DOC_LIST_PAGE_SIZE, docListSorted.length)} of ${docListSorted.length}` : '0';
  const curEl = document.getElementById('doc-page-current');
  if (curEl) curEl.textContent = `${docListPage} / ${maxPage}`;
}
function docListPrevPage() { if (docListPage>1) { docListPage--; renderDocListPage(); } }
function docListNextPage() { const maxPage = Math.max(1, Math.ceil(docListSorted.length / DOC_LIST_PAGE_SIZE)); if (docListPage<maxPage) { docListPage++; renderDocListPage(); } }

let lookupDocTimer = null;
function lookupDoc() {
  clearTimeout(lookupDocTimer);
  lookupDocTimer = setTimeout(() => {
    executeLookupDoc();
  }, 250);
}
function executeLookupDoc() {
  const q = document.getElementById('doc-search').value.trim().toLowerCase();
  const listEl = document.getElementById('doc-result-list');
  if (!q) { listEl.innerHTML = ''; return; }

  const matches = cases.filter(c =>
    (c.doc_code||'').toLowerCase().includes(q) ||
    (c.claim_no||'').toLowerCase().includes(q) ||
    (c.insured_name||'').toLowerCase().includes(q) ||
    (c.policy_no||'').toLowerCase().includes(q)
  );

  if (!matches.length) {
    listEl.innerHTML = `<div class="doc-result show"><div class="empty-state">No case found matching "${escAttr(q)}"</div></div>`;
    return;
  }

  listEl.innerHTML = matches.slice(0,25).map(found => `
    <div class="doc-result show" data-id="${found.id}" data-doccode="${found.doc_code || ''}" style="cursor:pointer;">
      <div class="row"><span>Document Code</span><b class="mono">${found.doc_code}</b></div>
      <div class="row"><span>Company</span><b>${found.company}</b></div>
      <div class="row"><span>Date</span><b>${found.date}</b></div>
      <div class="row"><span>Case Type</span><b>${found.case_type}</b></div>
      <div class="row"><span>Claim No</span><b class="mono">${found.claim_no}</b></div>
      <div class="row"><span>Policy No</span><b>${found.policy_no||'—'}</b></div>
      <div class="row"><span>Insured Name</span><b>${found.insured_name}</b></div>
      <div class="row"><span>Hospital</span><b>${found.hospital||'—'}</b></div>
      <div class="row"><span>Investigator 1</span><b>${found.inv1||'—'}</b></div>
      <div class="row"><span>Investigator 2</span><b>${found.inv2||'—'}</b></div>
      <div class="row"><span>Hard Copy Status</span><b>${hardcopyStatusCell(found)}</b></div>
      <div class="row"><span>Total Payable</span><b>Rs ${fmt(found.total_payable)}</b></div>
      <div class="row"><span>Remarks</span><b>${found.remarks||'—'}</b></div>
    </div>`).join('');
  if (matches.length > 25) listEl.innerHTML += `<div style="text-align:center;color:var(--sub);font-size:11px;padding:8px;">+${matches.length-25} more matches — refine your search</div>`;
}

// ============================================================
// FORM MATCH (manual paste)
// ============================================================
function runMatch() {
  const raw = document.getElementById('match-input').value.trim();
  if (!raw) return;
  const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
  const results = [];

  lines.forEach(line => {
    const parts = line.split(/\t|,/).map(p=>p.trim());
    const claim = parts[0], company = parts[1], casetype = parts[2], insured = parts[3];
    if (!claim) return;
    const existing = cases.find(c => (c.claim_no||'').toString() === claim.toString());
    if (!existing) {
      results.push({claim, company, insured, status:'new', note:'Not in system yet — needs to be added'});
    } else {
      const mismatches = [];
      if (company && existing.company && company.toUpperCase() !== existing.company.toUpperCase()) mismatches.push('Company differs');
      if (insured && existing.insured_name && insured.toUpperCase() !== existing.insured_name.toUpperCase()) mismatches.push('Insured name differs');
      if (casetype && existing.case_type && casetype.toUpperCase() !== existing.case_type.toUpperCase()) mismatches.push('Case type differs');
      if (mismatches.length) {
        results.push({claim, company, insured, status:'mismatch', note:mismatches.join('; ')});
      } else {
        results.push({claim, company, insured, status:'match', note:`Doc code: ${existing.doc_code||'—'}`});
      }
    }
  });

  document.getElementById('match-results-panel').style.display='block';
  document.getElementById('match-tbody').innerHTML = results.map(r => `<tr>
    <td class="mono">${r.claim}</td><td>${r.company||''}</td><td>${r.insured||''}</td>
    <td>${r.status==='match'?'<span class="badge paid">Match</span>':r.status==='mismatch'?'<span class="badge overdue">Mismatch</span>':'<span class="badge pending">New</span>'}</td>
    <td>${r.note}</td>
  </tr>`).join('');
}

// ============================================================
// ADD / EDIT CASE
// ============================================================
let editingDocCode = null; // captured at modal-open time; save/delete use this, not editIdx, so a
                            // realtime reload while the modal is open can't cause an update to land
                            // on the wrong row after cases[] gets rebuilt/reordered underneath it.

function updateInvestigatorRecommendations() {
  const recContainer = document.getElementById('ai-investigator-recommendations');
  const recList = document.getElementById('ai-rec-list');
  
  if (!recContainer || !recList) return;

  const company = (document.getElementById('f-company').value || '').trim().toUpperCase();
  const location = (document.getElementById('f-location').value || '').toLowerCase();
  
  if (!investigatorRows || investigatorRows.length === 0) {
      recContainer.style.display = 'none';
      return;
  }
  
  const invStats = {};
  investigatorRows.forEach(inv => {
      if(inv.removed) return;
      invStats[inv.name] = {
          workload: 0,
          companies: {},
          totalCompleted: 0,
          totalAssigned: 0,
          address: (inv.address || '').toLowerCase()
      };
  });
  
  cases.forEach(c => {
      const i1 = c.inv1;
      const i2 = c.inv2;
      
      const updateStats = (invName, isHardcopyRecv, isPaid) => {
          if(!invName || invName === 'NA' || !invStats[invName]) return;
          invStats[invName].totalAssigned++;
          
          if (isHardcopyRecv || isPaid) {
              invStats[invName].totalCompleted++;
          } else {
              invStats[invName].workload++;
          }
          
          if (c.company) {
              invStats[invName].companies[c.company] = (invStats[invName].companies[c.company] || 0) + 1;
          }
      };
      
      updateStats(i1, c.hardcopy1_status === 'Received', c.inv1_status === 'Paid');
      updateStats(i2, c.hardcopy2_status === 'Received', c.inv2_status === 'Paid');
  });
  
  let maxWorkload = 0;
  Object.values(invStats).forEach(s => {
      if (s.workload > maxWorkload) maxWorkload = s.workload;
  });
  
  const scored = [];
  Object.keys(invStats).forEach(name => {
      const stats = invStats[name];
      
      let workloadScore = 30;
      if (maxWorkload > 0) {
          workloadScore = 30 * (1 - (stats.workload / maxWorkload));
      }
      
      let branchScore = 20; // Default flat score since no strict branch mapping is in DB
      
      let companyScore = 0;
      if (company && stats.companies[company]) {
          companyScore = Math.min(20, stats.companies[company] * 4); 
      }
      
      let completionScore = 0;
      if (stats.totalAssigned > 0) {
          completionScore = 15 * (stats.totalCompleted / stats.totalAssigned);
      } else {
          completionScore = 15; // neutral for new
      }
      
      let cityScore = 0;
      if (location && stats.address.includes(location)) {
          cityScore = 10;
      } else if (location && location.includes(stats.address) && stats.address.length > 3) {
          cityScore = 10;
      } else if (location && stats.address) {
          // Add partial match logic if location and address share words
          const locWords = location.split(/[\s,]+/);
          const addWords = stats.address.split(/[\s,]+/);
          if (locWords.some(w => w.length > 3 && addWords.includes(w))) cityScore = 5;
      }
      
      // We had total possible matching points = 30 + 20 (branch) + 20 + 15 + 10 = 95. Scale branch slightly higher to 25.
      branchScore = 25; 
      
      const total = workloadScore + branchScore + companyScore + completionScore + cityScore;
      scored.push({ name, score: Math.round(total) });
  });
  
  scored.sort((a,b) => b.score - a.score);
  const top3 = scored.slice(0, 3);
  
  if (top3.length === 0) {
      recContainer.style.display = 'none';
      return;
  }
  
  recContainer.style.display = 'block';
  recList.innerHTML = top3.map(inv => 
      `<div style="background:var(--card); padding:6px 10px; border-radius:4px; font-size:11px; cursor:pointer; border:1px solid var(--gold); transition: .2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" 
            onmouseover="this.style.background='var(--navy)'; this.style.color='#fff';"
            onmouseout="this.style.background='var(--card)'; this.style.color='inherit';"
            onclick="document.getElementById('f-inv1').value='${inv.name.replace(/'/g, "\\'")}'; updateHardcopy2Visibility();" 
            title="Assign to ${inv.name}">
          ★ ${inv.name} <span style="font-weight:bold; margin-left:4px;">${inv.score}%</span>
      </div>`
  ).join('');
}

function openAddCase() {
  editIdx = -1;
  editingDocCode = null;
  originalInv1 = '';
  originalInv2 = '';
  document.getElementById('modal-title').textContent = 'Add New Case';
  document.getElementById('delete-case-btn').style.display = 'none';
  document.getElementById('mark-exception-btn').style.display = 'none';
  const headDispatchBtn = document.getElementById('modal-dispatch-head-btn');
  if (headDispatchBtn) headDispatchBtn.style.display = 'none';
  const footDispatchBtn = document.getElementById('modal-dispatch-foot-btn');
  if (footDispatchBtn) footDispatchBtn.style.display = 'none';
  document.getElementById('transfer-reason-container').style.display = 'none';
  document.getElementById('transfer-history-container').style.display = 'none';
  document.getElementById('f-transfer-reason').value = '';
  clearForm();
  if(typeof applyFieldPermissions === 'function') applyFieldPermissions();
  document.getElementById('case-modal').classList.add('open');
  updateInvestigatorRecommendations();
}

function editCase(idx) {
  editIdx = idx;
  const c = cases[idx];
  if (!c) return;
  editingDocCode = c.doc_code;
  originalInv1 = c.inv1 || '';
  originalInv2 = c.inv2 || '';
  document.getElementById('modal-title').textContent = `Edit Case — ${c.doc_code||''}`;
  document.getElementById('delete-case-btn').style.display = 'inline-block';
  document.getElementById('mark-exception-btn').style.display = c.exception_type ? 'none' : 'inline-block';
  const headDispatchBtn = document.getElementById('modal-dispatch-head-btn');
  if (headDispatchBtn) headDispatchBtn.style.display = 'inline-block';
  const footDispatchBtn = document.getElementById('modal-dispatch-foot-btn');
  if (footDispatchBtn) footDispatchBtn.style.display = 'inline-block';
  document.getElementById('transfer-reason-container').style.display = 'none';
  document.getElementById('f-transfer-reason').value = '';
  document.getElementById('f-company').value = c.company||'';
  document.getElementById('f-date').value = c.date||'';
  document.getElementById('f-casetype').value = c.case_type||'';
  document.getElementById('f-claim').value = c.claim_no||'';
  document.getElementById('f-policy').value = c.policy_no||'';
  document.getElementById('f-insured').value = c.insured_name||'';
  document.getElementById('f-hospital').value = c.hospital||'';
  document.getElementById('f-location').value = c.location||'';
  document.getElementById('f-sla').value = c.sla_hours||'';
  document.getElementById('f-inv1').value = c.inv1||'';
  document.getElementById('f-inv2').value = c.inv2||'';
  document.getElementById('f-fee1').value = c.fee1||'';
  document.getElementById('f-fee2').value = c.fee2||'';
  document.getElementById('f-ta1').value = c.ta1||'';
  document.getElementById('f-ta2').value = c.ta2||'';
  if (typeof window.populateCustomFieldsInForm === 'function') window.populateCustomFieldsInForm(c.custom_data);
  document.getElementById('f-received').value = c.received||'';
  document.getElementById('f-invoice').value = c.invoice_no||'';
  document.getElementById('f-invoice-amount').value = c.invoice_amount||'';
  document.getElementById('f-inv1status').value = c.inv1_status||'';
  document.getElementById('f-inv2status').value = c.inv2_status||'';
  document.getElementById('f-hardcopy1status').value = c.hardcopy1_status||'';
  document.getElementById('f-hardcopy2status').value = c.hardcopy2_status||'';
  const compHc = document.getElementById('f-companyhardcopy');
  if (compHc) compHc.value = c.company_hardcopy_status || 'Pending';
  const compAwb = document.getElementById('f-companyawb');
  if (compAwb) compAwb.value = c.company_hardcopy_awb || '';
  document.getElementById('f-outcome').value = c.outcome||'Pending';
  document.getElementById('f-remarks').value = c.remarks||'';
  checkHospitalRisk(c.hospital || '');
  calcTotal();
  updateHardcopy2Visibility();
  loadTransferHistory(c.id);
  if(typeof applyFieldPermissions === 'function') applyFieldPermissions();
  document.getElementById('case-modal').classList.add('open');
  updateInvestigatorRecommendations();
}

function openEditCase(caseIdOrDocCode) {
  if (!caseIdOrDocCode) return;
  const idx = cases.findIndex(c => String(c.id) === String(caseIdOrDocCode) || String(c.doc_code) === String(caseIdOrDocCode));
  if (idx !== -1) {
    editCase(idx);
  }
}
window.editCase = editCase;
window.openEditCase = openEditCase;

// ============================================================
// INLINE EDIT (click any editable cell to edit in-place)
// ============================================================
let inlineEditState = { cell: null, original: '', field: '', idx: -1, type: '' };

function startInlineEdit(cell) {
  if (inlineEditState.cell) finishInlineEdit(inlineEditState.cell, true); // cancel any open
  const row = cell.closest('tr');
  const idx = parseInt(row.dataset.idx);
  const c = cases[idx];
  if (!c) return;
  const field = cell.dataset.field;
  const type = cell.dataset.type;
  const val = cell.dataset.val;
  inlineEditState = { cell, original: val, field, idx, type };
  cell.classList.add('inline-editing');
  // Create overlay editor (wider than cell for amount fields)
  const isNumber = type === 'number';
  let editor;
  if (field.startsWith('custom_')) {
      const cfId = field.replace('custom_', '');
      const cfDef = window.CUSTOM_FIELDS.find(x => x.id === cfId);
      if (cfDef && cfDef.type === 'number') editor = `<input type="number" step="any" value="${val}">`;
      else if (cfDef && cfDef.type === 'date') editor = `<input type="date" value="${val}">`;
      else editor = `<input type="text" value="${val}">`;
  } else if (type === 'date') {
    editor = `<input type="date" value="${val}">`;
  } else if (type === 'number') {
    editor = `<input type="number" value="${val}" step="1" min="0">`;
  } else if (type === 'status') {
    editor = `<select>${['','Paid','Pending'].map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select>`;
  } else if (type === 'outcome') {
    const opts = ['Pending','Genuine','Fraud','Suspicious','Not Found','Settled'];
    editor = `<select>${opts.map(o=>`<option value="${escAttr(o)}" ${(o.toLowerCase()===(val||'').toLowerCase())?'selected':''}>${o}</option>`).join('')}</select>`;
  } else if (type === 'hardcopy') {
    editor = `<select>${['','Received','Not Received'].map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select>`;
  } else {
    editor = `<input type="text" value="${val}">`;
  }
  const overlay = document.createElement('div');
  overlay.className = 'td-editor-overlay' + (isNumber ? ' td-editor-wide' : '');
  overlay.innerHTML = editor;
  cell.appendChild(overlay);
  const input = overlay.querySelector('input,select');
  input.focus();
  if (input.select) input.select();
  // Save on Enter / Blur / Escape
  const save = () => finishInlineEdit(cell, false);
  const cancel = () => finishInlineEdit(cell, true);
  input.addEventListener('keydown', e => { if (e.key==='Enter') save(); if (e.key==='Escape') cancel(); });
  input.addEventListener('blur', e => { setTimeout(save, 50); });
  // Prevent click on cell from bubbling and re-triggering
  cell.addEventListener('click', e => e.stopPropagation(), { once: true });
}

async function finishInlineEdit(cell, cancelled) {
  if (!inlineEditState.cell || inlineEditState.cell !== cell) return;
  const { field, idx, original, type } = inlineEditState;
  const c = cases[idx];
  if (!c) { inlineEditState = { cell: null, original: '', field: '', idx: -1, type: '' }; return; }
  // Get new value
  let newVal = '';
  if (!cancelled) {
    const input = cell.querySelector('input,select');
    if (input) newVal = input.value;
  }
  // If value unchanged or cancelled → restore original display
  if (cancelled || newVal === '' || newVal === original) {
    cell.classList.remove('inline-editing');
    cell.innerHTML = renderCellDisplay(c, field, type, original);
    inlineEditState = { cell: null, original: '', field: '', idx: -1, type: '' };
    return;
  }
  // Save to DB
  try {
    const update = {};
    const parsedVal = (type === 'number' ? parseFloat(newVal) : newVal);
    if (type === 'number' && Number.isNaN(parsedVal)) throw new Error('Invalid number');
    
    if (field.startsWith('custom_')) {
        const cfId = field.replace('custom_', '');
        update.custom_data = c.custom_data ? { ...c.custom_data } : {};
        if (parsedVal === '' || parsedVal === null) {
            delete update.custom_data[cfId];
        } else {
            update.custom_data[cfId] = parsedVal;
        }
    } else {
        update[field] = parsedVal;
    }
    
    await updateCaseDB(c.doc_code, update);
    if (window.logActivity) window.logActivity('Cases', `inline updated ${field} on case ${c.doc_code}`); showToast('Updated.');
    await loadCasesFromDB();
    renderAll();
  } catch (err) {
    showToast('Save failed: ' + err.message, true);
    // Restore original on failure
    cell.classList.remove('inline-editing');
    cell.innerHTML = renderCellDisplay(c, field, type, original);
  } finally {
    inlineEditState = { cell: null, original: '', field: '', idx: -1, type: '' };
  }
}

function renderCellDisplay(c, field, type, val) {
  const money = v => `Rs ${fmt(v)}`;
  switch (field) {
    case 'fee1': case 'fee2': case 'ta1': case 'ta2': case 'received': case 'invoice_amount': return money(val);
    case 'inv1_status': case 'inv2_status': return statusBadge(val);
    case 'outcome': return outcomeBadge(val);
    case 'hardcopy1_status':
    case 'hardcopy2_status': {
      // Create a temp case with the override value for rendering
      const temp = { ...c };
      temp[field] = val;
      return hardcopyStatusCell(temp);
    }
    default: 
      if (field.startsWith('custom_')) {
          const cfId = field.replace('custom_', '');
          const cfDef = window.CUSTOM_FIELDS.find(x => x.id === cfId);
          if (cfDef && cfDef.type === 'number' && val) return money(val);
      }
      return escAttr(val);
  }
}

function clearForm() {
  if (typeof window.populateCustomFieldsInForm === 'function') window.populateCustomFieldsInForm(null);
  ['f-company','f-date','f-casetype','f-claim','f-policy','f-insured','f-hospital','f-location','f-sla',
   'f-inv1','f-inv2','f-fee1','f-fee2','f-ta1','f-ta2','f-received','f-invoice','f-invoice-amount',
   'f-inv1status','f-inv2status','f-hardcopy1status','f-hardcopy2status','f-companyawb','f-remarks'].forEach(id => {
     const el = document.getElementById(id);
     if (el) el.value = '';
   });
  const fCompanyHardcopy = document.getElementById('f-companyhardcopy');
  if (fCompanyHardcopy) fCompanyHardcopy.value = 'Pending';
  const fOutcome = document.getElementById('f-outcome');
  if (fOutcome) fOutcome.value = 'Pending';
  const hRiskWarn = document.getElementById('hospital-risk-warning');
  if (hRiskWarn) hRiskWarn.style.display = 'none';
  document.getElementById('f-total').value = '';
  document.getElementById('f-profit').value = '';
  const rawAi = document.getElementById('ai-case-raw-input');
  if (rawAi) rawAi.value = '';
  const aiFile = document.getElementById('ai-case-doc-file');
  if (aiFile) aiFile.value = '';
  const aiLabel = document.getElementById('ai-case-file-label');
  if (aiLabel) aiLabel.textContent = 'Attach Mandate PDF / Photo';
  const aiStatus = document.getElementById('ai-autofill-status');
  if (aiStatus) { aiStatus.style.display = 'none'; aiStatus.textContent = ''; }
  selectedAICaseFile = null;
  updateHardcopy2Visibility();
}

// ============================================================
// AI MANDATE EXTRACTION & OCR (Gemini 3.7 Flash)
// ============================================================
let selectedAICaseFile = null;

function onAICaseFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const labelEl = document.getElementById('ai-case-file-label');
  if (labelEl) labelEl.textContent = `📎 ${file.name} (${(file.size/1024).toFixed(0)} KB)`;

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const base64Data = dataUrl.split(',')[1];
    selectedAICaseFile = {
      base64: base64Data,
      mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      name: file.name
    };
  };
  reader.readAsDataURL(file);
}

async function triggerAIMandateAutoFill() {
  const rawText = document.getElementById('ai-case-raw-input')?.value?.trim() || '';
  const statusEl = document.getElementById('ai-autofill-status');
  const btnEl = document.getElementById('ai-autofill-btn');

  if (!rawText && !selectedAICaseFile) {
    showToast('Please paste mandate text or attach a PDF/photo first.', true);
    return;
  }

  if (statusEl) {
    statusEl.style.display = 'inline-block';
    statusEl.textContent = '⏳ Extracting details with Gemini 3.7 Flash...';
    statusEl.style.color = 'var(--gold)';
  }
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '<span>⏳</span> <span>Processing...</span>';
  }

  try {
    const payload = {
      text: rawText,
      fileBase64: selectedAICaseFile ? selectedAICaseFile.base64 : null,
      mimeType: selectedAICaseFile ? selectedAICaseFile.mimeType : null
    };

    const res = await fetch('/api/gemini/parse-case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || 'Failed to parse document');
    }

    const data = result.data || {};
    let fieldsFilled = 0;

    // Company
    if (data.company) {
      const compEl = document.getElementById('f-company');
      if (compEl) { compEl.value = data.company.toUpperCase(); fieldsFilled++; }
    }

    // Date
    if (data.date) {
      const dateEl = document.getElementById('f-date');
      if (dateEl) { dateEl.value = data.date; fieldsFilled++; }
    } else {
      const dateEl = document.getElementById('f-date');
      if (dateEl && !dateEl.value) {
        dateEl.value = new Date().toISOString().slice(0, 10);
      }
    }

    // Case Type
    if (data.case_type) {
      const ctEl = document.getElementById('f-casetype');
      if (ctEl) {
        const matchedOpt = Array.from(ctEl.options).find(o => 
          o.value.toUpperCase() === data.case_type.toUpperCase() || 
          o.value.toUpperCase().includes(data.case_type.toUpperCase()) ||
          data.case_type.toUpperCase().includes(o.value.toUpperCase())
        );
        if (matchedOpt) {
          ctEl.value = matchedOpt.value;
        } else {
          ctEl.value = data.case_type;
        }
        fieldsFilled++;
      }
    }

    // Claim No
    if (data.claim_no) {
      const claimEl = document.getElementById('f-claim');
      if (claimEl) { claimEl.value = String(data.claim_no).replace(/\s+/g, ''); fieldsFilled++; }
    }

    // Policy No
    if (data.policy_no) {
      const polEl = document.getElementById('f-policy');
      if (polEl) { polEl.value = String(data.policy_no).trim(); fieldsFilled++; }
    }

    // Insured Name
    if (data.insured_name) {
      const insEl = document.getElementById('f-insured');
      if (insEl) { insEl.value = data.insured_name.trim(); fieldsFilled++; }
    }

    // Hospital
    if (data.hospital) {
      const hospEl = document.getElementById('f-hospital');
      if (hospEl) { hospEl.value = data.hospital.trim(); fieldsFilled++; }
    }

    // Location
    if (data.location) {
      const locEl = document.getElementById('f-location');
      if (locEl) { locEl.value = data.location.trim(); fieldsFilled++; }
    }

    // SLA
    if (data.sla_hours) {
      const slaEl = document.getElementById('f-sla');
      if (slaEl) { slaEl.value = data.sla_hours; fieldsFilled++; }
    }

    // Fee 1
    if (data.fee1) {
      const feeEl = document.getElementById('f-fee1');
      if (feeEl) { feeEl.value = data.fee1; fieldsFilled++; }
    }

    // TA 1
    if (data.ta1) {
      const taEl = document.getElementById('f-ta1');
      if (taEl) { taEl.value = data.ta1; fieldsFilled++; }
    }

    // Received
    if (data.received) {
      const recEl = document.getElementById('f-received');
      if (recEl) { recEl.value = data.received; fieldsFilled++; }
    }

    // Invoice No
    if (data.invoice_no) {
      const invNoEl = document.getElementById('f-invoice');
      if (invNoEl) { invNoEl.value = data.invoice_no; fieldsFilled++; }
    }

    // Remarks
    if (data.remarks) {
      const remEl = document.getElementById('f-remarks');
      if (remEl) {
        remEl.value = remEl.value ? (remEl.value + '\n' + data.remarks) : data.remarks;
        fieldsFilled++;
      }
    }

    calcTotal();
    updateInvestigatorRecommendations();

    if (statusEl) {
      statusEl.style.display = 'inline-block';
      statusEl.style.color = 'var(--green)';
      statusEl.textContent = `✅ ${fieldsFilled} fields auto-filled! Please select investigator & save.`;
    }
    showToast(`✨ Auto-filled ${fieldsFilled} fields with Gemini AI`);

  } catch (err) {
    console.error('AI Auto-Fill Error:', err);
    if (statusEl) {
      statusEl.style.display = 'inline-block';
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = `❌ ${err.message || 'Extraction failed'}`;
    }
    showToast('AI extraction failed: ' + err.message, true);
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = '<span>⚡</span> <span>Auto-Fill Form with AI</span>';
    }
  }
}

// ============================================================
// WHATSAPP & EMAIL CASE DISPATCHER
// ============================================================
function formatCaseDispatchMessage(caseObj, invName, role = 'INV1') {
  const fee = role === 'INV2' ? (caseObj.fee2 || 0) : (caseObj.fee1 || 0);
  const ta = role === 'INV2' ? (caseObj.ta2 || 0) : (caseObj.ta1 || 0);
  const slaText = caseObj.sla_hours ? `${caseObj.sla_hours} Hours` : 'Standard SLA';
  
  let warningNote = '';
  if (caseObj.hospital) {
    const hName = caseObj.hospital.trim().toUpperCase();
    if (typeof hospitalRiskCache !== 'undefined' && hospitalRiskCache[hName] && hospitalRiskCache[hName].isHighRisk) {
      warningNote = `\n🚨 *HIGH RISK HOSPITAL ALERT* 🚨\nThis hospital has a ${hospitalRiskCache[hName].riskScore}% fraud history in our database. Please strictly verify IPD records, CCTV, and cross-check patient statement!\n`;
    }
  }

  return `*DNA PROFESSIONAL INVESTIGATION AGENCY*
📋 *NEW CASE ASSIGNMENT ALERT*

Hello *${invName}*,
You have been assigned a new case for investigation:

• *Doc Code:* ${caseObj.doc_code || 'Pending'}
• *Company:* ${caseObj.company || '—'}
• *Case Type:* ${caseObj.case_type || '—'}
• *Claim No:* ${caseObj.claim_no || '—'}
• *Policy No:* ${caseObj.policy_no || 'N/A'}
• *Insured Name:* ${caseObj.insured_name || '—'}
• *Hospital / Site:* ${caseObj.hospital || 'N/A'}
• *Location / Area:* ${caseObj.location || 'N/A'}
• *Allocation Date:* ${caseObj.date || '—'}
• *SLA Target:* ${slaText}
• *Your Agreed Fee:* ₹${fee}${ta > 0 ? ` (+ ₹${ta} TA/Exp)` : ''}
${warningNote}
*Investigation Instructions / Notes:*
${caseObj.remarks || 'Please verify insured facts, collect hospital records, and submit preliminary report on portal within SLA.'}

Portal: ${window.location.origin}/investigator-portal
_DNA Payment & Case Management System_`;
}

function getCaseForDispatch(docCode) {
  if (docCode) {
    const found = cases.find(c => c.doc_code === docCode);
    if (found) return found;
  }
  return {
    doc_code: editingDocCode || 'NEW CASE',
    company: (document.getElementById('f-company')?.value || '').trim().toUpperCase(),
    date: document.getElementById('f-date')?.value || new Date().toISOString().slice(0, 10),
    case_type: document.getElementById('f-casetype')?.value || '',
    claim_no: document.getElementById('f-claim')?.value || '',
    policy_no: document.getElementById('f-policy')?.value || '',
    insured_name: document.getElementById('f-insured')?.value || '',
    hospital: document.getElementById('f-hospital')?.value || '',
    location: document.getElementById('f-location')?.value || '',
    sla_hours: parseInt(document.getElementById('f-sla')?.value) || null,
    inv1: document.getElementById('f-inv1')?.value || '',
    inv2: document.getElementById('f-inv2')?.value || '',
    fee1: parseFloat(document.getElementById('f-fee1')?.value) || 0,
    fee2: parseFloat(document.getElementById('f-fee2')?.value) || 0,
    ta1: parseFloat(document.getElementById('f-ta1')?.value) || 0,
    ta2: parseFloat(document.getElementById('f-ta2')?.value) || 0,
    remarks: document.getElementById('f-remarks')?.value || ''
  };
}

let currentDispatchDocCode = null;

function openCaseDispatchModal(docCode) {
  currentDispatchDocCode = docCode;
  const caseObj = getCaseForDispatch(docCode);

  const docEl = document.getElementById('dispatch-doc-code');
  if (docEl) docEl.textContent = `${caseObj.doc_code || 'Case'} · ${caseObj.company || ''} · Claim: ${caseObj.claim_no || ''}`;
  
  const container = document.getElementById('dispatch-investigators-list');
  if (!container) return;
  container.innerHTML = '';

  const targets = [];
  if (caseObj.inv1) targets.push({ name: caseObj.inv1, role: 'INV1', roleLabel: 'Investigator 1' });
  if (caseObj.inv2 && caseObj.inv2 !== 'NA') targets.push({ name: caseObj.inv2, role: 'INV2', roleLabel: 'Investigator 2' });

  if (targets.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:14px;background:var(--paper);border-radius:6px;border:1px solid var(--line);text-align:center;">
      No investigators currently assigned to this case. Please assign Investigator 1 or 2 first.
    </div>`;
  } else {
    targets.forEach(t => {
      const phone = INVESTIGATOR_PHONES[t.name] || '';
      const email = investigatorRows?.find(r => r.name === t.name)?.email || '';
      const card = document.createElement('div');
      card.className = 'dispatch-card';
      card.innerHTML = `
        <div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-weight:800;color:var(--navy);font-size:13px;">${t.name}</span>
            <span class="badge" style="background:var(--navy);color:#fff;font-size:9.5px;">${t.roleLabel}</span>
          </div>
          <div style="font-size:11px;color:var(--sub);margin-top:3px;">
            📞 <b>${phone || 'No phone saved'}</b> &nbsp;|&nbsp; ✉️ ${email || 'No email'}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-whatsapp btn-sm" onclick="sendCaseWhatsApp('${caseObj.doc_code}', '${t.role}')" title="Send WhatsApp Message">
            <span>💬</span> <span>WhatsApp</span>
          </button>
          <button class="btn btn-email btn-sm" onclick="sendCaseEmail('${caseObj.doc_code}', '${t.role}')" title="Send Email">
            <span>✉️</span> <span>Email</span>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Preview Message for the first assigned target or default
  const primaryName = targets[0]?.name || 'Investigator';
  const previewMsg = formatCaseDispatchMessage(caseObj, primaryName, targets[0]?.role || 'INV1');
  const previewEl = document.getElementById('dispatch-preview-box');
  if (previewEl) previewEl.value = previewMsg;

  document.getElementById('dispatch-modal').classList.add('open');
}

function copyDispatchMessage() {
  const previewEl = document.getElementById('dispatch-preview-box');
  if (!previewEl) return;
  navigator.clipboard.writeText(previewEl.value).then(() => {
    showToast('📋 Dispatch message copied to clipboard!');
  }).catch(() => {
    previewEl.select();
    document.execCommand('copy');
    showToast('📋 Dispatch message copied to clipboard!');
  });
}

function cleanPhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  return digits;
}

async function sendCaseWhatsApp(docCode, role = 'INV1') {
  const caseObj = getCaseForDispatch(docCode);
  const invName = role === 'INV2' ? caseObj.inv2 : caseObj.inv1;
  if (!invName || invName === 'NA') {
    showToast('No investigator assigned.', true);
    return;
  }

  let phone = INVESTIGATOR_PHONES[invName] || '';
  if (!phone) {
    phone = prompt(`Enter 10-digit WhatsApp phone number for investigator "${invName}":`, '');
    if (!phone) return;
    try {
      await updateInvestigatorPhoneDB(invName, phone);
      INVESTIGATOR_PHONES[invName] = phone;
    } catch (e) {
      console.warn('Could not auto-save phone:', e);
    }
  }

  const cleanPhone = cleanPhoneNumber(phone);
  const message = formatCaseDispatchMessage(caseObj, invName, role);
  let encodedMsg = encodeURIComponent(message);
  if (encodedMsg.length > 1800) {
      encodedMsg = encodeURIComponent(message.substring(0, 1500) + '... (message truncated)');
  }
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

  window.open(waUrl, '_blank');
  showToast(`📲 Opening WhatsApp for ${invName}...`);
}

async function sendCaseEmail(docCode, role = 'INV1') {
  const caseObj = getCaseForDispatch(docCode);
  const invName = role === 'INV2' ? caseObj.inv2 : caseObj.inv1;
  if (!invName || invName === 'NA') {
    showToast('No investigator assigned.', true);
    return;
  }

  let email = investigatorRows?.find(r => r.name === invName)?.email || '';
  if (!email) {
    email = prompt(`Enter Email address for investigator "${invName}":`, '');
    if (!email) return;
  }

  const message = formatCaseDispatchMessage(caseObj, invName, role);
  const subject = `[Case Allocation] ${caseObj.doc_code || 'DNA Agency'} - ${caseObj.company} (${caseObj.claim_no})`;
  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

  window.location.href = mailtoUrl;
  showToast(`✉️ Opening email client for ${invName}...`);
}

function calcTotal() {
  const fee1 = Math.max(0, parseFloat(document.getElementById('f-fee1').value) || 0);
  const fee2 = Math.max(0, parseFloat(document.getElementById('f-fee2').value) || 0);
  const ta1 = Math.max(0, parseFloat(document.getElementById('f-ta1').value) || 0);
  const ta2 = Math.max(0, parseFloat(document.getElementById('f-ta2').value) || 0);
  const received = Math.max(0, parseFloat(document.getElementById('f-received').value) || 0);
  
  let effectiveFee1 = fee1, effectiveTa1 = ta1;
  let effectiveFee2 = fee2, effectiveTa2 = ta2;

  const inv1Name = document.getElementById('f-inv1').value;
  const inv2Name = document.getElementById('f-inv2').value;
  const dateStr = document.getElementById('f-date').value;
  const caseDate = dateStr ? new Date(dateStr) : new Date();

  if (typeof investigatorRows !== 'undefined' && investigatorRows) {
    const inv1 = investigatorRows.find(r => r.name === inv1Name);
    if (inv1 && inv1.payment_type === 'Salary') {
      const typeChangedAt = inv1.payment_type_changed_at ? new Date(inv1.payment_type_changed_at) : null;
      if (!typeChangedAt || caseDate >= typeChangedAt) {
        effectiveFee1 = 0; effectiveTa1 = 0;
      }
    }
    const inv2 = investigatorRows.find(r => r.name === inv2Name);
    if (inv2 && inv2.payment_type === 'Salary') {
      const typeChangedAt = inv2.payment_type_changed_at ? new Date(inv2.payment_type_changed_at) : null;
      if (!typeChangedAt || caseDate >= typeChangedAt) {
        effectiveFee2 = 0; effectiveTa2 = 0;
      }
    }
  }

  const total = effectiveFee1 + effectiveFee2 + effectiveTa1 + effectiveTa2;
  document.getElementById('f-total').value = total;
  
  const profit = received - total;
  const pEl = document.getElementById('f-profit');
  pEl.value = profit;
  pEl.style.color = profit >= 0 ? 'var(--green)' : 'var(--red)';
}

// ============================================================
// HARDCOPY STATUS (per-investigator physical document tracking)
// ============================================================
function setHardcopy2SameAsInv1() {
  document.getElementById('f-hardcopy2status').value = document.getElementById('f-hardcopy1status').value;
}

function syncHardcopy2IfLinked() {
  // If INV2 is the exact same person as INV1, their hardcopy status is one
  // and the same thing (one packet, one document) — keep them in lockstep
  // automatically rather than asking the user to set the same value twice.
  const inv1 = document.getElementById('f-inv1').value;
  const inv2 = document.getElementById('f-inv2').value;
  if (inv1 && inv2 && inv1 === inv2) {
    document.getElementById('f-hardcopy2status').value = document.getElementById('f-hardcopy1status').value;
  }
}

// Hides the INV2 hardcopy field entirely when there's no second investigator
// (blank or 'NA') — nothing to track, so don't show a confusing empty field.
// When INV1 and INV2 are the same person, INV2's field is also hidden since
// syncHardcopy2IfLinked() keeps its value mirrored to INV1 automatically.
let originalInv1 = '';
let originalInv2 = '';

function onInvestigatorChange() {
  updateHardcopy2Visibility();
  
  const currentInv1 = document.getElementById('f-inv1').value;
  const currentInv2 = document.getElementById('f-inv2').value;
  
  const changed = (editingDocCode && (currentInv1 !== originalInv1 || currentInv2 !== originalInv2));
  document.getElementById('transfer-reason-container').style.display = changed ? 'block' : 'none';
}

async function loadTransferHistory(caseId) {
  const listEl = document.getElementById('transfer-history-list');
  const container = document.getElementById('transfer-history-container');
  const badge = document.getElementById('transfer-count-badge');
  
  if (!listEl) return;
  
  try {
    const { data, error } = await supabaseClient.from('case_ownership_transfers').select('*').eq('case_id', caseId).order('transfer_date', { ascending: false });
    
    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('Ownership Transfer table not found. Please run the SQL migration 05_ownership_transfer.sql in your database dashboard.');
        container.style.display = 'none';
        return;
      }
      throw error;
    }
    
    if (data && data.length > 0) {
      container.style.display = 'block';
      badge.textContent = data.length;
      listEl.innerHTML = data.map(t => {
        const date = new Date(t.transfer_date).toLocaleString();
        return `
          <div style="background:var(--paper); padding:10px; border-radius:4px; border-left:3px solid var(--gold); font-size:11px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="font-weight:700; color:var(--navy);">${t.previous_owner || 'Unassigned'} → ${t.new_owner}</span>
              <span style="color:var(--sub); font-size:10px;">${date}</span>
            </div>
            <div style="color:var(--ink); line-height:1.4;">
              <b>Reason:</b> ${t.reason || 'No reason provided'}
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.style.display = 'none';
      listEl.innerHTML = '';
    }
  } catch (err) {
    console.error('Failed to load transfer history:', err);
  }
}

async function logOwnershipTransfer(caseId, prev, next, reason) {
  try {
    const { error } = await supabaseClient.from('case_ownership_transfers').insert({
      case_id: caseId,
      previous_owner: prev,
      new_owner: next,
      reason: reason || 'Investigator changed during case edit',
      transferred_by: currentUser?.id
    });
    if (error) throw error;
  } catch (err) {
    console.error('Failed to log transfer:', err);
  }
}

function updateHardcopy2Visibility() {
  const inv1 = document.getElementById('f-inv1').value;
  const inv2 = document.getElementById('f-inv2').value;
  const wrap = document.getElementById('f-hardcopy2status').closest('.fg');
  const noSecondInvestigator = !inv2 || inv2 === 'NA';
  const samePerson = inv1 && inv2 && inv1 === inv2;
  wrap.style.display = (noSecondInvestigator || samePerson) ? 'none' : '';
  if (samePerson) syncHardcopy2IfLinked();
}

async function saveCase() {
  const claim = document.getElementById('f-claim').value.trim().toUpperCase();
  const company = (document.getElementById('f-company').value || '').trim().toUpperCase();
  const inv1 = document.getElementById('f-inv1').value;
  const inv2 = document.getElementById('f-inv2').value;
  const insured = document.getElementById('f-insured').value.trim();
  let date = document.getElementById('f-date').value;
  if (date && date.length === 10) {
    const now = new Date();
    date = `${date}T${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:00`;
  }
  const transferReason = document.getElementById('f-transfer-reason').value.trim();

  if (!claim || !company || !inv1 || !insured || !date) {
    showToast('Please fill all required fields.', true);
    return;
  }

  if (editingDocCode && (inv1 !== originalInv1 || inv2 !== originalInv2)) {
    if (!transferReason) {
      showToast('Please provide a reason for ownership transfer.', true);
      document.getElementById('f-transfer-reason').focus();
      return;
    }
  }
  // Local check first for instant feedback; the DB's unique constraint on
  // claim_no is still the real guard against a race between two staff
  // members submitting the same claim at the same moment (see catch below).
  const dupCase = cases.find(c => c.claim_no===claim && c.doc_code !== editingDocCode);
  if (dupCase) {
    showDupClaimModal(dupCase);
    return;
  }

  const fee1 = Math.max(0, parseFloat(document.getElementById('f-fee1').value) || 0);
  const fee2 = Math.max(0, parseFloat(document.getElementById('f-fee2').value) || 0);
  const ta1 = Math.max(0, parseFloat(document.getElementById('f-ta1').value) || 0);
  const ta2 = Math.max(0, parseFloat(document.getElementById('f-ta2').value) || 0);
  const received = Math.max(0, parseFloat(document.getElementById('f-received').value) || 0);

  const sla_hours = parseInt(document.getElementById('f-sla').value) || null;
  let due_date = null;
  let risk_level = null;
  if (sla_hours && date) {
    const d = new Date(date);
    d.setHours(d.getHours() + sla_hours);
    due_date = d.toISOString();
    const diff = (d - new Date()) / (1000 * 60 * 60);
    if (diff < 0) risk_level = 'HIGH'; // overdue
    else if (diff <= 6) risk_level = 'HIGH';
    else if (diff <= 24) risk_level = 'MEDIUM';
    else risk_level = 'LOW';
  }
  
  const inv1_status = document.getElementById('f-inv1status').value;
  const hardcopy1_status = document.getElementById('f-hardcopy1status').value;
  const outcomeValue = document.getElementById('f-outcome') ? document.getElementById('f-outcome').value : 'Pending';
  const isCompleted = (outcomeValue !== 'Pending' || inv1_status === 'Paid' || hardcopy1_status === 'Received');
  
  let completed_at = null;
  const existingCase = editingDocCode ? cases.find(c => c.doc_code === editingDocCode) : null;
  if (isCompleted) {
      completed_at = (existingCase && existingCase.completed_at) ? existingCase.completed_at : new Date().toISOString();
  }

  const existingException = (editingDocCode && cases[editIdx]) ? cases[editIdx].exception_type : null;
  const existingExReason = (editingDocCode && cases[editIdx]) ? cases[editIdx].exception_reason : null;
  const existingExAt = (editingDocCode && cases[editIdx]) ? cases[editIdx].exception_at : null;
  const existingExBy = (editingDocCode && cases[editIdx]) ? cases[editIdx].exception_by : null;

  const caseFields = {
    sla_hours, due_date, risk_level, completed_at,
    company, date, case_type: document.getElementById('f-casetype').value,
    claim_no: claim, policy_no: document.getElementById('f-policy').value,
    insured_name: insured, hospital: document.getElementById('f-hospital').value,
    location: document.getElementById('f-location').value,
    inv1, inv2: document.getElementById('f-inv2').value,
    fee1, fee2, ta1, ta2, received,
    invoice_no: document.getElementById('f-invoice').value,
    invoice_amount: parseFloat(document.getElementById('f-invoice-amount').value) || null,
    inv1_status: document.getElementById('f-inv1status').value,
    inv2_status: document.getElementById('f-inv2status').value,
    hardcopy1_status: document.getElementById('f-hardcopy1status').value,
    hardcopy2_status: document.getElementById('f-hardcopy2status').value,
    company_hardcopy_status: document.getElementById('f-companyhardcopy') ? document.getElementById('f-companyhardcopy').value : 'Pending',
    company_hardcopy_awb: document.getElementById('f-companyawb') ? document.getElementById('f-companyawb').value : '',
    outcome: document.getElementById('f-outcome') ? document.getElementById('f-outcome').value : 'Pending',
    remarks: document.getElementById('f-remarks').value,
    exception_type: existingException,
    exception_reason: existingExReason,
    exception_at: existingExAt,
    exception_by: existingExBy
  };
  
  if (typeof window.extractCustomFieldValuesFromForm === 'function') {
      const customData = window.extractCustomFieldValuesFromForm();
      if (customData) caseFields.custom_data = customData;
  }

  // total_payable and profit are DB-generated columns — never sent on write.

  const saveBtn = document.querySelector('#case-modal .modal-foot .btn-navy');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  try {
    let doc_code;
    if (editingDocCode) {
      doc_code = editingDocCode;
      const c = cases.find(item => item.doc_code === editingDocCode);
      if (inv1 !== originalInv1) {
        await logOwnershipTransfer(c.id, originalInv1, inv1, `INV1 Transfer: ${transferReason}`);
      }
      if (inv2 !== originalInv2) {
        await logOwnershipTransfer(c.id, originalInv2, inv2, `INV2 Transfer: ${transferReason}`);
      }
      await updateCaseDB(editingDocCode, caseFields);
    } else {
      doc_code = await genDocCodeDB(date);
      await insertCaseDB({doc_code, ...caseFields});
    }

    // Google Drive Folder Creation
    if (window.driveSettings && window.googleDriveService.accessToken) {
      try {
        const folders = await window.googleDriveService.setupCaseFolders(company, doc_code, window.driveSettings.companiesId);
        await updateCaseDB(doc_code, {
          drive_folder_id: folders.caseFolderId,
          drive_url: folders.caseFolderUrl
        });
        console.log('[DRIVE] Case folders created:', folders.caseFolderId);
      } catch (driveErr) {
        console.warn('[DRIVE] Folder creation failed:', driveErr);
      }
    }
  } catch (err) {
    // Postgres unique_violation on claim_no — the real race-condition guard.
    showToast(err.code === '23505' ? 'Duplicate Claim No already exists!' : 'Save failed: ' + err.message, true);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Case'; }
    return;
  }

  await loadCasesFromDB();
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Case'; }
  closeModal('case-modal');
  renderAll();
  checkOverdueAlerts();
  if (window.logActivity) window.logActivity('Cases', editingDocCode ? `updated case ${editingDocCode}` : `created case ${claim}`); showToast(editingDocCode ? 'Case updated.' : 'Case added.');
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function deleteCurrentCase() {
  if (!editingDocCode) return;
  const c = cases.find(x => x.doc_code === editingDocCode);
  if (!c) { showToast('This case no longer exists — it may have been deleted elsewhere.', true); closeModal('case-modal'); return; }
  if (!confirm(`Delete case ${c.doc_code} (Claim ${c.claim_no}, ${c.insured_name})? This cannot be undone.`)) return;
  try {
    await deleteCaseDB(c.doc_code);
  } catch (err) {
    showToast('Delete failed: ' + err.message, true);
    return;
  }
  await loadCasesFromDB();
  closeModal('case-modal');
  renderAll();
  checkOverdueAlerts();
  if (window.logActivity) window.logActivity('Cases', `deleted case ${c.doc_code}`); showToast('Case deleted.');
}

// ============================================================
// DUPLICATE CLAIM MODAL
// ============================================================
let pendingCaseSave = null;

function showDupClaimModal(existingCase) {
  pendingCaseSave = null; // will be set if user confirms
  // Build details HTML
  const money = v => `Rs ${fmt(v)}`;
  document.getElementById('dup-claim-details').innerHTML = `
    <div><b>Doc Code:</b> ${existingCase.doc_code || '—'}</div>
    <div><b>Claim No:</b> ${existingCase.claim_no || '—'}</div>
    <div><b>Company:</b> ${existingCase.company || '—'}</div>
    <div><b>Insured:</b> ${existingCase.insured_name || '—'}</div>
    <div><b>Date:</b> ${existingCase.date || '—'}</div>
    <div><b>Investigator:</b> ${existingCase.inv1 || '—'}</div>
    <div><b>Fee:</b> ${money(existingCase.fee1)} + ${money(existingCase.fee2)} | <b>TA:</b> ${money(existingCase.ta1)} + ${money(existingCase.ta2)}</div>
    <div><b>Payable:</b> ${money(existingCase.total_payable)} | <b>Received:</b> ${money(existingCase.received)} | <b>Status:</b> ${existingCase.inv1_status || '—'}</div>
  `;
  // Store the form data so confirm can re-submit
  pendingCaseSave = collectFormData();
  document.getElementById('dup-claim-modal').classList.add('open');
}

function collectFormData() {
  return {
    company: (document.getElementById('f-company').value || '').trim().toUpperCase(),
    date: document.getElementById('f-date').value,
    case_type: document.getElementById('f-casetype').value,
    claim_no: document.getElementById('f-claim').value.trim(),
    policy_no: document.getElementById('f-policy').value,
    insured_name: document.getElementById('f-insured').value.trim(),
    hospital: document.getElementById('f-hospital').value,
    location: document.getElementById('f-location').value,
    inv1: document.getElementById('f-inv1').value,
    inv2: document.getElementById('f-inv2').value,
    fee1: parseFloat(document.getElementById('f-fee1').value)||0,
    fee2: parseFloat(document.getElementById('f-fee2').value)||0,
    ta1: parseFloat(document.getElementById('f-ta1').value)||0,
    ta2: parseFloat(document.getElementById('f-ta2').value)||0,
    received: parseFloat(document.getElementById('f-received').value)||0,
    invoice_no: document.getElementById('f-invoice').value,
    invoice_amount: parseFloat(document.getElementById('f-invoice-amount').value) || null,
    inv1_status: document.getElementById('f-inv1status').value,
    inv2_status: document.getElementById('f-inv2status').value,
    hardcopy1_status: document.getElementById('f-hardcopy1status').value,
    hardcopy2_status: document.getElementById('f-hardcopy2status').value,
    outcome: document.getElementById('f-outcome') ? document.getElementById('f-outcome').value : 'Pending',
    remarks: document.getElementById('f-remarks').value,
    editingDocCode: editingDocCode
  };
}

async function confirmDupClaimSave() {
  const data = pendingCaseSave;
  if (!data) { closeModal('dup-claim-modal'); return; }
  pendingCaseSave = null;
  closeModal('dup-claim-modal');
  // Re-run save logic with bypassed dup check
  try {
    if (data.editingDocCode) {
      await updateCaseDB(data.editingDocCode, data);
      showToast('Case updated (duplicate acknowledged).');
    } else {
      const doc_code = await genDocCodeDB(data.date);
      await insertCaseDB({doc_code, ...data});
      showToast('Case added (duplicate acknowledged).');
    }
    await loadCasesFromDB();
    renderAll();
    closeModal('case-modal');
  } catch (err) {
    if (err.code === '23505') { // unique violation on claim_no
      showToast('Race condition: another user just added this claim. Please refresh.', true);
    } else {
      showToast('Save failed: ' + err.message, true);
    }
  }
}

// ============================================================
// ADD INVESTIGATOR
// ============================================================
function openAddInvestigator(existing) {
  const nameEl = document.getElementById('new-inv-name');
  const suggEl = document.getElementById('new-inv-suggestion');
  const phoneEl = document.getElementById('new-inv-phone');
  const emailEl = document.getElementById('new-inv-email');
  const cityEl = document.getElementById('new-inv-city');
  const stateEl = document.getElementById('new-inv-state');
  const desigEl = document.getElementById('new-inv-designation');
  const availEl = document.getElementById('new-inv-availability');
  const payTypeEl = document.getElementById('new-inv-payment-type');
  const salaryEl = document.getElementById('new-inv-salary');
  const salaryWrapEl = document.getElementById('new-inv-salary-wrap');
  const phoneWarnEl = document.getElementById('new-inv-phone-warning');
  const emailWarnEl = document.getElementById('new-inv-email-warning');
  const submitBtn = document.getElementById('new-inv-submit-btn');

  if (phoneWarnEl) phoneWarnEl.innerHTML = '';
  if (emailWarnEl) emailWarnEl.innerHTML = '';
  if (phoneEl) phoneEl.style.borderColor = '';
  if (emailEl) emailEl.style.borderColor = '';

  if (existing) {
    if (nameEl) nameEl.value = existing.name || '';
    if (suggEl) suggEl.innerHTML = `<div class="notice" style="background:var(--amber-bg);border-left-color:var(--amber);margin-top:8px;">Editing existing investigator: ${escAttr(existing.name)}</div>`;
    if (phoneEl) phoneEl.value = existing.phone || '';
    if (emailEl) emailEl.value = existing.email || '';
    if (cityEl) cityEl.value = existing.city || '';
    if (stateEl) stateEl.value = existing.state || '';
    if (desigEl) desigEl.value = existing.designation || '';
    if (availEl) availEl.value = existing.availability || 'available';
    if (payTypeEl) payTypeEl.value = existing.payment_type || 'Per Case';
    if (salaryEl) salaryEl.value = existing.salary_amount || 0;
    if (salaryWrapEl) salaryWrapEl.style.display = (existing.payment_type === 'Salary') ? 'block' : 'none';
    if (submitBtn) submitBtn.textContent = 'Save Changes';
  } else {
    if (nameEl) nameEl.value = '';
    if (suggEl) suggEl.innerHTML = '';
    if (phoneEl) phoneEl.value = '';
    if (emailEl) emailEl.value = '';
    if (cityEl) cityEl.value = '';
    if (stateEl) stateEl.value = '';
    if (desigEl) desigEl.value = '';
    if (availEl) availEl.value = 'available';
    if (payTypeEl) payTypeEl.value = 'Per Case';
    if (salaryEl) salaryEl.value = 0;
    if (salaryWrapEl) salaryWrapEl.style.display = 'none';
    if (submitBtn) submitBtn.textContent = 'Add Investigator';
  }
  document.getElementById('addinv-modal').classList.add('open');
}
window.openAddInvestigator = openAddInvestigator;

function checkNewInvestigatorSuggestion() {
  const box = document.getElementById('new-inv-suggestion');
  const name = document.getElementById('new-inv-name').value.trim();
  if (name.length < 3) { box.innerHTML = ''; return; }
  if (getAllInvestigators().some(n => n.toLowerCase() === name.toLowerCase())) {
    box.innerHTML = `<div class="notice" style="background:var(--red-bg);border-left-color:var(--red);margin-top:8px;">This investigator already exists.</div>`;
    return;
  }
  const sugg = findClosestInvestigator(name);
  if (!sugg) { box.innerHTML = ''; return; }
  const safeName = name.replace(/'/g,"\\'");
  if (sugg.ambiguous) {
    box.innerHTML = `<div class="notice" style="background:var(--amber-bg);border-left-color:var(--amber);margin-top:8px;">
      <b>Did you mean one of these?</b> "${name}" is close to ${sugg.ambiguous.length} existing investigators — pick one to map to it instead of creating a new entry, or continue below if this really is a different person.
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
        ${sugg.ambiguous.map(m => `<button type="button" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;" onclick="mapToExistingInvestigator('${safeName}','${m.replace(/'/g,"\\'")}')">Use "${m}"</button>`).join('')}
        <button type="button" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;" onclick="document.getElementById('new-inv-suggestion').innerHTML=''">None — "${escAttr(name)}" is different</button>
      </div>
    </div>`;
  } else {
    box.innerHTML = `<div class="notice" style="background:var(--amber-bg);border-left-color:var(--amber);margin-top:8px;">
      <b>Did you mean "${sugg.match}"?</b> This is already in your investigator list. Map to it instead of creating a new, similarly-named entry?
      <div style="margin-top:8px;display:flex;gap:6px;">
        <button type="button" class="btn btn-navy" style="font-size:11px;padding:4px 10px;" onclick="mapToExistingInvestigator('${safeName}','${sugg.match.replace(/'/g,"\\'")}')">Use "${sugg.match}"</button>
        <button type="button" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;" onclick="document.getElementById('new-inv-suggestion').innerHTML=''">No, "${escAttr(name)}" is different</button>
      </div>
    </div>`;
  }
}

function checkDuplicateContact(type) {
  const inputEl = document.getElementById(`new-inv-${type}`);
  const warningBox = document.getElementById(`new-inv-${type}-warning`);
  if (!inputEl || !warningBox || !investigatorRows) return;
  const val = inputEl.value.trim().toLowerCase();
  if (!val) { warningBox.innerHTML = ''; inputEl.style.borderColor = ''; return; }
  
  const existingNameMatch = document.getElementById('new-inv-suggestion')?.innerText.match(/Editing existing investigator:\s*(.+)/);
  const existingName = existingNameMatch ? existingNameMatch[1].trim() : null;
    
  const conflict = investigatorRows.find(r => 
    (r[type] && r[type].toLowerCase() === val) && r.name !== existingName
  );
  
  if (conflict) {
    warningBox.innerHTML = `⚠️ This ${type === 'phone' ? 'number' : 'email'} is already registered to <b>${escAttr(conflict.name)}</b>.`;
    inputEl.style.borderColor = 'var(--red)';
  } else {
    warningBox.innerHTML = '';
    inputEl.style.borderColor = '';
  }
}

function mapToExistingInvestigator(typedName, existingName) {
  // User confirmed the "new" name they typed is actually an existing investigator
  // spelled/typed differently — just close the modal without creating anything.
  closeModal('addinv-modal');
  showToast(`No new investigator created — "${typedName}" maps to existing "${existingName}". Select "${existingName}" from the dropdown.`);
}

async function saveNewInvestigator() {
  const submitBtn = document.getElementById('new-inv-submit-btn');
  const originalBtnText = submitBtn ? submitBtn.textContent : 'Add Investigator';
  const name = document.getElementById('new-inv-name').value.trim();
  if (!name) { showToast('Please enter investigator name.', true); return; }
  const existingName = document.getElementById('new-inv-suggestion')?.innerText.includes('Editing existing investigator:')
    ? document.getElementById('new-inv-suggestion').innerText.replace('Editing existing investigator: ', '').trim()
    : null;

  if (!existingName && getAllInvestigators().some(n => n.toLowerCase() === name.toLowerCase())) {
    showToast('This investigator already exists.', true); return;
  }
  // If a suggestion is currently showing and unresolved, force the user to
  // explicitly dismiss it (via the "different person" button) before saving
  const suggBox = document.getElementById('new-inv-suggestion');
  if (suggBox && suggBox.innerHTML.trim() !== '' && !existingName) {
    showToast('A similar investigator already exists — resolve the suggestion above first.', true);
    return;
  }
  // Collect all fields
  const invData = {
    name,
    phone: document.getElementById('new-inv-phone')?.value?.trim() || null,
    email: document.getElementById('new-inv-email')?.value?.trim() || null,
    city: document.getElementById('new-inv-city')?.value?.trim() || null,
    state: document.getElementById('new-inv-state')?.value?.trim() || null,
    designation: document.getElementById('new-inv-designation')?.value?.trim() || null,
    availability: document.getElementById('new-inv-availability')?.value || 'available',
    payment_type: document.getElementById('new-inv-payment-type')?.value || 'Per Case',
    salary_amount: parseFloat(document.getElementById('new-inv-salary')?.value) || 0
  };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = existingName ? 'Saving...' : 'Adding...';
  }

  try {
    if (existingName) {
      // Update existing
      await updateInvestigatorDB(existingName, invData);
    } else {
      // Insert new
      await insertInvestigatorDB(invData);
    }
    await loadInvestigatorsFromDB();
    refreshInvestigatorDropdowns();
    closeModal('addinv-modal');
    filterInvestigators();
    if (typeof window.ensureInvestigator360 === 'function') {
      window.ensureInvestigator360();
    }
    showToast(`${existingName ? 'Updated' : 'Added'} ${name}.`);
  } catch (err) {
    if (err.code === '23505') {
      if (err.message && err.message.includes('uq_investigators_phone')) {
        showToast('This Phone Number is already registered to another investigator.', true);
        return;
      }
      if (err.message && err.message.includes('uq_investigators_email')) {
        showToast('This Email Address is already registered to another investigator.', true);
        return;
      }
      showToast('A duplicate entry was detected (Phone or Email).', true);
      return;
    }
    showToast('Failed to save investigator: ' + (err.message || err), true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }
}
window.saveNewInvestigator = saveNewInvestigator;

// ============================================================
// RENAME INVESTIGATOR
// ============================================================
function openRenameInvestigator(name) {
  document.getElementById('rename-old-name').value = name;
  document.getElementById('rename-new-name').value = name;
  document.getElementById('rename-modal').classList.add('open');
}

async function confirmRenameInvestigator() {
  const oldName = document.getElementById('rename-old-name').value;
  const newName = document.getElementById('rename-new-name').value.trim();
  if (!newName) { showToast('Please enter a name.', true); return; }
  if (newName === oldName) { closeModal('rename-modal'); return; }
  if (getAllInvestigators().some(n => n.toLowerCase() === newName.toLowerCase() && n !== oldName)) {
    showToast('That name already exists — use Merge instead if this is the same person.', true);
    return;
  }

  // Push the rename to every affected case in the DB. Two separate updates
  // (inv1 / inv2) since a case could have the old name in either or both slots.
  const affectedDocCodes1 = cases.filter(c => c.inv1 === oldName).map(c => c.doc_code);
  const affectedDocCodes2 = cases.filter(c => c.inv2 === oldName).map(c => c.doc_code);
  try {
    if (affectedDocCodes1.length) {
      const { error } = await supabaseClient.from('cases').update({inv1: newName}).in('doc_code', affectedDocCodes1);
      if (error) throw error;
    }
    if (affectedDocCodes2.length) {
      const { error } = await supabaseClient.from('cases').update({inv2: newName}).in('doc_code', affectedDocCodes2);
      if (error) throw error;
    }
  } catch (err) {
    showToast('Rename failed: ' + err.message, true);
    return;
  }
  const updated = affectedDocCodes1.length + affectedDocCodes2.length;

  try {
    await updateInvestigatorNameDB(oldName, newName);
  } catch (err) {
    showToast('Case names updated, but renaming the investigator record failed: ' + err.message, true);
    await loadCasesFromDB();
    renderAll();
    return;
  }

  await Promise.all([loadCasesFromDB(), loadInvestigatorsFromDB()]);
  refreshInvestigatorDropdowns();
  closeModal('rename-modal');
  renderAll();
  showToast(`Renamed to "${newName}" — ${updated} case entries updated.`);
}

// ============================================================
// MERGE INVESTIGATOR
// ============================================================
function updateMergeTargets() {
  const sourceName = document.getElementById('merge-source-name').value;
  const targetSel = document.getElementById('merge-target-name');
  targetSel.innerHTML = getAllInvestigators().filter(n => n !== sourceName).map(n => `<option value="${n}">${n}</option>`).join('');
}

function openMergeInvestigator(name) {
  const allInvs = getAllInvestigators();
  const sourceSel = document.getElementById('merge-source-name');
  sourceSel.innerHTML = allInvs.map(n => `<option value="${n}">${n}</option>`).join('');
  
  if (name && typeof name === 'string') {
    sourceSel.value = name;
  } else if (allInvs.length > 0) {
    sourceSel.selectedIndex = 0;
  }
  
  updateMergeTargets();
  document.getElementById('merge-modal').classList.add('open');
}

async function confirmMergeInvestigator() {
  const sourceName = document.getElementById('merge-source-name').value;
  const targetName = document.getElementById('merge-target-name').value;
  if (!targetName || targetName === sourceName) { showToast('Choose a different target investigator.', true); return; }
  if (!confirm(`Move all cases from "${sourceName}" to "${targetName}" and remove "${sourceName}" from the list? This cannot be undone.`)) return;

  const affectedDocCodes1 = cases.filter(c => c.inv1 === sourceName).map(c => c.doc_code);
  const affectedDocCodes2 = cases.filter(c => c.inv2 === sourceName).map(c => c.doc_code);
  try {
    if (affectedDocCodes1.length) {
      const { error } = await supabaseClient.from('cases').update({inv1: targetName}).in('doc_code', affectedDocCodes1);
      if (error) throw error;
    }
    if (affectedDocCodes2.length) {
      const { error } = await supabaseClient.from('cases').update({inv2: targetName}).in('doc_code', affectedDocCodes2);
      if (error) throw error;
    }
  } catch (err) {
    showToast('Merge failed: ' + err.message, true);
    return;
  }
  const updated = affectedDocCodes1.length + affectedDocCodes2.length;

  try {
    // If the source investigator had a phone number and the target doesn't,
    // carry it over rather than losing it — matches the old behavior.
    const sourcePhone = INVESTIGATOR_PHONES[sourceName];
    const targetHasPhone = !!INVESTIGATOR_PHONES[targetName];
    if (sourcePhone && !targetHasPhone) {
      await updateInvestigatorPhoneDB(targetName, sourcePhone);
    }
    await removeInvestigatorDB(sourceName);
  } catch (err) {
    showToast('Cases merged, but removing the source investigator record failed: ' + err.message, true);
    await loadCasesFromDB();
    renderAll();
    return;
  }

  await Promise.all([loadCasesFromDB(), loadInvestigatorsFromDB()]);
  refreshInvestigatorDropdowns();
  closeModal('merge-modal');
  renderAll();
  showToast(`Merged "${sourceName}" into "${targetName}" — ${updated} case entries updated.`);
}

// ============================================================
// VOICE INPUT (Web Speech API — Chrome/Edge best support)
// ============================================================
let liveWs = null;
let inputAudioCtx = null;
let outputAudioCtx = null;
let audioProcessor = null;
let nextStartTime = 0;
let voiceActive = false;

function toggleVoiceFill() {
  if (voiceActive) {
    stopVoiceLive();
  } else {
    startVoiceLive();
  }
}

async function startVoiceLive() {
  const statusEl = document.getElementById('voice-status');
  const btn = document.getElementById('voice-fill-btn');
  
  try {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    liveWs = new WebSocket(`${protocol}//${location.host}/live`);
    
    liveWs.onopen = async () => {
      voiceActive = true;
      btn.textContent = '🔴 Stop Conversation';
      statusEl.textContent = 'Initializing microphone...';
      statusEl.style.color = 'var(--gold)';
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        inputAudioCtx = new AudioContext({ sampleRate: 16000 });
        outputAudioCtx = new AudioContext({ sampleRate: 24000 });
        nextStartTime = outputAudioCtx.currentTime;

        const source = inputAudioCtx.createMediaStreamSource(stream);
        audioProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
        
        source.connect(audioProcessor);
        audioProcessor.connect(inputAudioCtx.destination);
        
        audioProcessor.onaudioprocess = (e) => {
          if (liveWs && liveWs.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const base64 = pcmToBase64(inputData);
            liveWs.send(JSON.stringify({ audio: base64 }));
          }
        };
        
        statusEl.textContent = 'Voice assistant active! Talk to fill the form.';
        statusEl.style.color = 'var(--green)';
      } catch (err) {
        console.error('Mic error:', err);
        statusEl.textContent = '⚠ Mic access denied or error: ' + err.message;
        statusEl.style.color = 'var(--red)';
        stopVoiceLive();
      }
    };
    
    liveWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.audio) {
        playAudioChunk(msg.audio);
      }
      if (msg.interrupted) {
        // Interruption handling
        nextStartTime = outputAudioCtx.currentTime;
      }
      if (msg.toolCall) {
        handleLiveToolCall(msg.toolCall);
      }
    };
    
    liveWs.onclose = () => {
      stopVoiceLive();
    };
    
    liveWs.onerror = (err) => {
      console.error('WS Error:', err);
      stopVoiceLive();
    };
    
  } catch (err) {
    console.error('Live setup error:', err);
    statusEl.textContent = '⚠ Connection failed: ' + err.message;
    statusEl.style.color = 'var(--red)';
  }
}

function stopVoiceLive() {
  voiceActive = false;
  const btn = document.getElementById('voice-fill-btn');
  const statusEl = document.getElementById('voice-status');
  if (btn) btn.textContent = '🎤 Voice Fill';
  if (statusEl) {
    statusEl.textContent = 'Say things like "insured name Ramesh Kumar" or "fee one 300"';
    statusEl.style.color = 'var(--sub)';
  }

  if (audioProcessor) {
    audioProcessor.disconnect();
    audioProcessor = null;
  }
  if (inputAudioCtx) {
    inputAudioCtx.close();
    inputAudioCtx = null;
  }
  if (outputAudioCtx) {
    outputAudioCtx.close();
    outputAudioCtx = null;
  }
  if (liveWs) {
    liveWs.close();
    liveWs = null;
  }
}

function pcmToBase64(float32Array) {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    buffer[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7FFF;
  }
  return btoa(String.fromCharCode(...new Uint8Array(buffer.buffer)));
}

function playAudioChunk(base64) {
  if (!outputAudioCtx) return;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 0x7FFF;

  const buffer = outputAudioCtx.createBuffer(1, float32.length, 24000);
  buffer.getChannelData(0).set(float32);
  const source = outputAudioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(outputAudioCtx.destination);
  
  const startTime = Math.max(outputAudioCtx.currentTime, nextStartTime);
  source.start(startTime);
  nextStartTime = startTime + buffer.duration;
}

function handleLiveToolCall(toolCall) {
  if (toolCall.name === 'update_case_fields') {
    const args = toolCall.args;
    console.log('Gemini updating fields:', args);
    const statusEl = document.getElementById('voice-status');
    const updated = [];

    for (const [key, value] of Object.entries(args)) {
      const fieldId = 'f-' + key.replace('_', '');
      const el = document.getElementById(fieldId) || document.getElementById('f-' + key);
      if (el) {
        if (el.tagName === 'SELECT') {
           const options = Array.from(el.options).map(o => o.value || o.textContent);
           const best = options.find(o => o.toLowerCase() === String(value).toLowerCase());
           if (best) {
             el.value = best;
           } else {
             setSelectByClosestMatch(el.id, String(value));
           }
        } else {
          el.value = value;
        }
        updated.push(key);
      }
    }
    
    if (updated.length > 0) {
      calcTotal();
      updateHardcopy2Visibility();
      statusEl.textContent = `✓ Gemini updated: ${updated.join(', ')}`;
      statusEl.style.color = 'var(--green)';
    }
  }
}

function setSelectByClosestMatch(selectId, spokenValue) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const options = Array.from(el.options).map(o => o.value || o.textContent);
  let best = null, bestDist = 999;
  options.forEach(opt => {
    if (!opt) return;
    const d = levenshtein(spokenValue.toLowerCase(), opt.toLowerCase());
    if (d < bestDist) { bestDist = d; best = opt; }
  });
  if (best && bestDist <= Math.max(3, Math.ceil(spokenValue.length*0.3))) {
    el.value = best;
  }
}

function getSpeechRecognitionSupported() { return !!getSpeechRecognition(); }

function refreshInvestigatorDropdowns() {
  const rebuild = (id, withBlankOptions) => {
    const el = document.getElementById(id);
    const current = el.value;
    el.innerHTML = (withBlankOptions||[]).map(o=>`<option value="${o.value}">${o.label}</option>`).join('')
      + INVESTIGATORS.map(i => `<option>${escAttr(i)}</option>`).join('');
    el.value = current;
  };
  rebuild('filter-inv', [{value:'',label:'All Investigators'}]);
  rebuild('f-inv1', [{value:'',label:'-- Select --'}]);
  rebuild('f-inv2', [{value:'',label:'-- None --'},{value:'NA',label:'NA'}]);
  rebuild('report-target', []);
  rebuild('slip-inv', []);
}

// ============================================================
// BULK PASTE
// ============================================================
function openBulkPaste() {
  document.getElementById('bulk-input').value = '';
  document.getElementById('bulk-preview').textContent = '';
  document.getElementById('bulk-modal').classList.add('open');
}

function parseBulkLine(line) {
  const p = line.split('\t');
  if (p.length < 4) return null; // fallback: also try comma if too few tab fields
  return p;
}

function cleanNum(v) {
  if (!v) return 0;
  const n = parseFloat(v.toString().replace(/[₹,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ============================================================
// SHARED: Levenshtein distance for typo/near-duplicate detection
// ============================================================
function levenshtein(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for (let i=0;i<=m;i++) dp[i][0]=i;
  for (let j=0;j<=n;j++) dp[0][j]=j;
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++) {
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  }
  return dp[m][n];
}
function findClosestInvestigator(name) {
  if (!name) return null;
  const known = getAllInvestigators();
  const typed = name.trim().toLowerCase();
  const typedWords = typed.split(/\s+/).filter(Boolean);

  // PASS 1: partial-name match — typed text is an incomplete first/last name
  // (e.g. "RAHUL" or "CHOUKSEY" typed for "RAHUL CHOUKSEY"). Plain Levenshtein
  // fails here because dropping half the name inflates edit distance past
  // any sane threshold. We match whole words against whole words instead.
  let partialCandidates = [];
  known.forEach(k => {
    const kWords = k.toLowerCase().split(/\s+/).filter(Boolean);
    const allTypedWordsMatch = typedWords.every(tw =>
      kWords.some(kw => kw.startsWith(tw) || tw.startsWith(kw))
    );
    if (allTypedWordsMatch && typed.length >= 3) {
      partialCandidates.push(k);
    }
  });
  if (partialCandidates.length === 1) {
    return {match: partialCandidates[0], dist: 0, partial: true};
  }
  if (partialCandidates.length > 1) {
    // Ambiguous partial match (e.g. "DEEPAK" -> DEEPAK NARWAL / RATHORE / YADAV).
    // Don't guess — flag as ambiguous so the UI forces a manual choice instead
    // of silently picking the wrong Deepak.
    return {match: null, ambiguous: partialCandidates, dist: 0, partial: true};
  }

  // PASS 1.5: fuzzy word-set match — handles combined cases the above passes
  // miss individually: a missing filler word (KUMAR, SINGH, etc.) PLUS a
  // spelling variation in another word at the same time.
  // e.g. "JITENDRA BHAHOTE" vs "JITENDRA KUMAR BAHOTE" — word count differs
  // AND "BHAHOTE"/"BAHOTE" aren't prefixes of each other, so Pass 1 misses it;
  // whole-string Levenshtein also misses it because "KUMAR " misplaces every
  // character after it. Matching word-by-word with per-word Levenshtein
  // sidesteps both problems.
  if (typedWords.length >= 2) {
    let fuzzyCandidates = [];
    known.forEach(k => {
      const kWords = k.toLowerCase().split(/\s+/).filter(Boolean);
      // every typed word must fuzzy-match SOME word in the known name
      // (small edit distance relative to word length, or prefix match)
      let matchedCount = 0;
      typedWords.forEach(tw => {
        const hit = kWords.some(kw => {
          if (kw.startsWith(tw) || tw.startsWith(kw)) return true;
          const d = levenshtein(tw, kw);
          return d <= Math.max(1, Math.floor(Math.min(tw.length, kw.length) * 0.3));
        });
        if (hit) matchedCount++;
      });
      // require ALL typed words to have matched something (order-independent),
      // and the known name shouldn't have far more extra words than typed
      // (otherwise "RAHUL" alone would fuzzy-match half the list)
      if (matchedCount === typedWords.length && kWords.length <= typedWords.length + 2) {
        fuzzyCandidates.push(k);
      }
    });
    if (fuzzyCandidates.length === 1) {
      return {match: fuzzyCandidates[0], dist: 0, partial: true, fuzzy: true};
    }
    if (fuzzyCandidates.length > 1) {
      return {match: null, ambiguous: fuzzyCandidates, dist: 0, partial: true, fuzzy: true};
    }
  }

  // PASS 2: typo match via edit distance (existing behavior)
  let best = null, bestDist = 999;
  known.forEach(k => {
    const d = levenshtein(name, k);
    if (d < bestDist) { bestDist = d; best = k; }
  });
  // Only suggest if reasonably close (allow ~25% of length as edit distance)
  if (best && bestDist > 0 && bestDist <= Math.max(2, Math.ceil(name.length*0.25))) return {match:best, dist:bestDist};
  return null;
}

function findClosestCompany(name) {
  if (!name) return null;
  let best = null, bestDist = 999;
  COMPANIES.forEach(k => {
    const d = levenshtein(name, k);
    if (d < bestDist) { bestDist = d; best = k; }
  });
  if (best && bestDist > 0 && bestDist <= Math.max(2, Math.ceil(name.length*0.25))) return {match:best, dist:bestDist};
  return null;
}

// ============================================================
// SHARED: build a parsed row list from bulk-paste text
// ============================================================
function parseBulkPasteRows(raw) {
  const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const firstLineNorm = (lines[0] || '').toLowerCase();
  const hasHeader = firstLineNorm.includes('claim') || firstLineNorm.includes('company') || firstLineNorm.includes('insured') || firstLineNorm.includes('policy');
  if (hasHeader) {
    return parseCsvRows(raw);
  }

  const existingClaims = new Set(cases.map(c => c.claim_no));
  const seenInThisBatch = new Set(); // claim numbers already used earlier in this same paste
  const rows = [];
  lines.forEach(line => {
    let parts = line.split('\t');
    if (parts.length < 4) parts = line.split(',');
    parts = parts.map(p => (p||'').trim());
    const company=parts[0], date=parts[1], case_type=parts[2], claim_no=parts[3], policy_no=parts[4],
          insured_name=parts[5], hospital=parts[6], inv1=parts[7], location=parts[8], inv2=parts[9],
          fee1=parts[10], fee2=parts[11], ta1=parts[12], ta2=parts[13],
          received=parts[15], invoice_no=parts[16],
          inv1_status=parts[18], inv2_status=parts[19], remarks=parts[20];
    
    let outcome = 'Pending';
    let invoice_amount = null;
    if (parts[21]) {
      const p21Norm = parts[21].toLowerCase();
      const validOutcomes = ['pending','genuine','fraud','suspicious','not found','settled','repudiated','rejected'];
      if (validOutcomes.some(vo => p21Norm.includes(vo))) {
        outcome = parts[21];
      }
    }
    if (parts[22] && !Number.isNaN(cleanNum(parts[22])) && cleanNum(parts[22]) > 0) {
      invoice_amount = cleanNum(parts[22]);
    } else if (parts[17] && !Number.isNaN(cleanNum(parts[17])) && cleanNum(parts[17]) > 0 && parts.length > 20) {
      invoice_amount = cleanNum(parts[17]);
    }
          
    if (!claim_no || !company || !insured_name) { rows.push({error:'Missing required field (claim/company/insured name)', raw:line}); return; }
    
    // STRICT VALIDATION FOR COMPANY AND CASE TYPE
    const compUpper = company.toUpperCase();
    const cTypeUpper = (case_type||'').toUpperCase();
    if (!COMPANIES.includes(compUpper)) {
      rows.push({error:`Invalid Company: "${company}". Add it in Settings first.`, raw:line});
      return;
    }
    if (case_type && !CASE_TYPES.includes(cTypeUpper)) {
      rows.push({error:`Invalid Case Type: "${case_type}". Add it in Settings first.`, raw:line});
      return;
    }

    let useDate = date || new Date().toISOString().slice(0,10);
    const dm = useDate.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dm) useDate = `${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
    const f1 = cleanNum(fee1), f2 = cleanNum(fee2), t1 = cleanNum(ta1), t2 = cleanNum(ta2);
    const rec = cleanNum(received);
    // A claim is a duplicate if it already exists in the DB, OR if an earlier
    // row in this same paste already used it — without the second check, two
    // identical claim_no rows in one paste both look "safe" individually, but
    // the batch insert fails on the DB's unique constraint and NONE of the
    // rows get added (not just the duplicate one).
    const dupInDB = existingClaims.has(claim_no);
    const dupInBatch = !dupInDB && seenInThisBatch.has(claim_no);
    seenInThisBatch.add(claim_no);
    rows.push({
      isDuplicate: dupInDB || dupInBatch,
      duplicateReason: dupInDB ? 'existing' : (dupInBatch ? 'batch' : null),
      company: compUpper, date: useDate, case_type: cTypeUpper, claim_no, policy_no: policy_no||'',
      insured_name, hospital: hospital||'', location: location||'', inv1: inv1||'', inv2: inv2||'',
      fee1: f1, fee2: f2, ta1: t1, ta2: t2, total_payable: f1+f2+t1+t2, received: rec,
      invoice_no: invoice_no||'', invoice_amount: invoice_amount || null, outcome: outcome || 'Pending',
      profit: rec-(f1+f2+t1+t2),
      inv1_status: (inv1_status==='Paid'||inv1_status==='Pending') ? inv1_status : '',
      inv2_status: (inv2_status==='Paid'||inv2_status==='Pending') ? inv2_status : '',
      remarks: remarks||''
    });
  });
  return rows;
}

// ============================================================
// SHARED: build parsed row list from CSV file text
// ============================================================
function parseCsvRows(text) {
  function parseCsvLine(line) {
    if (line.includes('\t')) {
      return line.split('\t').map(x => x.replace(/^"|"$/g, '').trim());
    }
    const out = []; let cur=''; let inQ=false;
    for (let i=0;i<line.length;i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { out.push(cur); cur=''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }
  const rawRows = text.split(/\r?\n/).filter(l=>l.trim()!=='').map(parseCsvLine);
  if (!rawRows.length) return [];
  const header = rawRows[0].map(h => h.trim().toLowerCase());
  const colMap = {
    company: ['company','company name','client','insurance company'], date: ['date','allocation date','assigned date'],
    case_type: ['case_type','case type','type'], claim_no: ['claim_no','claim no','claim no.','claim','claim number','claim id'],
    policy_no: ['policy_no','policy no','policy no.','policy','policy number'], insured_name: ['insured_name','insured name','insured','patient name','customer name','name'],
    hospital: ['hospital','hospital / address','hospital/address','hospital name'], location: ['location','insured location','city','place'],
    inv1: ['inv1','investigator 1','investigator1','inv 1','field investigator'], inv2: ['inv2','investigator 2','investigator2','inv 2'],
    fee1: ['fee1','payment fee 1','payment (fee)','inv1 fee','fee 1'], fee2: ['fee2','payment fee 2','inv2 fee','fee 2'],
    ta1: ['ta1','other expense','other expense 1','other expense 1 (inv1 ta)','ta 1','ta/expense 1','inv1 ta'],
    ta2: ['ta2','other expense 2','other expense 2 (inv2 ta)','ta 2','ta/expense 2','inv2 ta'],
    received: ['received','payment received','amount received','received amount','amount paid'],
    invoice_no: ['invoice_no','invoice no','invoice no.','inv no','inv no.','invoice #','bill no','bill no.'],
    invoice_amount: ['invoice_amount','invoice amount','invoice amt','inv amt','inv amount','billed','bill amount','billed amount','invoice value'],
    outcome: ['outcome','investigation outcome','investigation_outcome','case outcome','status outcome','finding','decision','result'],
    inv1_status: ['inv1_status','inv1 status','inv1 pay status'], inv2_status: ['inv2_status','inv2 status','inv2 pay status'],
    remarks: ['remarks','remark','comment','comments','notes']
  };
  
  if (window.CUSTOM_FIELDS && window.CUSTOM_FIELDS.length > 0) {
      window.CUSTOM_FIELDS.forEach(cf => {
          colMap['custom_' + cf.id] = [cf.name.toLowerCase()];
      });
  }

  const idx = {};
  Object.keys(colMap).forEach(f => { idx[f] = -1; for (const name of colMap[f]) { const i = header.indexOf(name); if (i>=0) { idx[f]=i; break; } } });
  const existingClaims = new Set(cases.map(c => c.claim_no));
  const seenInThisBatch = new Set();
  const rows = [];
  for (let i=1; i<rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length < 2) continue;
    const get = (f) => idx[f]>=0 ? (r[idx[f]]||'').toString().trim() : '';
    const claim = get('claim_no');
    if (!claim) continue;
    const company = get('company'), insured_name = get('insured_name');
    if (!company || !insured_name) { rows.push({error:'Missing company or insured name', raw:r.join(', ')}); continue; }
    
    const compUpper = company.toUpperCase();
    const case_type = get('case_type');
    const cTypeUpper = (case_type||'').toUpperCase();
    if (!COMPANIES.includes(compUpper)) {
      rows.push({error:`Invalid Company: "${company}". Add it in Settings first.`, raw:r.join(', ')});
      continue;
    }
    if (case_type && !CASE_TYPES.includes(cTypeUpper)) {
      rows.push({error:`Invalid Case Type: "${case_type}". Add it in Settings first.`, raw:r.join(', ')});
      continue;
    }

    let date = get('date') || new Date().toISOString().slice(0,10);
    const dm = date.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dm) date = `${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
    const fee1 = cleanNum(get('fee1')), fee2 = cleanNum(get('fee2'));
    const ta1 = cleanNum(get('ta1')), ta2 = cleanNum(get('ta2'));
    const received = cleanNum(get('received'));
    const invoice_amount = cleanNum(get('invoice_amount')) || null;
    const outcome = get('outcome') || 'Pending';
    
    let custom_data = {};
    let hasCustomData = false;
    if (window.CUSTOM_FIELDS) {
        window.CUSTOM_FIELDS.forEach(cf => {
            const val = get('custom_' + cf.id);
            if (val) {
                custom_data[cf.id] = cf.type === 'number' ? cleanNum(val) : val;
                hasCustomData = true;
            }
        });
    }

    // See parseBulkPasteRows for why the same-batch check matters — a
    // duplicate claim within one import batch fails the entire insert, not
    // just that row, if it isn't caught here first.
    const dupInDB = existingClaims.has(claim);
    const dupInBatch = !dupInDB && seenInThisBatch.has(claim);
    seenInThisBatch.add(claim);
    rows.push({
      isDuplicate: dupInDB || dupInBatch,
      duplicateReason: dupInDB ? 'existing' : (dupInBatch ? 'batch' : null),
      company: compUpper, date, case_type: cTypeUpper, claim_no: claim, policy_no: get('policy_no'),
      insured_name, hospital: get('hospital'), location: get('location'),
      inv1: get('inv1'), inv2: get('inv2'),
      fee1, fee2, ta1, ta2, total_payable: fee1+fee2+ta1+ta2, received,
      invoice_no: get('invoice_no'), invoice_amount, outcome,
      profit: received-(fee1+fee2+ta1+ta2),
      inv1_status: get('inv1_status'), inv2_status: get('inv2_status'), remarks: get('remarks'),
      custom_data: hasCustomData ? custom_data : null
    });
  }
  return rows;
}

// ============================================================
// SHARED PREVIEW SCREEN
// ============================================================
let pendingImportRows = [];
function showImportPreview(rows, sourceLabel) {
  pendingImportRows = rows;
  const errorRows = rows.filter(r => r.error);
  const dupRows = rows.filter(r => !r.error && r.isDuplicate);
  const validRows = rows.filter(r => !r.error && !r.isDuplicate);

  const knownLower = new Set(getAllInvestigators().map(x=>x.toLowerCase()));
  const unmatchedNames = new Map(); // name -> suggestion

  validRows.forEach(r => {
    [r.inv1, r.inv2].forEach(n => {
      if (!n || n==='NA') return;
      if (knownLower.has(n.toLowerCase())) return;
      if (unmatchedNames.has(n)) return;
      unmatchedNames.set(n, findClosestInvestigator(n));
    });
  });

  const companyLower = new Set(COMPANIES.map(x=>x.toLowerCase()));
  const unmatchedCompanies = new Map();
  validRows.forEach(r => {
    if (!r.company) return;
    if (companyLower.has(r.company.toLowerCase())) return;
    if (unmatchedCompanies.has(r.company)) return;
    unmatchedCompanies.set(r.company, findClosestCompany(r.company));
  });

  const caseTypeLower = new Set(CASE_TYPES.map(x=>x.toLowerCase()));
  const unmatchedCaseTypes = new Set();
  validRows.forEach(r => {
    if (r.case_type && !caseTypeLower.has(r.case_type.toLowerCase())) unmatchedCaseTypes.add(r.case_type);
  });

  let html = `<div class="notice" style="background:var(--green-bg);border-left-color:var(--green);color:#1a5c3a;">
    Source: ${sourceLabel} · <b>${validRows.length}</b> ready to add, <b>${dupRows.length}</b> duplicate claim no. (will be skipped), <b>${errorRows.length}</b> rows with missing required fields.
  </div>`;

  if (unmatchedNames.size) {
    const allInv = getAllInvestigators();
    // Shared datalist of all known investigators — reused by every row's search input
    // so the browser's native type-to-filter handles the 80+ name list instead of scrolling.
    html += `<datalist id="known-inv-list">${allInv.map(inv => `<option value="${inv.replace(/"/g,'&quot;')}">`).join('')}</datalist>`;
    html += `<div class="notice" style="background:var(--amber-bg);border-left-color:var(--amber);">
      <b>${unmatchedNames.size} investigator name(s) not in your list.</b> Start typing in the box to search and map any you want — leave the rest blank and confirm whenever you're ready. Nothing here is required.
    </div>`;
    html += `<div style="max-height:320px;overflow-y:auto;border:1px solid var(--line);border-radius:4px;margin-bottom:14px;">
      <table style="width:100%;"><thead><tr><th>Name in Data</th><th>Map to (optional — type to search)</th></tr></thead><tbody>`;
    let i=0;
    unmatchedNames.forEach((sugg, name) => {
      const safeName = name.replace(/'/g,"\\'");
      const suggestedMatch = (sugg && !sugg.ambiguous) ? sugg.match : '';
      html += `<tr>
        <td class="mono">${name}</td>
        <td>
          <input type="text" id="inv-resolve-${i}" data-original="${safeName}" list="known-inv-list"
            value="${suggestedMatch.replace(/"/g,'&quot;')}"
            placeholder="Type to search, or leave blank to keep &quot;${name}&quot; as typed"
            oninput="checkInvResolveInput(this, '${safeName}')"
            style="font-size:11px;padding:4px;width:100%;max-width:320px;box-sizing:border-box;">
          <div id="inv-resolve-${i}-hint" style="font-size:10px;color:var(--sub);margin-top:2px;">${suggestedMatch ? 'Suggested — clear the box to keep as typed instead' : ''}</div>
        </td>
      </tr>`;
      i++;
    });
    html += `</tbody></table></div>`;
  }

  if (unmatchedCompanies.size) {
    html += `<div class="notice" style="background:var(--amber-bg);border-left-color:var(--amber);">
      <b>${unmatchedCompanies.size} company name(s) not in your list.</b> These will be saved as typed unless you pick a match below.
    </div>`;
    html += `<div style="max-height:180px;overflow-y:auto;border:1px solid var(--line);border-radius:4px;margin-bottom:14px;">
      <table style="width:100%;"><thead><tr><th>Company in Data</th><th>Suggestion</th><th>Action</th></tr></thead><tbody>`;
    let ci=0;
    unmatchedCompanies.forEach((sugg, name) => {
      const safeName = name.replace(/'/g,"\\'");
      html += `<tr>
        <td class="mono">${name}</td>
        <td>${sugg ? `<span class="badge pending">${sugg.match}</span>` : '<span class="badge na">No close match</span>'}</td>
        <td>
          <select id="company-resolve-${ci}" style="font-size:11px;padding:4px;" data-original="${safeName}">
            ${sugg ? `<option value="use:${sugg.match}">Use "${sugg.match}" instead</option>` : ''}
            <option value="new" ${!sugg?'selected':''}>Keep as typed "${name}"</option>
          </select>
        </td>
      </tr>`;
      ci++;
    });
    html += `</tbody></table></div>`;
  }

  if (unmatchedCaseTypes.size) {
    html += `<div class="notice" style="background:var(--amber-bg);border-left-color:var(--amber);">
      <b>⚠ Case Type not in your standard list:</b> ${Array.from(unmatchedCaseTypes).join(', ')}.
      These rows will still be added with the case type as typed — but they won't show up correctly in Dashboard/Reports which group by the standard list (${CASE_TYPES.join(', ')}). Fix the spelling in your source data and re-import, or edit these cases individually after import.
    </div>`;
  }

  html += `<div style="max-height:280px;overflow-y:auto;border:1px solid var(--line);border-radius:4px;">
    <table style="width:100%;"><thead><tr><th>Claim No</th><th>Company</th><th>Insured</th><th>INV1</th><th>INV2</th><th>Inv Amt</th><th>Payable</th><th>Recv</th><th>Outcome</th><th>Status</th></tr></thead><tbody>
    ${rows.slice(0,300).map(r => {
      if (r.error) return `<tr style="background:var(--red-bg);"><td colspan="10">⚠ ${r.error} — <span class="mono">${(r.raw||'').slice(0,80)}</span></td></tr>`;
      const rowStatus = r.isDuplicate
        ? (r.duplicateReason === 'batch'
            ? '<span class="badge overdue">Duplicate in this paste — skip</span>'
            : '<span class="badge overdue">Already exists — skip</span>')
        : '<span class="badge paid">Will add</span>';
      return `<tr><td class="mono">${escAttr(r.claim_no)}</td><td>${escAttr(r.company)}</td><td>${escAttr(r.insured_name)}</td><td>${escAttr(r.inv1||'')}</td><td>${escAttr(r.inv2||'')}</td><td>${r.invoice_amount ? 'Rs '+fmt(r.invoice_amount) : '—'}</td><td>Rs ${fmt(r.total_payable)}</td><td>${r.received ? 'Rs '+fmt(r.received) : '—'}</td><td>${outcomeBadge(r.outcome||'Pending')}</td><td>${rowStatus}</td></tr>`;
    }).join('')}
  </tbody></table></div>`;
  if (rows.length > 300) html += `<div style="text-align:center;color:var(--sub);font-size:11px;padding:8px;">+${rows.length-300} more rows not shown in preview (all will still be processed)</div>`;

  document.getElementById('preview-body').innerHTML = html;
  document.getElementById('preview-confirm-btn').onclick = commitImportPreview;
  document.getElementById('preview-modal').classList.add('open');
}

// Live feedback under the investigator search box — confirms an exact match,
// or warns that unmatched text will simply fall back to the original typed name.
function checkInvResolveInput(input, originalName) {
  const hint = document.getElementById(input.id + '-hint');
  const typed = input.value.trim();
  if (!typed) { hint.textContent = ''; hint.style.color = 'var(--sub)'; return; }
  const known = getAllInvestigators();
  const exact = known.find(n => n.toLowerCase() === typed.toLowerCase());
  if (exact) {
    hint.textContent = `✓ Will map to "${exact}"`;
    hint.style.color = 'var(--green)';
  } else {
    hint.textContent = `Not an exact match — will keep "${originalName}" as typed unless you pick a name from the list`;
    hint.style.color = 'var(--amber)';
  }
}

async function commitImportPreview() {
  const rows = pendingImportRows;
  const btn = document.getElementById('preview-confirm-btn');

  // Resolve investigator name decisions from the preview UI. The search box
  // defaults to blank (or a pre-filled suggestion) — nothing is forced, and
  // the user can leave any or all of them untouched and Confirm still works.
  // Only an exact (case-insensitive) match against a known investigator maps;
  // anything else — blank, partial text, a typo — falls back to keeping the
  // row's original typed name, so a half-finished search never corrupts data.
  const knownInvLower = new Map(getAllInvestigators().map(x => [x.toLowerCase(), x]));
  const nameResolution = {}; // original -> final name to use
  document.querySelectorAll('[id^="inv-resolve-"]').forEach(input => {
    const original = input.dataset.original;
    const typed = input.value.trim();
    const exactMatch = typed ? knownInvLower.get(typed.toLowerCase()) : null;
    nameResolution[original] = exactMatch || original;
  });
  const resolveName = (n) => {
    if (!n || n==='NA') return n||'';
    return nameResolution[n] !== undefined ? nameResolution[n] : n;
  };

  const companyResolution = {};
  document.querySelectorAll('[id^="company-resolve-"]').forEach(sel => {
    const original = sel.dataset.original;
    const val = sel.value;
    companyResolution[original] = val.startsWith('use:') ? val.slice(4) : original;
  });
  const resolveCompany = (n) => {
    if (!n) return '';
    return companyResolution[n] !== undefined ? companyResolution[n] : n;
  };

  const validRows = rows.filter(r => !r.error && !r.isDuplicate);
  const skipped = rows.filter(r => r.isDuplicate).length;
  const errors = rows.filter(r => r.error).length;

  if (!validRows.length) {
    closeModal('preview-modal');
    closeModal('bulk-modal');
    showToast(`Nothing to add. ${skipped} duplicates skipped, ${errors} invalid rows.`, true);
    pendingImportRows = [];
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Adding cases…';

  // Doc codes must be assigned sequentially (each depends on the DB counter
  // state) so this loop awaits one at a time rather than firing them all in
  // parallel — that would let two rows race for the same sequence number.
  const genuinelyNew = new Set();
  const toInsert = [];
  const localMonthCounters = {};
  try {
    for (const r of validRows) {
      const inv1 = resolveName(r.inv1), inv2 = resolveName(r.inv2);
      const company = resolveCompany(r.company);
      
      const { code: monthCode } = parseDateComponents(r.date);
      
      let doc_code;
      if (localMonthCounters[monthCode]) {
        localMonthCounters[monthCode]++;
        doc_code = `${monthCode}-${String(localMonthCounters[monthCode]).padStart(4, '0')}`;
      } else {
        doc_code = await genDocCodeDB(r.date);
        const match = doc_code.match(/-(\d+)$/);
        localMonthCounters[monthCode] = match ? parseInt(match[1], 10) : 1;
      }

      toInsert.push({
        doc_code, company, date: r.date, case_type: r.case_type, claim_no: r.claim_no,
        policy_no: r.policy_no, insured_name: r.insured_name, hospital: r.hospital, location: r.location,
        inv1, inv2, fee1: r.fee1, fee2: r.fee2, ta1: r.ta1, ta2: r.ta2,
        received: r.received, invoice_no: r.invoice_no,
        invoice_amount: r.invoice_amount || null,
        outcome: r.outcome || 'Pending',
        inv1_status: r.inv1_status, inv2_status: r.inv2_status, remarks: r.remarks,
        custom_data: r.custom_data || null
      });
      [inv1, inv2].forEach(n => {
        if (n && n!=='NA' && !getAllInvestigators().some(x=>x.toLowerCase()===n.toLowerCase())) genuinelyNew.add(n);
      });
    }

    const { error } = await supabaseClient.from('cases').insert(toInsert);
    if (error) {
      if (error.code === '23505' || String(error.message).includes('uq_cases_company_claim') || String(error.message).includes('duplicate key')) {
        console.warn('[Import] Batch hit duplicate constraint, recovering row-by-row...');
        for (const item of toInsert) {
          const { data: existing } = await supabaseClient.from('cases').select('id, doc_code').eq('company', item.company).eq('claim_no', item.claim_no).maybeSingle();
          if (existing) {
            await supabaseClient.from('cases').update(item).eq('doc_code', existing.doc_code);
          } else {
            await supabaseClient.from('cases').insert([item]);
          }
        }
      } else {
        throw error;
      }
    }

    if (typeof recordBatchSnapshot === 'function' && toInsert.length) {
      recordBatchSnapshot({
        action: `Import / Bulk Paste: added ${toInsert.length} cases`,
        type: 'insert',
        docCodes: toInsert.map(c => c.doc_code)
      });
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Confirm & Add';
    showToast('Import failed: ' + err.message, true);
    return;
  }

  if (genuinelyNew.size) {
    try {
      await Promise.all(Array.from(genuinelyNew).map(n => insertInvestigatorDB(n)));
    } catch (err) {
      showToast('Cases added, but registering new investigator(s) failed: ' + err.message, true);
    }
  }
  if (window.logActivity) window.logActivity('Cases', `imported ${toInsert.length} cases`); await loadInvestigatorsFromDB();
  refreshInvestigatorDropdowns();

  await loadCasesFromDB();
  renderAll();
  closeModal('preview-modal');
  closeModal('bulk-modal');
  btn.disabled = false;
  btn.textContent = 'Confirm & Add';
  showToast(`Added ${toInsert.length} cases. (Undo available in Rollback Log). ${skipped} duplicates skipped, ${errors} invalid rows.`);
  pendingImportRows = [];
}

function processBulkPaste() {
  const raw = document.getElementById('bulk-input').value.trim();
  if (!raw) return;
  const rows = parseBulkPasteRows(raw);
  showImportPreview(rows, 'Bulk Paste');
}

// ============================================================
// EXCEL IMPORT (CSV)
// ============================================================
function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      if (!file.name.endsWith('.csv')) {
        showToast('For .xlsx files, please export as CSV first (File > Save As > CSV) and import that.', true);
        return;
      }
      const rows = parseCsvRows(evt.target.result);
      showImportPreview(rows, `File: ${file.name}`);
    } catch(err) {
      showToast('Import failed: ' + err.message, true);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ============================================================
// ALERTS — 45 day pending
// ============================================================
function checkOverdueAlerts() {
  const now = new Date();
  const overdue = cases.filter(c => {
    if (!c.date) return false;
    const days = (now - new Date(c.date)) / (1000*60*60*24);
    const pending = (c.inv1 && c.inv1!=='NA' && c.inv1_status!=='Paid') || (c.inv2 && c.inv2!=='NA' && c.inv2_status!=='Paid');
    return days > 45 && pending;
  });
  document.getElementById('notif-dot').style.display = overdue.length ? 'block' : 'none';
  document.getElementById('notif-list').innerHTML = overdue.length
    ? overdue.slice(0,30).map(c => {
        const days = Math.floor((now - new Date(c.date))/(1000*60*60*24));
        return `<div class="notif-item"><div class="t">${c.doc_code} — ${days} days pending</div><div class="d">${c.insured_name} · ${c.company} · ${c.inv1}${c.inv2 && c.inv2!=='NA' ? ' + '+c.inv2 : ''}</div></div>`;
      }).join('')
    : '<div class="notif-item"><div class="d">No cases pending over 45 days.</div></div>';
}

function toggleNotif() {
  document.getElementById('notif-panel').classList.toggle('open');
}

// ============================================================
// REPORTS
// ============================================================
function onReportTypeChange() {
  const type = document.getElementById('report-type').value;
  const wrap = document.getElementById('report-target-wrap');
  if (type === 'investigator') {
    wrap.style.display = '';
    wrap.querySelector('label').textContent = 'Select Investigator';
    wrap.querySelector('select').innerHTML = INVESTIGATORS.map(i => `<option>${escAttr(i)}</option>`).join('');
  } else if (type === 'company') {
    wrap.style.display = '';
    wrap.querySelector('label').textContent = 'Select Company';
    wrap.querySelector('select').innerHTML = COMPANIES.map(c => `<option>${escAttr(c)}</option>`).join('');
  } else {
    wrap.style.display = 'none';
  }
}

async function generateReport() {
  const type = document.getElementById('report-type').value;
  const target = document.getElementById('report-target').value;
  let html = '', title = '', reportRows = [];

  if (type === 'investigator') {
    reportRows = cases.filter(c => c.inv1===target || c.inv2===target);
    const stats = computeInvStats(target, cases);
    title = `Investigator Statement — ${target}`;
    html = buildReportHTML(title, [
      `Total Cases: ${stats.totalCases}`, `Paid: ${stats.paidCases}`, `Pending: ${stats.pendingCases}`,
      `Total Payable: Rs ${fmt(stats.totalPayable)}`, `Paid: Rs ${fmt(stats.paidAmt)}`, `Pending: Rs ${fmt(stats.pendingAmt)}`
    ], reportRows);
  } else if (type === 'company') {
    reportRows = cases.filter(c => c.company===target);
    const payable = reportRows.reduce((s,c)=>s+(c.total_payable||0),0);
    const received = reportRows.reduce((s,c)=>s+(c.received||0),0);
    title = `Company Report — ${target}`;
    html = buildReportHTML(title, [
      `Total Cases: ${reportRows.length}`, `Total Payable: Rs ${fmt(payable)}`, `Total Received: Rs ${fmt(received)}`
    ], reportRows);
  } else {
    const mo = MONTHS[activeMonth];
    reportRows = cases.filter(c => {
      if (!c.date) return false;
      const d = new Date(c.date);
      return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y;
    });
    title = `Monthly Summary — ${mo.label}`;
    const payable = reportRows.reduce((s,c)=>s+(c.total_payable||0),0);
    html = buildReportHTML(title, [`Total Cases: ${reportRows.length}`, `Total Payable: Rs ${fmt(payable)}`], reportRows);
  }

  if (reportRows.length === 0) {
    showToast(`No cases found for ${target || 'this period'}. Check your filters.`, true);
    return;
  }
  
  openPDFPreview(html, `${title.replace(/\s+/g, '_')}.pdf`, { orientation: 'landscape' });
}

function buildReportHTML(title, summaryLines, rows) {
  const s = settings;
  return `
    <style>tr { page-break-inside: avoid; }</style>
    <div style="font-family:'Segoe UI',Arial,sans-serif;padding:30px;max-width:1050px;margin:0 auto;box-sizing:border-box;background:#fff;color:#1B2530;">
      <table style="width:100%; border-bottom:3px solid #B8862E; margin-bottom:22px; padding-bottom:18px;">
        <tr>
          <td style="vertical-align:middle;">
            <div style="display:flex;align-items:center;gap:14px;">
              ${s.logo ? `<img src="${s.logo}" style="height:56px;">` : ''}
              <div>
                <div style="font-size:19px;font-weight:700;color:#0F2942;letter-spacing:0.3px;">${s.agencyName}</div>
                <div style="font-size:10.5px;color:#657486;margin-top:2px;">${s.agencyAddress||''}</div>
              </div>
            </div>
          </td>
          <td style="vertical-align:bottom; text-align:right;">
            <div style="font-size:9px;color:#B8862E;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Report Statement</div>
            <div style="font-size:10px;color:#657486;margin-top:3px;">${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</div>
          </td>
        </tr>
      </table>

      <h2 style="color:#0F2942;font-size:15px;margin-bottom:10px;">${title}</h2>
      <div style="font-size:12px;color:#333;margin-bottom:16px;">${summaryLines.join(' &nbsp;|&nbsp; ')}</div>

      <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
        <thead>
          <tr style="background:#0F2942;color:#fff;">
            <th style="padding:6px;text-align:left;">Doc Code</th><th style="padding:6px;text-align:left;">Date</th>
            <th style="padding:6px;text-align:left;">Claim No</th><th style="padding:6px;text-align:left;">Insured</th>
            <th style="padding:6px;text-align:left;">INV1</th><th style="padding:6px;text-align:left;">INV2</th>
            <th style="padding:6px;text-align:right;">Payable</th><th style="padding:6px;text-align:right;">Received</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(c => `<tr style="border-bottom:1px solid #ddd;">
            <td style="padding:5px;">${c.doc_code||''}</td><td style="padding:5px;">${c.date||''}</td>
            <td style="padding:5px;">${c.claim_no||''}</td><td style="padding:5px;">${c.insured_name||''}</td>
            <td style="padding:5px;">${c.inv1||''}</td><td style="padding:5px;">${c.inv2||''}</td>
            <td style="padding:5px;text-align:right;">${fmt(c.total_payable)}</td><td style="padding:5px;text-align:right;">${fmt(c.received)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="margin-top:30px;font-size:10px;color:#999;">Generated securely via DNA Payments Dashboard &bull; ${new Date().toLocaleDateString('en-IN')}</div>
    </div>`;
}

// ============================================================
// PAYMENT SLIP
// ============================================================
// ============================================================
// BULK SEND ALL SLIPS (queue-based, one WhatsApp chat at a time)
// ============================================================
let slipQueue = [];
let slipQueueIdx = 0;

function buildBulkSlipSummary() {
  const monthCode = document.getElementById('bulk-slip-month').value;
  const mo = MONTHS.find(m => m.code === monthCode);
  if (!mo) return;
  const withNumber = [], withoutNumber = [];
  INVESTIGATORS.forEach(name => {
    const monthCases = cases.filter(c => {
      if (!c.date) return false;
      const d = new Date(c.date);
      return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y && (c.inv1===name || c.inv2===name);
    });
    if (!monthCases.length) return;
    if (INVESTIGATOR_PHONES[name]) withNumber.push(name); else withoutNumber.push(name);
  });
  const summaryEl = document.getElementById('bulk-slip-summary');
  summaryEl.innerHTML = `<b>${withNumber.length}</b> investigator(s) ready to send (have cases + saved number) this month.` +
    (withoutNumber.length ? `<br><span style="color:var(--red);">${withoutNumber.length} investigator(s) have cases this month but no saved number: ${withoutNumber.join(', ')}</span>` : '');
}

function startBulkSlipSend() {
  const monthCode = document.getElementById('bulk-slip-month').value;
  const mo = MONTHS.find(m => m.code === monthCode);
  if (!mo) return;

  slipQueue = [];
  INVESTIGATORS.forEach(name => {
    const monthCases = cases.filter(c => {
      if (!c.date) return false;
      const d = new Date(c.date);
      return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y && (c.inv1===name || c.inv2===name);
    });
    if (monthCases.length && INVESTIGATOR_PHONES[name]) {
      slipQueue.push({name, mo, monthCases});
    }
  });

  if (!slipQueue.length) { showToast('No investigators with both a saved number and cases this month.', true); return; }

  slipQueueIdx = 0;
  document.getElementById('bulk-slip-queue-ui').style.display = 'block';
  renderSlipQueueStep();
}

function renderSlipQueueStep() {
  const el = document.getElementById('bulk-slip-current');
  if (slipQueueIdx >= slipQueue.length) {
    el.innerHTML = `✅ Done — reached the end of the queue (${slipQueue.length} investigator(s) processed).`;
    document.getElementById('bulk-slip-queue-ui').style.display = 'block';
    return;
  }
  const item = slipQueue[slipQueueIdx];
  const hasPhone = !!INVESTIGATOR_PHONES[item.name];
  el.innerHTML = `<b>${slipQueueIdx+1} / ${slipQueue.length}</b> — ${escAttr(item.name)} (${item.monthCases.length} case(s), ${item.mo.label})`
    + (hasPhone ? '' : ` <span style="color:var(--red);">— no WhatsApp number saved, will be skipped</span>`);
}

function openCurrentQueueChat() {
  if (slipQueueIdx >= slipQueue.length) return;
  const item = slipQueue[slipQueueIdx];
  const phone = INVESTIGATOR_PHONES[item.name];
  if (!phone) {
    // Matches the guard already in the single-slip flow (generateSlip) —
    // without this, window.open would fire on 'https://wa.me/undefined',
    // silently opening a broken chat while the queue moves on as if the
    // message was sent.
    showToast(`No WhatsApp number saved for ${escAttr(item.name)} — skipping.`, true);
    advanceSlipQueue();
    return;
  }
  const stats = computeInvStats(item.name, item.monthCases);
  const message = `Hello ${escAttr(item.name)},\n\nYour payment slip for *${item.mo.label}* from ${settings.agencyName}:\n\n` +
    `Total Cases: ${stats.totalCases}\n` +
    `Total Payable: Rs ${fmt(stats.totalPayable)}\n` +
    `Already Paid: Rs ${fmt(stats.paidAmt)}\n` +
    `*Net Payable Now: Rs ${fmt(stats.pendingAmt)}*\n\n` +
    `Detailed PDF slip has been generated separately — I'll attach it here.\n\nThank you.`;
  let encodedMsg = encodeURIComponent(message);
  if (encodedMsg.length > 1800) {
      encodedMsg = encodeURIComponent(message.substring(0, 1500) + '... (message truncated)');
  }
  window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
  advanceSlipQueue();
}

function advanceSlipQueue() {
  slipQueueIdx++;
  renderSlipQueueStep();
}

function sendSlipWhatsApp() {
  const name = document.getElementById('slip-inv').value;
  const monthCode = document.getElementById('slip-month').value;
  const mo = MONTHS.find(m => m.code === monthCode);
  const hintEl = document.getElementById('slip-wp-hint');

  if (!name) { showToast('Select an investigator first.', true); return; }

  const phone = INVESTIGATOR_PHONES[name];
  if (!phone) {
    hintEl.textContent = `No WhatsApp number saved for ${name} — add one from the Investigators tab first.`;
    hintEl.style.color = 'var(--red)';
    showToast('No WhatsApp number saved for this investigator.', true);
    return;
  }

  const monthCases = cases.filter(c => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y && (c.inv1===name || c.inv2===name);
  });
  const stats = computeInvStats(name, monthCases);

  const message = `Hello ${name},\n\nYour payment slip for *${mo.label}* from ${settings.agencyName}:\n\n` +
    `Total Cases: ${stats.totalCases}\n` +
    `Total Payable: Rs ${fmt(stats.totalPayable)}\n` +
    `Already Paid: Rs ${fmt(stats.paidAmt)}\n` +
    `*Net Payable Now: Rs ${fmt(stats.pendingAmt)}*\n\n` +
    `Detailed PDF slip has been generated separately — I'll attach it here.\n\nThank you.`;

  let encodedMsg = encodeURIComponent(message);
  if (encodedMsg.length > 1800) {
      encodedMsg = encodeURIComponent(message.substring(0, 1500) + '... (message truncated)');
  }
  const url = `https://wa.me/${phone}?text=${encodedMsg}`;
  window.open(url, '_blank');
  hintEl.textContent = `Opened WhatsApp for ${name} (${phone}). Attach the downloaded PDF manually before sending.`;
  hintEl.style.color = 'var(--green)';
}

async function generateSlip(previewOnly = true) {
  const name = document.getElementById('slip-inv').value;
  const monthCode = document.getElementById('slip-month').value;
  if (!name || !monthCode) {
    showToast('Please select investigator and month', true);
    return;
  }
  const mo = MONTHS.find(m => m.code === monthCode);
  if (!mo) {
    showToast('Invalid month selected', true);
    return;
  }
  const monthCases = cases.filter(c => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y && (c.inv1===name || c.inv2===name);
  });
  if (monthCases.length === 0) {
    showToast('No cases found for selected investigator and month', true);
    return;
  }
  const stats = computeInvStats(name, monthCases);
  const html = slipTemplatePremium(name, mo, monthCases, stats);
  const filename = `Payment_Slip_${name.replace(/\s+/g, '_')}_${mo.label.replace(/\s+/g, '_')}.pdf`;

  if (previewOnly) {
    openPDFPreview(html, filename, { orientation: 'landscape' });
    return;
  }
  
  const opt = {
    margin: [10, 10],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, onclone: window.sanitizeHtml2Canvas, scrollY: 0 },
    pagebreak: { mode: ['css', 'legacy'] },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  showToast('Generating PDF...');
  try {
    const worker = html2pdf().from(html).set(opt);
    await worker.save();
    showToast('PDF Downloaded');
  } catch (err) {
    console.error('PDF Generation Error:', err);
    showToast('Failed to generate PDF. Using print fallback.');
    printHTML(html);
  }
}

// Per-case fee/TA/status/hardcopy attribution for one investigator on one case.
// Handles the case where the same investigator appears as BOTH inv1 and
// inv2 on a single case (e.g. dual-role assignment) — sums both slots.
function invAmountOnCase(c, name) {
  let fee=0, ta=0, statuses=[], hardcopies=[];
  if (c.inv1===name) { 
    fee+=c.fee1||0; 
    ta+=c.ta1||0; 
    statuses.push(c.inv1_status||'—'); 
    hardcopies.push(c.hardcopy1_status||'Not Received');
  }
  if (c.inv2===name) { 
    fee+=c.fee2||0; 
    ta+=c.ta2||0; 
    statuses.push(c.inv2_status||'—'); 
    hardcopies.push(c.hardcopy2_status||'Not Received');
  }
  const isHcReceived = hardcopies.length > 0 && hardcopies.every(h => (h||'').toLowerCase() === 'received');
  return {
    fee, 
    ta, 
    total: fee+ta, 
    status: statuses.join(' / '), 
    hardcopy: isHcReceived ? 'Received' : 'Not Received'
  };
}

function slipTemplatePremium(name, mo, monthCases, stats) {
  const s = settings;
  const rows = monthCases.map((c, i) => {
    const a = invAmountOnCase(c, name);
    const isHcReceived = (a.hardcopy || '').toLowerCase() === 'received';
    return `<tr style="border-bottom:1px solid #E4E0D6; page-break-inside: avoid;">
      <td style="padding:6px 4px;word-break:break-word;text-align:center;">
        <span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700;background:${isHcReceived?'#E7F5EC':'#FDF0ED'};color:${isHcReceived?'#1F7A4D':'#C0392B'};border:1px solid ${isHcReceived?'#A3E0BA':'#F5B7B1'};">
          ${isHcReceived ? '✓ Received' : '✕ Not Received'}
        </span>
      </td>
      <td style="padding:6px 4px;word-break:break-word;">${c.date||''}</td>
      <td style="padding:6px 4px;word-break:break-word;font-family:monospace;font-weight:700;color:#0F2942;">${c.claim_no||''}</td>
      <td style="padding:6px 4px;word-break:break-word;">${c.insured_name||''}</td>
      <td style="padding:6px 4px;word-break:break-word;color:#657486;">${c.company||''}</td>
      <td style="padding:6px 4px;word-break:break-word;text-align:right;">Rs ${fmt(a.fee)}</td>
      <td style="padding:6px 4px;word-break:break-word;text-align:right;">Rs ${fmt(a.ta)}</td>
      <td style="padding:6px 4px;word-break:break-word;text-align:right;font-weight:700;">Rs ${fmt(a.total)}</td>
      <td style="padding:6px 4px;word-break:break-word;text-align:center;">
        <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;background:${a.status.includes('Paid')&&!a.status.includes('Pending')?'#E7F5EC':'#FDF2E0'};color:${a.status.includes('Paid')&&!a.status.includes('Pending')?'#1F7A4D':'#B87A1E'};">${a.status||'—'}</span>
      </td>
    </tr>`;
  }).join('');

  // Investigator additional vouchers & allowances for this month
  const invVouchers = (typeof getExpensesForMonth === 'function') 
    ? getExpensesForMonth(mo).filter(e => e.investigator_name === name)
    : [];
  const vouchersTotal = invVouchers.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  const vouchersPaid = invVouchers.filter(v => v.status === 'Paid').reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  const grandTotalPayable = stats.totalPayable + vouchersTotal;
  const grandTotalPaid = stats.paidAmt + vouchersPaid;
  const grandTotalPending = grandTotalPayable - grandTotalPaid;

  let vouchersSectionHtml = '';
  if (invVouchers.length > 0) {
    const vRows = invVouchers.map(v => `
      <tr style="border-bottom:1px solid #E4E0D6; page-break-inside: avoid;">
        <td style="padding:6px 4px;font-family:monospace;font-size:10px;color:#657486;">${v.date || '—'}</td>
        <td style="padding:6px 4px;font-weight:600;color:#0F2942;">${v.category || 'Voucher'}</td>
        <td style="padding:6px 4px;color:#657486;">${v.remarks || '—'}</td>
        <td style="padding:6px 4px;text-align:right;font-weight:700;">Rs ${fmt(v.amount)}</td>
        <td style="padding:6px 4px;text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;background:${v.status==='Paid'?'#E7F5EC':'#FDF2E0'};color:${v.status==='Paid'?'#1F7A4D':'#B87A1E'};">${v.status || 'Pending'}</span>
        </td>
      </tr>
    `).join('');

    vouchersSectionHtml = `
      <div style="margin-top:22px;">
        <div style="font-size:11px;font-weight:700;color:#0F2942;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;border-bottom:1.5px solid #0F2942;padding-bottom:3px;">
          Additional Allowances & Expenses (Courier, Bonus, Travel & Reimbursements)
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:12px;">
          <thead>
            <tr style="background:#F6F4EF;color:#0F2942;">
              <th style="padding:6px 4px;text-align:left;">Date</th>
              <th style="padding:6px 4px;text-align:left;">Category</th>
              <th style="padding:6px 4px;text-align:left;">Remarks / Reference</th>
              <th style="padding:6px 4px;text-align:right;">Amount</th>
              <th style="padding:6px 4px;text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${vRows}
            <tr style="background:#F6F4EF;font-weight:700;">
              <td colspan="3" style="padding:6px 4px;text-align:right;">Total Extra Allowances / Vouchers:</td>
              <td style="padding:6px 4px;text-align:right;color:#0284c7;">+ Rs ${fmt(vouchersTotal)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Grand Settlement Summary Box -->
      <table style="width:100%;margin-top:14px;border:1.5px solid #0F2942;border-radius:6px;border-collapse:collapse;background:#FAF8F5;">
        <tr>
          <td style="padding:10px 14px;font-size:11px;color:#657486;">Case Payout: <strong>Rs ${fmt(stats.totalPayable)}</strong></td>
          <td style="padding:10px 14px;font-size:11px;color:#0284c7;">Extra Vouchers: <strong>+ Rs ${fmt(vouchersTotal)}</strong></td>
          <td style="padding:10px 14px;font-size:13px;font-weight:800;color:#0F2942;text-align:right;background:#F6F4EF;">Grand Net Payable: Rs ${fmt(grandTotalPayable)}</td>
        </tr>
      </table>
    `;
  }

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;padding:30px;max-width:1050px;margin:0 auto;box-sizing:border-box;background:#fff;color:#1B2530;">
      <table style="width:100%; border-bottom:3px solid #B8862E; margin-bottom:22px; padding-bottom:18px;">
        <tr>
          <td style="vertical-align:middle;">
            <div style="display:flex;align-items:center;gap:14px;">
              ${s.logo ? `<img src="${s.logo}" style="height:56px;">` : ''}
              <div>
                <div style="font-size:19px;font-weight:700;color:#0F2942;letter-spacing:0.3px;">${s.agencyName}</div>
                <div style="font-size:10.5px;color:#657486;margin-top:2px;">${s.agencyAddress||''}</div>
              </div>
            </div>
          </td>
          <td style="vertical-align:bottom; text-align:right;">
            <div style="font-size:9px;color:#B8862E;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Payment Statement</div>
            <div style="font-size:10px;color:#657486;margin-top:3px;">${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</div>
          </td>
        </tr>
      </table>

      <table style="width:100%; margin-bottom:18px;">
        <tr>
          <td>
            <div style="font-size:9px;color:#657486;text-transform:uppercase;letter-spacing:1px;">Investigator</div>
            <div style="font-size:17px;font-weight:700;color:#0F2942;">${name}</div>
          </td>
          <td style="text-align:right;">
            <div style="font-size:9px;color:#657486;text-transform:uppercase;letter-spacing:1px;">Period</div>
            <div style="font-size:14px;font-weight:700;color:#0F2942;">${mo.label}</div>
          </td>
        </tr>
      </table>

      <!-- Summary KPI Table -->
      <table style="width:100%; margin-bottom:20px; border-collapse:separate; border-spacing:10px 0; margin-left:-10px; margin-right:-10px;">
        <tr>
          <td style="width:25%; background:#F6F4EF; border-radius:6px; padding:12px; text-align:center;">
            <div style="font-size:8.5px;color:#657486;text-transform:uppercase;letter-spacing:0.5px;">Total Cases</div>
            <div style="font-size:20px;font-weight:700;color:#0F2942;margin-top:3px;">${stats.totalCases}</div>
          </td>
          <td style="width:25%; background:#E7F5EC; border-radius:6px; padding:12px; text-align:center;">
            <div style="font-size:8.5px;color:#657486;text-transform:uppercase;letter-spacing:0.5px;">Paid Total</div>
            <div style="font-size:18px;font-weight:700;color:#1F7A4D;margin-top:3px;">Rs ${fmt(grandTotalPaid)}</div>
          </td>
          <td style="width:25%; background:#FDF2E0; border-radius:6px; padding:12px; text-align:center;">
            <div style="font-size:8.5px;color:#657486;text-transform:uppercase;letter-spacing:0.5px;">Pending Total</div>
            <div style="font-size:18px;font-weight:700;color:#B87A1E;margin-top:3px;">Rs ${fmt(grandTotalPending)}</div>
          </td>
          <td style="width:25%; background:#0F2942; border-radius:6px; padding:12px; text-align:center;">
            <div style="font-size:8.5px;color:#D9A846;text-transform:uppercase;letter-spacing:0.5px;">Net Total Payable</div>
            <div style="font-size:16px;font-weight:700;color:#fff;margin-top:3px;">Rs ${fmt(grandTotalPayable)}</div>
          </td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
        <thead>
          <tr style="background:#0F2942;color:#fff;">
            <th style="padding:6px 4px;text-align:center;">Hard Copy</th>
            <th style="padding:6px 4px;text-align:left;">Date</th>
            <th style="padding:6px 4px;text-align:left;">Claim No</th>
            <th style="padding:6px 4px;text-align:left;">Insured</th>
            <th style="padding:6px 4px;text-align:left;">Company</th>
            <th style="padding:6px 4px;text-align:right;">Fee</th>
            <th style="padding:6px 4px;text-align:right;">TA</th>
            <th style="padding:6px 4px;text-align:right;">Total</th>
            <th style="padding:6px 4px;text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      ${vouchersSectionHtml}

      <div style="margin-top:30px;font-size:10px;color:#999;">Generated securely via DNA Payments Dashboard &bull; ${new Date().toLocaleDateString('en-IN')}</div>
    </div>`;
}

function openPDFPreview(html, filename, options = {}) {
  const modal = document.getElementById('pdf-preview-modal');
  const content = document.getElementById('pdf-preview-content');
  const filenameEl = document.getElementById('pdf-preview-filename');
  const downloadBtn = document.getElementById('pdf-download-btn');

  filenameEl.textContent = filename;

  if (options.orientation === 'landscape') {
    content.style.width = '1123px';
    content.style.minWidth = '1123px';
    content.style.minHeight = '794px';
  } else {
    content.style.width = '794px';
    content.style.minWidth = '794px';
    content.style.minHeight = '1123px';
  }

  content.innerHTML = html;
  modal.style.display = 'flex';
  
  // Disable body scroll
  document.body.style.overflow = 'hidden';

  // Setup download button
  downloadBtn.onclick = async () => {
    // Sanitize HTML: replace unsupported modern color functions (oklab, oklch) with fallbacks
    // as html2pdf/html2canvas can crash on them.
    const sanitizedHtml = html.replace(/(oklab|oklch)\([^)]+\)/g, 'rgb(31,41,55)');

    const opt = {
      margin: [10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, onclone: window.sanitizeHtml2Canvas, scrollY: 0 },
      pagebreak: { mode: ['css', 'legacy'] },
      jsPDF: { unit: 'mm', format: 'a4', orientation: options.orientation || 'landscape' }
    };
    showToast('Downloading PDF...');
    try {
      await html2pdf().from(sanitizedHtml).set(opt).save();
      showToast('Downloaded successfully');
    } catch (err) {
      console.error('Download Error:', err);
      showToast('Download failed', true);
    }
  };
}

function closePDFPreview() {
  const modal = document.getElementById('pdf-preview-modal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

function printHTML(html) {
  const printArea = document.getElementById('slip-print');
  printArea.innerHTML = html;
  window.print();
}

// ============================================================
// SETTINGS
// ============================================================
function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(evt) {
    settings.logo = evt.target.result;
    document.getElementById('logo-preview-img').src = settings.logo;
    document.getElementById('logo-preview-img').style.display = 'block';
    document.getElementById('logo-placeholder').style.display = 'none';
    await saveSettings();
    showToast('Logo uploaded.');
  };
  reader.readAsDataURL(file);
}

async function loadSettingsFromDB() {
  const { data, error } = await supabaseClient.from('agency_settings').select('*').eq('id', 1).single();
  if (error) { showToast('Failed to load settings: ' + error.message, true); return; }
  
  if (data.companies && Array.isArray(data.companies)) COMPANIES = data.companies;
  if (data.case_types && Array.isArray(data.case_types)) CASE_TYPES = data.case_types;
  refreshDynamicCompanies();
  if (typeof renderSettingsLists === 'function') renderSettingsLists();
  
  if (data.custom_fields_config && Array.isArray(data.custom_fields_config)) window.CUSTOM_FIELDS = data.custom_fields_config;
  if (typeof window.renderCustomFieldsSettings === 'function') window.renderCustomFieldsSettings();
  if (typeof window.injectCustomHeadersIntoTable === 'function') window.injectCustomHeadersIntoTable();
  if (typeof window.injectCustomFieldsIntoForm === 'function') window.injectCustomFieldsIntoForm();

  settings = { agencyName: data.agency_name, agencyAddress: data.agency_address || '', logo: data.logo || null, fieldPermissions: data.field_permissions || {} };
  if(typeof renderPermissionsMatrix === 'function') renderPermissionsMatrix();
  if(typeof renderAssignedRoles === 'function') renderAssignedRoles();
}

async function saveSettings() {
  settings.agencyName = document.getElementById('agency-name').value;
  settings.agencyAddress = document.getElementById('agency-address').value;
  if(typeof buildFieldPermissionsPayload === 'function') settings.fieldPermissions = buildFieldPermissionsPayload();
  const { error } = await supabaseClient.from('agency_settings').update({
    agency_name: settings.agencyName, agency_address: settings.agencyAddress, logo: settings.logo, field_permissions: settings.fieldPermissions
  }).eq('id', 1);
  if (error) { showToast('Failed to save settings: ' + error.message, true); return; }
}

function renderSettingsLists() {
  const cList = document.getElementById('settings-companies-list');
  if (cList) {
    cList.innerHTML = COMPANIES.length === 0 ? '<div style="padding:10px; color:var(--sub); text-align:center;">No companies</div>' : 
      COMPANIES.map(c => `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid var(--line);"><span>${escAttr(c)}</span> <button class="btn btn-sm" style="color:var(--red); background:none; border:none;" onclick="removeCompany('${escAttr(c).replace(/'/g, "\\'")}')">✖</button></div>`).join('');
  }
  const ctList = document.getElementById('settings-casetypes-list');
  if (ctList) {
    ctList.innerHTML = CASE_TYPES.length === 0 ? '<div style="padding:10px; color:var(--sub); text-align:center;">No case types</div>' : 
      CASE_TYPES.map(c => `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid var(--line);"><span>${escAttr(c)}</span> <button class="btn btn-sm" style="color:var(--red); background:none; border:none;" onclick="removeCaseType('${escAttr(c).replace(/'/g, "\\'")}')">✖</button></div>`).join('');
  }
}

async function addCompany() {
  const input = document.getElementById('new-company-input');
  const val = input.value.trim().toUpperCase();
  if (!val) return;
  if (COMPANIES.includes(val)) { showToast('Company already exists.', true); return; }
  COMPANIES.push(val);
  COMPANIES.sort();
  await _saveListsToDB();
  input.value = '';
}

async function removeCompany(name) {
  if (!confirm(`Are you sure you want to remove "${name}"? Existing cases will not be changed, but you won't be able to select it for new cases.`)) return;
  COMPANIES = COMPANIES.filter(c => c !== name);
  await _saveListsToDB();
}

async function addCaseType() {
  const input = document.getElementById('new-casetype-input');
  const val = input.value.trim().toUpperCase();
  if (!val) return;
  if (CASE_TYPES.includes(val)) { showToast('Case Type already exists.', true); return; }
  CASE_TYPES.push(val);
  CASE_TYPES.sort();
  await _saveListsToDB();
  input.value = '';
}

async function removeCaseType(name) {
  if (!confirm(`Are you sure you want to remove "${name}"?`)) return;
  CASE_TYPES = CASE_TYPES.filter(c => c !== name);
  await _saveListsToDB();
}

async function _saveListsToDB() {
  const { error } = await supabaseClient.from('agency_settings').update({
    companies: COMPANIES,
    case_types: CASE_TYPES
  }).eq('id', 1);
  if (error) {
    if ((error.code === '42703' || error.code === 'PGRST204')) {
      showToast('Database column missing. Please run the SQL command provided to upgrade your database.', true);
    } else {
      showToast('Failed to save lists: ' + error.message, true);
    }
  } else {
    showToast('Lists updated successfully.');
  }
  refreshDynamicCompanies();
  renderSettingsLists();
}

async function updateOwnPassword() {
  const newPass = document.getElementById('set-own-pass').value;
  if (!newPass) { showToast('Enter a new password first.', true); return; }
  if (newPass.length < 6) { showToast('Password must be at least 6 characters.', true); return; }
  if (!supabaseClient?.auth) { showToast('Supabase client is not initialized.', true); return; }
  const { error } = await supabaseClient.auth.updateUser({ password: newPass });
  if (error) { showToast(error.message, true); return; }
  document.getElementById('set-own-pass').value = '';
  showToast('Password updated.');
}

function inviteStaff() {
  const email = document.getElementById('invite-email').value.trim();
  const statusEl = document.getElementById('invite-status');
  if (!email) { showToast('Enter the staff member\'s email first.', true); return; }
  const supabaseUrl = SUPABASE_CONFIG?.url || 'https://hmtimjssanxpjcshfjdo.supabase.co';
  const match = supabaseUrl.match(/https:\/\/(.*)\.supabase\.co/);
  const projectId = match ? match[1] : 'YOUR_PROJECT_ID';
  statusEl.innerHTML = `Direct invites aren't available from this screen for security reasons (it would require exposing an admin key in the browser). Create <b>${email}</b>'s account from the <a href="https://supabase.com/dashboard/project/${projectId}/auth/users" target="_blank" style="color:var(--gold);">Supabase Dashboard → Authentication → Users → Add User</a> instead — takes under a minute.`;
}

function downloadTemplate() {
  const headers = ['Company','Date','Case Type','Claim No','Policy No','Insured Name','Hospital','Location','INV1','INV2','Fee1','Fee2','TA1','TA2','Total Payable (leave blank)','Received','Invoice No','Invoice Amount','Profit (leave blank)','INV1 Status','INV2 Status','Outcome','Remarks'];
  const sample = ['CARE','2026-04-15','REIMBURSEMENT','97600000','24500000','SAMPLE NAME','SAMPLE HOSPITAL','SAMPLE CITY','BHOLA YADAV','NA','300','','50','','','','','5000','','Pending','','Genuine',''];
  const csv = [headers, sample].map(r => r.map(v=>`"${v}"`).join(',')).join('\n');
  downloadFile('Case_Import_Template.csv', csv, 'text/csv');
  showToast('Template downloaded — fill it in Excel, save as CSV, then use Import Excel/CSV.');
}

function exportExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Excel export needs an internet connection (loads a library from CDN). Use CSV export instead if offline.', true);
    return;
  }
  const rows = cases.map(c => {
    const r = {
        'Doc Code': c.doc_code, 'Company': c.company, 'Date': c.date, 'Case Type': c.case_type,
        'Claim No': c.claim_no, 'Policy No': c.policy_no, 'Insured Name': c.insured_name, 'Hospital': c.hospital, 'Location': c.location,
        'Invoice No': c.invoice_no, 'Invoice Amount': c.invoice_amount || 0, 'INV1': c.inv1, 'INV2': c.inv2, 'Fee1': c.fee1, 'Fee2': c.fee2, 'TA1': c.ta1, 'TA2': c.ta2,
        'Total Payable': c.total_payable, 'Received': c.received, 'Profit': c.profit,
        'INV1 Status': c.inv1_status, 'INV2 Status': c.inv2_status,
        'INV1 Hard Copy': c.hardcopy1_status, 'INV2 Hard Copy': c.hardcopy2_status, 'Company Dispatch': c.company_hardcopy_status, 'AWB No': c.company_hardcopy_awb,
        'Outcome': c.outcome || 'Pending', 'SLA (Hours)': c.sla_hours || '', 'Due Date': c.due_date || '', 'Risk Level': c.risk_level || '',
        'Completed At': c.completed_at || '', 'Exception': c.exception_type || '', 'Remarks': c.remarks || ''
    };
    if (window.CUSTOM_FIELDS) window.CUSTOM_FIELDS.forEach(cf => r[cf.name] = c.custom_data ? (c.custom_data[cf.id]||'') : '');
    return r;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cases');
  XLSX.writeFile(wb, `DNA_Cases_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast('Excel file downloaded.');
}

async function exportPDF() {
  const rows = filteredCases.length ? filteredCases : cases;
  const title = `All Cases Export (${rows.length} cases)`;
  const html = buildReportHTML(title, [`Total Cases: ${rows.length}`, `Generated: ${new Date().toLocaleDateString('en-IN')}`], rows);
  const filename = `DNA_Cases_Export_${new Date().toISOString().slice(0,10)}.pdf`;

  openPDFPreview(html, filename, { orientation: 'landscape' });
}

function exportForSheets() {
  const headers = ['Doc Code','Company','Date','Case Type','Claim No','Policy No','Insured Name','Hospital','Location','Invoice No','Invoice Amount','INV1','INV2','Fee1','Fee2','TA1','TA2','Total Payable','Received','Profit','INV1 Status','INV2 Status','INV1 Hard Copy','INV2 Hard Copy','Company Dispatch','AWB No','Outcome','SLA (Hours)','Due Date','Risk Level','Completed At','Exception','Remarks'];
  if (window.CUSTOM_FIELDS) window.CUSTOM_FIELDS.forEach(cf => headers.push(cf.name));
  
  const csv = [
    headers,
    ...cases.map(c => {
        const row = [c.doc_code,c.company,c.date,c.case_type,c.claim_no,c.policy_no,c.insured_name,c.hospital,c.location,c.invoice_no,c.invoice_amount||'',c.inv1,c.inv2,c.fee1,c.fee2,c.ta1,c.ta2,c.total_payable,c.received,c.profit,c.inv1_status,c.inv2_status,c.hardcopy1_status,c.hardcopy2_status,c.company_hardcopy_status,c.company_hardcopy_awb,c.outcome||'Pending',c.sla_hours||'',c.due_date||'',c.risk_level||'',c.completed_at||'',c.exception_type||'',c.remarks||''];
        if (window.CUSTOM_FIELDS) window.CUSTOM_FIELDS.forEach(cf => row.push(c.custom_data ? (c.custom_data[cf.id]||'') : ''));
        return row;
    })
  ].map(r => r.map(v => `"${(v==null?'':v).toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile('DNA_Cases_Export.csv', csv, 'text/csv');
  showToast('CSV exported — paste this into Google Sheets.');
}

function exportBackup() {
  const data = JSON.stringify({cases, settings, investigators: investigatorRows}, null, 2);
  downloadFile('DNA_Backup_'+new Date().toISOString().slice(0,10)+'.json', data, 'application/json');
  showToast('Backup downloaded.');
}

async function restoreBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (!confirm(`This will REPLACE all ${cases.length} current case(s) in the database with ${data.cases ? data.cases.length : 0} case(s) from this backup file. This cannot be undone. Continue?`)) return;
      if (data.settings) {
        settings = data.settings;
        const { error: setErr } = await supabaseClient.from('agency_settings').update({
          agency_name: settings.agencyName, agency_address: settings.agencyAddress, logo: settings.logo
        }).eq('id', 1);
        if (setErr) throw setErr;
        applySettingsToForm();
      }
      if (data.investigators && data.investigators.length) {
        // Upsert by name — adds any investigator from the backup that's
        // missing now, and restores phone numbers. Deliberately not a
        // wipe-and-replace like cases: investigators are referenced by name
        // string from cases.inv1/inv2 (no foreign key), so deleting one that
        // turns out to still be in use would silently break display instead
        // of failing loudly.
        const { error: invErr } = await supabaseClient.from('investigators')
          .upsert(data.investigators.map(inv => ({
            name: inv.name, phone: inv.phone || null, is_base: !!inv.is_base, removed: !!inv.removed
          })), { onConflict: 'name' });
        if (invErr) throw invErr;
        await loadInvestigatorsFromDB();
        refreshInvestigatorDropdowns();
      }
      if (data.cases) {
        showToast('Restoring backup…');
        // Wipe existing cases, then bulk-insert the backup's cases. Doc codes
        // and generated columns (total_payable, profit) come straight from
        // the backup file rather than being regenerated, so historical doc
        // codes are preserved exactly as they were when backed up.
        const { error: delErr } = await supabaseClient.from('cases').delete().neq('doc_code', '__never_matches__');
        if (delErr) throw delErr;
        const restoreRows = data.cases.map(c => {
          const { total_payable, profit, ...rest } = c; // generated columns — DB computes these
          return rest;
        });
        if (restoreRows.length) {
          const { error: insErr } = await supabaseClient.from('cases').insert(restoreRows);
          if (insErr) throw insErr;
        }
        await loadCasesFromDB();
      }
      renderAll();
      showToast('Backup restored.');
    } catch(err) { showToast('Restore failed: ' + err.message, true); }
  };
  reader.readAsText(file);
}

// Automatically scans database and fixes malformed doc_codes (e.g. 72026-0222 -> JUL26-0222)
async function fixMalformedDocCodes() {
  const btn = document.getElementById('fix-doc-codes-btn');
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Scanning & Fixing...';
  }

  showToast('🔍 Scanning database for malformed document codes...');
  
  try {
    // Ensure we have the latest cases list
    let targetCases = window.cases || (typeof cases !== 'undefined' ? cases : []);
    if (!targetCases || targetCases.length === 0) {
      try {
        const { data } = await supabaseClient.from('cases').select('*');
        if (data && data.length > 0) targetCases = data;
      } catch(e) {
        console.warn('Could not fetch cases from DB:', e);
      }
    }

    const codes = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    
    function getStandardDocCode(docCode, dateStr) {
      if (!docCode) return null;
      const str = String(docCode).trim();
      // If it's already perfectly valid (e.g., JUL26-0222, JUN26-0001), skip
      if (/^[A-Z]{3}\d{2}-\d{3,}$/i.test(str)) {
        return null;
      }

      // Pattern 1: e.g. 72026-0222, 072026-0222, 112026-0001
      const p1 = str.match(/^(\d{1,2})20(\d{2})[-_](\d+)$/);
      if (p1) {
        const monthNum = parseInt(p1[1], 10);
        const shortYear = p1[2];
        const seq = p1[3].padStart(4, '0');
        if (monthNum >= 1 && monthNum <= 12) {
          return `${codes[monthNum - 1]}${shortYear}-${seq}`;
        }
      }

      // Pattern 2: e.g. 7-2026-0222 or 07/2026-0222
      const p2 = str.match(/^(\d{1,2})[-/](?:20)?(\d{2})[-_](\d+)$/);
      if (p2) {
        const monthNum = parseInt(p2[1], 10);
        const shortYear = p2[2];
        const seq = p2[3].padStart(4, '0');
        if (monthNum >= 1 && monthNum <= 12) {
          return `${codes[monthNum - 1]}${shortYear}-${seq}`;
        }
      }

      // Pattern 3: Starts with number before hyphen, e.g. 726-0222 or any numeric prefix
      const p3 = str.match(/^(\d{1,2})(\d{2})[-_](\d+)$/);
      if (p3) {
        const monthNum = parseInt(p3[1], 10);
        const shortYear = p3[2];
        const seq = p3[3].padStart(4, '0');
        if (monthNum >= 1 && monthNum <= 12) {
          return `${codes[monthNum - 1]}${shortYear}-${seq}`;
        }
      }

      // Fallback: If docCode is malformed but we have dateStr
      if (dateStr) {
        const { code: monthCode } = parseDateComponents(dateStr);
        const seqMatch = str.match(/(\d+)$/);
        const seq = seqMatch ? seqMatch[1].padStart(4, '0') : '0001';
        const candidate = `${monthCode}-${seq}`;
        if (candidate.toLowerCase() !== str.toLowerCase()) {
          return candidate;
        }
      }

      return null;
    }

    const malformedList = [];
    for (const c of targetCases) {
      const fixed = getStandardDocCode(c.doc_code, c.date);
      if (fixed && fixed !== c.doc_code) {
        malformedList.push({
          id: c.id,
          oldDocCode: c.doc_code,
          newDocCode: fixed,
          claim_no: c.claim_no
        });
      }
    }

    if (malformedList.length === 0) {
      showToast('✓ All document codes are already formatted correctly (e.g. JUL26-XXXX)!');
      return;
    }

    showToast(`Fixing ${malformedList.length} malformed doc code(s)...`);
    let fixedCount = 0;

    for (const item of malformedList) {
      try {
        let query = supabaseClient.from('cases').update({ doc_code: item.newDocCode });
        if (item.id) {
          query = query.eq('id', item.id);
        } else {
          query = query.eq('doc_code', item.oldDocCode);
        }
        const { error } = await query;
        if (!error) {
          fixedCount++;
          // Update local object
          const local = targetCases.find(x => (item.id && x.id === item.id) || x.doc_code === item.oldDocCode);
          if (local) local.doc_code = item.newDocCode;
        } else {
          console.error(`Failed to update ${item.oldDocCode} -> ${item.newDocCode}:`, error);
        }
      } catch (err) {
        console.error(`Exception updating case ${item.oldDocCode}:`, err);
      }
    }

    if (typeof loadCasesFromDB === 'function') {
      await loadCasesFromDB();
    }
    if (typeof renderAll === 'function') {
      renderAll();
    }
    if (typeof renderDocuments === 'function') {
      renderDocuments();
    }
    if (typeof filterCases === 'function') {
      filterCases();
    }
    if (typeof filterInvestigators === 'function') {
      filterInvestigators();
    }
    if (typeof renderMonthly === 'function') {
      renderMonthly(activeMonth);
    }
    if (typeof renderSalary === 'function') {
      renderSalary();
    }
    if (typeof renderYearly === 'function') {
      renderYearly();
    }
    if (typeof executeLookupDoc === 'function' && document.getElementById('doc-search')?.value) {
      executeLookupDoc();
    }
    if (document.getElementById('bulkdoc-modal')?.classList.contains('open')) {
      if (typeof renderBulkDocReceive === 'function') renderBulkDocReceive();
      if (typeof renderBulkDocDispatch === 'function') renderBulkDocDispatch();
    }
    
    showToast(`✓ Successfully converted ${fixedCount} of ${malformedList.length} code(s) (e.g. ${malformedList[0].oldDocCode} → ${malformedList[0].newDocCode})!`);
  } catch (err) {
    showToast('Error during fix: ' + (err.message || err), true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || '🔧 Fix Malformed Doc Codes';
    }
  }
}
window.fixMalformedDocCodes = fixMalformedDocCodes;

async function clearAllData() {
  if (!confirm('This will permanently delete ALL cases, activity logs, and investigators from the database. This cannot be undone. Continue?')) return;
  if (!confirm('Are you absolutely sure? This is the final warning.')) return;
  
  showToast('Deleting all data, please wait...');
  try {
    // 1. Delete dependent logs and documents
    await supabaseClient.from('activity_log').delete().neq('module', '__never_matches__');
    await supabaseClient.from('investigator_audit_log').delete().neq('action', '__never_matches__');
    await supabaseClient.from('investigator_documents').delete().neq('document_name', '__never_matches__');
    await supabaseClient.from('case_ownership_transfers').delete().not('created_at', 'is', null);
    
    // 2. Delete all cases
    const { data: casesData, error: casesErr } = await supabaseClient.from('cases').delete().neq('doc_code', '__never_matches__').select('id');
    if (casesErr) throw casesErr;
    if (!casesData || casesData.length === 0) {
      console.warn("Delete all cases returned 0 rows. This might be due to RLS blocking or the table is already empty.");
    }
    
    // 3. Delete all investigators
    const { error: invErr } = await supabaseClient.from('investigators').delete().neq('name', '__never_matches__');
    if (invErr) throw invErr;
    
  } catch (err) {
    console.error(err);
    showToast('Delete failed: ' + err.message, true);
    return;
  }
  
  await loadCasesFromDB();
  await loadInvestigatorsFromDB();
  if (typeof fetchActivityLog === 'function') fetchActivityLog();
  renderAll();
  showToast('All data deleted successfully. Starting fresh!');
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// UTILS
// ============================================================
// ============================================================
// REALTIME SYNC (replaces the old localStorage two-tab warning)
// Any insert/update/delete on `cases` — from this tab, another tab, or
// another staff member's device — pushes to every open session live via
// Supabase Realtime. This is the actual fix for the old "last write wins"
// silent-overwrite problem: everyone now sees the same data within a
// second or two of any change, instead of finding out only on next reload.
// ============================================================
let realtimeReloadTimer = null;
let realtimeSecondaryTimer = null;
function subscribeToCasesRealtime() {
  if (!supabaseClient) return;
  supabaseClient
    .channel('db-changes-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => {
      clearTimeout(realtimeReloadTimer);
      realtimeReloadTimer = setTimeout(async () => {
        await loadCasesFromDB();
        renderAll();
        if (typeof checkOverdueAlerts === 'function') checkOverdueAlerts();
      }, 400);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'investigators' }, () => {
      clearTimeout(realtimeSecondaryTimer);
      realtimeSecondaryTimer = setTimeout(async () => {
        if (typeof loadInvestigatorsFromDB === 'function') await loadInvestigatorsFromDB();
        renderAll();
      }, 400);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_settings' }, () => {
      setTimeout(async () => {
        if (typeof loadSettingsFromDB === 'function') await loadSettingsFromDB();
        renderAll();
      }, 400);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'investigator_expenses' }, () => {
      setTimeout(async () => {
        if (typeof loadInvestigatorExpensesDB === 'function') await loadInvestigatorExpensesDB();
        renderAll();
      }, 400);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
      setTimeout(async () => {
        if (typeof loadAssignedRoles === 'function' && document.getElementById('view-settings')?.classList.contains('active')) {
           loadAssignedRoles();
        }
      }, 400);
    })
    .subscribe();
}

function fmt(n) { if (!n) return '0'; return Number(n).toLocaleString('en-IN'); }
function escAttr(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;'); }
// saveData() historically persisted `cases` to localStorage. That's now
// handled per-mutation by insertCaseDB/updateCaseDB/deleteCaseDB writing
// straight to Supabase, so this is kept only for the backup-reminder timer
// (unrelated to case data itself) and any remaining callers are effectively
// no-ops on the cases side.
function saveData() {
  checkBackupReminder();
}

function checkBackupReminder() {
  const lastReminderAt = parseInt(localStorage.getItem('dna_last_backup_reminder_count') || '0');
  if (cases.length >= lastReminderAt + 100) {
    localStorage.setItem('dna_last_backup_reminder_count', cases.length.toString());
    setTimeout(() => {
      if (confirm(`You now have ${cases.length} cases saved in this browser only. Download a backup now to avoid losing data if the browser data gets cleared?`)) {
        exportBackup();
      }
    }, 300);
  }
}

function checkWeeklyBackupReminder() {
  if (!cases.length) return;
  const lastTime = parseInt(localStorage.getItem('dna_last_backup_reminder_time') || '0');
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - lastTime >= weekMs) {
    localStorage.setItem('dna_last_backup_reminder_time', Date.now().toString());
    setTimeout(() => {
      if (confirm(`It's been a week since your last backup reminder. You have ${cases.length} case(s) saved only in this browser. Download a backup now?`)) {
        exportBackup();
      }
    }, 500);
  }
}
function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = isError ? 'var(--red)' : 'var(--navy)';
  t.style.display = 'block';
  setTimeout(()=> t.style.display='none', 3200);
}

document.addEventListener('click', function(e){
  const panel = document.getElementById('notif-panel');
  if (panel.classList.contains('open') && !panel.contains(e.target) && !e.target.closest('.icon-btn')) panel.classList.remove('open');
});



let hospitalRiskCache = {};

function buildHospitalAnalytics() {
  hospitalRiskCache = {};
  cases.forEach(c => {
    if (!c.hospital) return;
    const hName = c.hospital.trim().toUpperCase();
    if (!hospitalRiskCache[hName]) {
      hospitalRiskCache[hName] = { total: 0, fraud: 0, genuine: 0, suspicious: 0, pending: 0, riskScore: 0, isHighRisk: false };
    }
    hospitalRiskCache[hName].total++;
    
    const outcome = (c.outcome || '').toLowerCase();
    const exception = (c.exception_type || '').toLowerCase();
    if (outcome.includes('repudiated') || outcome.includes('fraud') || outcome.includes('fake') || outcome.includes('rejected') || exception.includes('rejected')) {
      hospitalRiskCache[hName].fraud++;
    } else if (outcome.includes('approved') || outcome.includes('genuine') || outcome.includes('settled') || outcome.includes('paid')) {
      hospitalRiskCache[hName].genuine++;
    } else if (outcome.includes('suspicious') || outcome.includes('hold') || outcome.includes('doubt')) {
      hospitalRiskCache[hName].suspicious++;
    } else {
      // It's pending or unspecified, don't count it towards risk metrics
      hospitalRiskCache[hName].pending++;
    }
    
    const resolvedCases = hospitalRiskCache[hName].fraud + hospitalRiskCache[hName].genuine + hospitalRiskCache[hName].suspicious;
    
    if (resolvedCases > 0) {
      // Calculate risk score based only on cases that have an actual outcome
      hospitalRiskCache[hName].riskScore = Math.round(((hospitalRiskCache[hName].fraud + hospitalRiskCache[hName].suspicious) / resolvedCases) * 100);
      // High risk if risk score is high AND they have at least 2 resolved cases
      hospitalRiskCache[hName].isHighRisk = hospitalRiskCache[hName].riskScore >= 30 && resolvedCases >= 2;
    } else {
      // If all cases are pending, risk score is 0
      hospitalRiskCache[hName].riskScore = 0;
      hospitalRiskCache[hName].isHighRisk = false;
    }
  });
}

let riskChartObj = null;
let pieChartObj = null;

function renderIntelligenceView() {
  buildHospitalAnalytics();
  
  const tbody = document.getElementById('hospital-risk-tbody');
  if (!tbody) return;
  
  const sortedHospitals = Object.keys(hospitalRiskCache)
    .map(name => ({name, ...hospitalRiskCache[name]}))
    .sort((a,b) => b.riskScore - a.riskScore || b.total - a.total);
    
  let html = '';
  let totalGenuine = 0;
  let totalFraud = 0;
  let totalSusp = 0;
  let totalPending = 0;
  
  sortedHospitals.forEach(h => {
    totalGenuine += h.genuine;
    totalFraud += h.fraud;
    totalSusp += h.suspicious;
    totalPending += h.pending;
    
    let statusBadge = h.isHighRisk 
      ? `<span class="badge" style="background:var(--red);color:#fff;">HIGH RISK</span>`
      : `<span class="badge" style="background:var(--green);color:#fff;">NORMAL</span>`;
      
    if (h.total > 0 && !h.isHighRisk && h.riskScore > 0) {
      statusBadge = `<span class="badge" style="background:var(--gold);color:var(--navy);">WATCH</span>`;
    }
    
    html += `<tr style="cursor:pointer;" onclick="window.viewHospitalCases('${h.name.replace(/'/g, "\\'")}')" title="Click to view all cases for this hospital" class="hover-row">
      <td style="font-weight:800; color:var(--gold); text-decoration:underline;">${h.name}</td>
      <td>${h.total}</td>
      <td>${h.genuine}</td>
      <td style="color:var(--red);font-weight:600;">${h.fraud + h.suspicious}</td>
      <td style="color:var(--sub);font-size:12px;font-weight:600;">${h.pending}</td>
      <td>${h.riskScore}%</td>
      <td>${statusBadge}</td>
    </tr>`;
  });
  
  if (!html) html = `<tr><td colspan="7"><div class="empty-state">No hospital data found to analyze.</div></td></tr>`;
  tbody.innerHTML = html;
  
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#8b9bb4';
    const topFraud = sortedHospitals.filter(h => h.isHighRisk || h.riskScore > 0).slice(0, 10);
    const ctxBar = document.getElementById('fraudHospitalsChart');
    if (ctxBar) {
      if (riskChartObj) riskChartObj.destroy();
      if (topFraud.length > 0) {
        riskChartObj = new Chart(ctxBar, {
          type: 'bar',
          data: {
            labels: topFraud.map(h => h.name.length > 15 ? h.name.substring(0, 15) + '...' : h.name),
            datasets: [{
              label: 'Fraud Risk %',
              data: topFraud.map(h => h.riskScore),
              backgroundColor: 'rgba(251,113,133,0.8)',
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100 } }
          }
        });
      }
    }
    
    const ctxPie = document.getElementById('outcomesPieChart');
    if (ctxPie) {
      if (pieChartObj) pieChartObj.destroy();
      pieChartObj = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: ['Genuine', 'Fraud', 'Suspicious', 'Pending/Unset'],
          datasets: [{
            data: [totalGenuine, totalFraud, totalSusp, totalPending],
            backgroundColor: ['#34d399', '#fb7185', '#fbbf24', '#cbd5e1']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
  }
}

// Ensure Google Drive initialization is delayed until GSI is ready
window.addEventListener('load', () => {
  if (typeof google !== 'undefined' && google.accounts && window.getGoogleClientId()) {
    if (typeof google !== "undefined" && google.accounts) { window.googleDriveService.init(window.getGoogleClientId()); } else { console.log("[APP] Waiting for Google Sign-In script to load..."); }
  }
});


window.initGoogleDriveOnLoad = function() {
  if (typeof google !== "undefined" && google.accounts && window.getGoogleClientId() && !window.googleDriveService.client) {
    console.log("[APP] GSI loaded via callback, initializing Drive client.");
    window.googleDriveService.init(window.getGoogleClientId());
  }
};



// ============================================================
// BULK DOCUMENT & DISPATCH MANAGER
// ============================================================
// BULK DOCUMENT & DISPATCH MANAGER (HARD COPY INWARD / OUTWARD)
// ============================================================
let currentDocTab = 'receive';

function openBulkDocManager() {
  if (!window.isCurrentUserAdmin) {
    showToast('Only admins can bulk-manage documents', true);
    return;
  }
  
  // Populate Investigator Dropdown with 'ALL' as default
  const invSelect = document.getElementById('bulkdoc-receive-inv');
  invSelect.innerHTML = '<option value="ALL">★ All Investigators (Pending Hard Copies)</option>' + 
    INVESTIGATORS.map(n => `<option value="${escAttr(n)}">${escAttr(n)}</option>`).join('');
  invSelect.value = 'ALL';
    
  // Populate Company Dropdown with 'ALL' as default
  const coSelect = document.getElementById('bulkdoc-dispatch-co');
  coSelect.innerHTML = '<option value="ALL">★ All Companies (Pending Dispatch)</option>' + 
    COMPANIES.map(c => `<option value="${escAttr(c)}">${escAttr(c)}</option>`).join('');
  coSelect.value = 'ALL';

  document.getElementById('bulkdoc-dispatch-awb').value = '';
  document.getElementById('bulkdoc-receive-paste').value = '';
  document.getElementById('bulkdoc-dispatch-paste').value = '';
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bulkdoc-receive-date').value = today;
  document.getElementById('bulkdoc-dispatch-date').value = today;
  
  renderBulkDocReceive();
  renderBulkDocDispatch();
  
  switchDocTab('receive');
  document.getElementById('bulkdoc-modal').classList.add('open');
}

function updateBulkDocSelectionCount() {
  const tableId = currentDocTab === 'receive' ? 'bulkdoc-receive-table' : 'bulkdoc-dispatch-table';
  const checkboxes = document.querySelectorAll(`#${tableId} tbody input[type="checkbox"]:checked`);
  const countEl = document.getElementById('bulkdoc-count-text');
  if (countEl) countEl.textContent = `${checkboxes.length} Cases Selected`;
}

function switchDocTab(tab) {
  currentDocTab = tab;
  document.getElementById('doc-tab-receive').classList.toggle('active', tab === 'receive');
  document.getElementById('doc-tab-dispatch').classList.toggle('active', tab === 'dispatch');
  
  document.getElementById('doc-view-receive').style.display = (tab === 'receive') ? 'block' : 'none';
  document.getElementById('doc-view-dispatch').style.display = (tab === 'dispatch') ? 'block' : 'none';
  updateBulkDocSelectionCount();
}

function toggleAllDocCheckboxes(sourceEl, tab) {
  const tableId = tab === 'receive' ? 'bulkdoc-receive-table' : 'bulkdoc-dispatch-table';
  const checkboxes = document.querySelectorAll(`#${tableId} tbody input[type="checkbox"]`);
  checkboxes.forEach(cb => cb.checked = sourceEl.checked);
  updateBulkDocSelectionCount();
}

function autoSelectDocs(tab) {
  const pasteId = tab === 'receive' ? 'bulkdoc-receive-paste' : 'bulkdoc-dispatch-paste';
  const tableId = tab === 'receive' ? 'bulkdoc-receive-table' : 'bulkdoc-dispatch-table';
  
  const rawText = document.getElementById(pasteId).value;
  if (!rawText.trim()) return;

  // Split by commas, tabs, newlines or spaces, clean up whitespace, uppercase
  const searchTerms = rawText.split(/[\n,\t\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  if (searchTerms.length === 0) return;

  let rows = document.querySelectorAll(`#${tableId} tbody tr`);
  let matchCount = 0;

  // If table is empty or missing terms, try rendering across all cases
  const allCases = window.cases || cases || [];
  const tbody = document.getElementById(tableId).querySelector('tbody');

  if (tab === 'receive') {
    // Find matching cases that might not be in the current filtered table
    const matchedCases = allCases.filter(c => {
      if (!c || c.exception_type === 'Withdrawn') return false;
      const docCode = (c.doc_code || '').toUpperCase();
      const claimNo = (c.claim_no || '').toUpperCase();
      const polNo = (c.policy_no || '').toUpperCase();
      return searchTerms.some(t => t === docCode || t === claimNo || t === polNo);
    });

    if (matchedCases.length > 0) {
      // Re-populate table with these matched cases if needed
      const existingDocCodes = new Set(Array.from(rows).map(r => r.getAttribute('data-doccode')));
      matchedCases.forEach(c => {
        if (!existingDocCodes.has(c.doc_code)) {
          let roles = [];
          if (c.inv1 && c.inv1 !== 'NA') roles.push('INV1');
          if (c.inv2 && c.inv2 !== 'NA') roles.push('INV2');
          const trHtml = `<tr data-doccode="${c.doc_code}" data-claim="${c.claim_no||''}" data-roles="${roles.join(',') || 'INV1'}">
            <td><input type="checkbox" checked onchange="updateBulkDocSelectionCount()"></td>
            <td style="font-family:var(--mono); font-weight:700;">${c.doc_code}</td>
            <td>${c.date||''}</td>
            <td style="font-family:var(--mono); font-weight:700; color:var(--navy);">${c.claim_no||''}</td>
            <td>${c.insured_name||''}</td>
            <td>${roles.join(' & ') || c.inv1 || '—'}</td>
            <td><span style="color:var(--red); font-weight:600;">Not Received</span></td>
          </tr>`;
          tbody.insertAdjacentHTML('afterbegin', trHtml);
        }
      });
      rows = document.querySelectorAll(`#${tableId} tbody tr`);
    }
  } else {
    // Dispatch tab
    const matchedCases = allCases.filter(c => {
      if (!c || c.exception_type === 'Withdrawn') return false;
      const docCode = (c.doc_code || '').toUpperCase();
      const claimNo = (c.claim_no || '').toUpperCase();
      const polNo = (c.policy_no || '').toUpperCase();
      return searchTerms.some(t => t === docCode || t === claimNo || t === polNo);
    });

    if (matchedCases.length > 0) {
      const existingDocCodes = new Set(Array.from(rows).map(r => r.getAttribute('data-doccode')));
      matchedCases.forEach(c => {
        if (!existingDocCodes.has(c.doc_code)) {
          const trHtml = `<tr data-doccode="${c.doc_code}" data-claim="${c.claim_no||''}">
            <td><input type="checkbox" checked onchange="updateBulkDocSelectionCount()"></td>
            <td style="font-family:var(--mono); font-weight:700;">${c.doc_code}</td>
            <td>${c.date||''}</td>
            <td style="font-family:var(--mono); font-weight:700; color:var(--navy);">${c.claim_no||''}</td>
            <td>${c.insured_name||''}</td>
            <td>${c.inv1||'—'}</td>
          </tr>`;
          tbody.insertAdjacentHTML('afterbegin', trHtml);
        }
      });
      rows = document.querySelectorAll(`#${tableId} tbody tr`);
    }
  }

  // Uncheck header checkbox
  const headerCb = document.querySelector(`#${tableId} thead input[type="checkbox"]`);
  if (headerCb) headerCb.checked = false;

  rows.forEach(tr => {
    const cb = tr.querySelector('input[type="checkbox"]');
    if (!cb) return;
    
    const docCode = (tr.getAttribute('data-doccode') || '').toUpperCase();
    const claimNo = (tr.getAttribute('data-claim') || '').toUpperCase();
    
    const matches = searchTerms.some(term => term === docCode || term === claimNo);
    cb.checked = matches;
    if (matches) {
      matchCount++;
      tr.style.backgroundColor = 'rgba(217, 119, 6, 0.12)';
    } else {
      tr.style.backgroundColor = '';
    }
  });

  showToast(`✓ ${matchCount} case(s) matched and selected!`);
  updateBulkDocSelectionCount();
}

function renderBulkDocReceive() {
  const name = document.getElementById('bulkdoc-receive-inv').value;
  const tbody = document.getElementById('bulkdoc-receive-table').querySelector('tbody');
  tbody.innerHTML = '';
  
  const allCases = window.cases || cases || [];
  
  // Find cases where this person is INV1 (and HC isn't Received) OR INV2 (and HC isn't Received)
  const pendingCases = allCases.filter(c => {
    if (!c || c.exception_type === 'Withdrawn') return false;
    const isInv1Pending = c.inv1 && c.inv1 !== 'NA' && (c.hardcopy1_status || '').toLowerCase() !== 'received';
    const isInv2Pending = c.inv2 && c.inv2 !== 'NA' && (c.hardcopy2_status || '').toLowerCase() !== 'received';
    
    if (!isInv1Pending && !isInv2Pending) return false;
    if (!name || name === 'ALL') return true;
    return (c.inv1 === name && isInv1Pending) || (c.inv2 === name && isInv2Pending);
  });
  
  if (pendingCases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:24px;">No pending hard copies found.</td></tr>';
    updateBulkDocSelectionCount(); return;
  }
  
  tbody.innerHTML = pendingCases.map(c => {
    let roles = [];
    const isInv1Pending = c.inv1 && c.inv1 !== 'NA' && (c.hardcopy1_status || '').toLowerCase() !== 'received';
    const isInv2Pending = c.inv2 && c.inv2 !== 'NA' && (c.hardcopy2_status || '').toLowerCase() !== 'received';
    if (name === 'ALL' || !name) {
      if (isInv1Pending) roles.push(`INV1: ${c.inv1}`);
      if (isInv2Pending) roles.push(`INV2: ${c.inv2}`);
    } else {
      if (c.inv1 === name && isInv1Pending) roles.push('INV1');
      if (c.inv2 === name && isInv2Pending) roles.push('INV2');
    }
    
    return `<tr data-doccode="${c.doc_code}" data-claim="${c.claim_no||''}" data-roles="${(name==='ALL'||!name)?'INV1,INV2':roles.join(',')}">
      <td><input type="checkbox" checked onchange="updateBulkDocSelectionCount()"></td>
      <td style="font-family:var(--mono);font-weight:700;">${c.doc_code}</td>
      <td>${c.date||''}</td>
      <td style="font-family:var(--mono);font-weight:700;color:var(--navy);">${c.claim_no||''}</td>
      <td>${c.insured_name||''}</td>
      <td>${roles.join(' & ') || c.inv1 || '—'}</td>
      <td><span style="color:var(--red);font-weight:600;">Not Received</span></td>
    </tr>`;
  }).join('');
  updateBulkDocSelectionCount();
}

function renderBulkDocDispatch() {
  const comp = document.getElementById('bulkdoc-dispatch-co').value;
  const tbody = document.getElementById('bulkdoc-dispatch-table').querySelector('tbody');
  tbody.innerHTML = '';
  
  const allCases = window.cases || cases || [];
  
  // Find cases for this company that aren't Dispatched or Delivered
  const pendingCases = allCases.filter(c => {
    if (!c || c.exception_type === 'Withdrawn') return false;
    if (comp && comp !== 'ALL' && c.company !== comp) return false;
    return (c.company_hardcopy_status !== 'Dispatched' && c.company_hardcopy_status !== 'Delivered');
  });
  
  if (pendingCases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:24px;">No pending dispatches found.</td></tr>';
    updateBulkDocSelectionCount(); return;
  }
  
  tbody.innerHTML = pendingCases.map(c => {
    return `<tr data-doccode="${c.doc_code}" data-claim="${c.claim_no||''}">
      <td><input type="checkbox" checked onchange="updateBulkDocSelectionCount()"></td>
      <td style="font-family:var(--mono);font-weight:700;">${c.doc_code}</td>
      <td>${c.date||''}</td>
      <td style="font-family:var(--mono);font-weight:700;color:var(--navy);">${c.claim_no||''}</td>
      <td>${c.insured_name||''}</td>
      <td>${c.inv1||'—'}</td>
    </tr>`;
  }).join('');
  updateBulkDocSelectionCount();
}

async function safeUpdateCaseInDB(docCode, toUpdate) {
  // First attempt with full update payload
  let res = await supabaseClient.from('cases').update(toUpdate).eq('doc_code', docCode);
  if (res.error) {
    console.warn(`[SafeUpdate] Full update failed for ${docCode}, falling back to core fields:`, res.error.message);
    const coreUpdate = { ...toUpdate };
    delete coreUpdate.hardcopy_receive_date;
    delete coreUpdate.company_dispatch_date;
    const retryRes = await supabaseClient.from('cases').update(coreUpdate).eq('doc_code', docCode);
    if (retryRes.error) {
      console.error(`[SafeUpdate] Fallback update failed for ${docCode}:`, retryRes.error);
      throw retryRes.error;
    }
  }
  return true;
}

async function processBulkDocs() {
  const btn = document.getElementById('bulkdoc-process-btn');
  btn.disabled = true;
  btn.textContent = 'Processing & Syncing...';
  
  let updates = [];
  
  if (currentDocTab === 'receive') {
    const recDate = document.getElementById('bulkdoc-receive-date').value;
    const rows = document.querySelectorAll('#bulkdoc-receive-table tbody tr');
    rows.forEach(tr => {
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb && cb.checked) {
        const docCode = tr.getAttribute('data-doccode');
        const roles = (tr.getAttribute('data-roles') || '').split(',');
        
        let toUpdate = {};
        if (roles.includes('INV1') || roles.length === 0 || roles.some(r => r.includes('INV1'))) {
          toUpdate.hardcopy1_status = 'Received';
        }
        if (roles.includes('INV2') || roles.some(r => r.includes('INV2'))) {
          toUpdate.hardcopy2_status = 'Received';
        }
        if (!toUpdate.hardcopy1_status && !toUpdate.hardcopy2_status) {
          toUpdate.hardcopy1_status = 'Received';
        }
        if (recDate) toUpdate.hardcopy_receive_date = recDate;
        
        updates.push({ docCode, toUpdate });
      }
    });
  } else {
    const awb = document.getElementById('bulkdoc-dispatch-awb').value.trim();
    const dispDate = document.getElementById('bulkdoc-dispatch-date').value;
    const rows = document.querySelectorAll('#bulkdoc-dispatch-table tbody tr');
    rows.forEach(tr => {
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb && cb.checked) {
        const docCode = tr.getAttribute('data-doccode');
        let toUpdate = {
          company_hardcopy_status: 'Dispatched',
          company_hardcopy_awb: awb
        };
        if (dispDate) toUpdate.company_dispatch_date = dispDate;
        
        updates.push({ docCode, toUpdate });
      }
    });
  }
  
  if (updates.length === 0) {
    showToast('No cases selected', true);
    btn.disabled = false;
    btn.textContent = 'Apply Changes';
    return;
  }

  if (typeof recordBatchSnapshot === 'function' && updates.length) {
    recordBatchSnapshot({
      action: currentDocTab === 'receive' ? `Hardcopy Inward: received docs for ${updates.length} cases` : `Hardcopy Dispatch: dispatched ${updates.length} cases`,
      type: 'update',
      docCodes: updates.map(u => u.docCode)
    });
  }
  
  // Apply optimistic updates locally immediately for instantaneous UI feedback
  const targetList = window.cases || cases || [];
  updates.forEach(u => {
    const found = targetList.find(c => c && c.doc_code === u.docCode);
    if (found) {
      Object.assign(found, u.toUpdate);
    }
  });
  window.cases = targetList;
  cases = targetList;
  renderAll();

  // Process in parallel chunks to save to database
  try {
    let successCount = 0;
    let failedCount = 0;
    const chunkSize = 10;
    
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      const promises = chunk.map(u => 
        safeUpdateCaseInDB(u.docCode, u.toUpdate)
          .then(() => { successCount++; })
          .catch(err => {
            console.error('Failed to update DB for', u.docCode, err);
            failedCount++;
          })
      );
      await Promise.all(promises);
    }
    
    if (successCount > 0) {
      showToast(`✓ Successfully updated & saved ${successCount} cases to database!`);
    }
    if (failedCount > 0) {
      showToast(`⚠️ ${failedCount} cases failed to update on database`, true);
    }
    
    // Refresh authoritative data from DB and re-render
    await loadCasesFromDB();
    renderAll();
    closeModal('bulkdoc-modal');
  } catch (err) {
    console.error('Bulk Doc Error', err);
    showToast('An error occurred during update: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Changes';
  }
}


// ============================================================
// ADVANCED FIELD PERMISSIONS
// ============================================================
const FIELD_GROUPS = [
  { id: 'group_company', label: 'Company & Case Type', elements: ['f-company', 'f-casetype', 'f-date'] },
  { id: 'group_patient', label: 'Claim & Patient Details', elements: ['f-claim', 'f-policy', 'f-insured', 'f-hospital', 'f-location', 'f-sla'] },
  { id: 'group_assignment', label: 'Investigator Assignment', elements: ['f-inv1', 'f-inv2', 'f-transfer-reason'] },
  { id: 'group_fees', label: 'Investigator Fees & TA', elements: ['f-fee1', 'f-fee2', 'f-ta1', 'f-ta2', 'f-total'] },
  { id: 'group_payout', label: 'Client Payouts & Invoicing', elements: ['f-received', 'f-invoice', 'f-profit'] },
  { id: 'group_paystatus', label: 'Payment Statuses', elements: ['f-inv1status', 'f-inv2status'] },
  { id: 'group_hardcopy', label: 'Investigator Hard Copies', elements: ['f-hardcopy1status', 'f-hardcopy2status', 'f-hardcopy-same-btn'] },
  { id: 'group_dispatch', label: 'Company Dispatch Details', elements: ['f-companyhardcopy', 'f-companyawb'] },
  { id: 'group_outcome', label: 'Outcome & Remarks', elements: ['f-outcome', 'f-remarks'] }
];
const PERM_ROLES = ['senior', 'junior', 'accounts', 'company'];

function renderPermissionsMatrix() {
  const tbody = document.getElementById('permissions-matrix')?.querySelector('tbody');
  if (!tbody) return;
  
  const perms = settings.fieldPermissions || {};
  
  tbody.innerHTML = FIELD_GROUPS.map(group => {
    let rowHtml = `<tr><td style="font-weight:600;">${group.label}</td>`;
    
    PERM_ROLES.forEach(role => {
      // Default is 'edit'
      const val = perms[group.id] && perms[group.id][role] ? perms[group.id][role] : 'edit';
      rowHtml += `<td style="text-align:center;">
        <select class="perm-select" data-group="${group.id}" data-role="${role}" style="padding:4px; font-size:11px; border-radius:3px; border:1px solid var(--line);" onchange="saveSettings()">
          <option value="edit" ${val === 'edit' ? 'selected' : ''}>✏️ Edit</option>
          <option value="read" ${val === 'read' ? 'selected' : ''}>🔒 Read-Only</option>
          <option value="hide" ${val === 'hide' ? 'selected' : ''}>🚫 Hidden</option>
        </select>
      </td>`;
    });
    
    rowHtml += '</tr>';
    return rowHtml;
  }).join('');
}

function buildFieldPermissionsPayload() {
  const perms = settings.fieldPermissions || {};
  const selects = document.querySelectorAll('.perm-select');
  selects.forEach(sel => {
    const group = sel.getAttribute('data-group');
    const role = sel.getAttribute('data-role');
    const val = sel.value;
    if (!perms[group]) perms[group] = {};
    perms[group][role] = val;
  });
  return perms;
}

function applyFieldPermissions() {
  // Always reset everything to visible and editable first
  FIELD_GROUPS.forEach(group => {
    group.elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        // Find closest form-grid (fg) wrapper if exists to hide it
        const fg = el.closest('.fg');
        if (fg) fg.style.display = 'flex';
        else el.style.display = '';
        
        // Don't enable strictly readonly fields like auto-calculated totals
        if (id !== 'f-total' && id !== 'f-profit') {
          el.disabled = false;
        }
      }
    });
  });

  // Admin sees everything editable always
  if (window.isCurrentUserAdmin) return;
  
  const role = window.currentUserRole;
  if (!role || !PERM_ROLES.includes(role)) return; // Default staff fallback

  const perms = settings.fieldPermissions || {};
  
  FIELD_GROUPS.forEach(group => {
    const permission = perms[group.id] && perms[group.id][role] ? perms[group.id][role] : 'edit';
    
    group.elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const fg = el.closest('.fg');
        
        if (permission === 'hide') {
          if (fg) fg.style.display = 'none';
          else el.style.display = 'none';
        } else if (permission === 'read') {
          el.disabled = true; // Still submits value in saveCase() since it reads DOM value directly
        }
      }
    });
  });
}


function renderAssignedRoles() {
  const container = document.getElementById('assigned-roles-list');
  if (!container) return;
  const staffRoles = (settings.fieldPermissions && settings.fieldPermissions._staffRoles) ? settings.fieldPermissions._staffRoles : {};
  const emails = Object.keys(staffRoles);
  
  if (emails.length === 0) {
    container.innerHTML = '<div style="padding:10px; color:var(--sub); text-align:center;">No custom roles assigned yet.</div>';
    return;
  }
  
  let html = '<table class="data-table" style="width:100%; margin:0;"><tbody>';
  emails.forEach(email => {
    html += `<tr>
      <td style="font-weight:600;">${email}</td>
      <td style="text-transform:capitalize;">${staffRoles[email]}</td>
      <td style="text-align:right;"><button class="btn btn-ghost btn-sm" style="color:var(--amber); padding:2px 6px;" onclick="removeAssignedRole('${email}')">Remove</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function assignRoleByEmail() {
  const email = document.getElementById('assign-role-email').value.trim().toLowerCase();
  const role = document.getElementById('assign-role-select').value;
  if (!email || !email.includes('@')) { showToast('Enter a valid email.', true); return; }
  
  if (!settings.fieldPermissions) settings.fieldPermissions = {};
  if (!settings.fieldPermissions._staffRoles) settings.fieldPermissions._staffRoles = {};
  
  // Sync to database table for RLS
  try {
    const { error } = await supabaseClient.rpc('assign_role_to_email', { p_email: email, p_role: role });
    if (error) throw error;
    
    settings.fieldPermissions._staffRoles[email] = role;
    saveSettings();
    renderAssignedRoles();
    document.getElementById('assign-role-email').value = '';
    showToast(`Assigned '${role}' to ${email}`);
  } catch (err) {
    console.error('Role sync failed:', err);
    showToast('DB Sync failed: ' + err.message + '. (Make sure to run master_setup.sql in Supabase)', true);
  }
}

async function removeAssignedRole(email) {
  if (settings.fieldPermissions && settings.fieldPermissions._staffRoles) {
    try {
      const { error } = await supabaseClient.rpc('remove_role_from_email', { p_email: email });
      if (error) throw error;
      
      delete settings.fieldPermissions._staffRoles[email];
      saveSettings();
      renderAssignedRoles();
      showToast(`Removed role for ${email}`);
    } catch (err) {
      console.error('Role removal failed:', err);
      showToast('DB Sync failed: ' + err.message, true);
    }
  }
}
init();


// ============================================================
// HOSPITAL RISK CALCULATION
// ============================================================
function checkHospitalRisk(hosp) {
  const warningEl = document.getElementById('hospital-risk-warning');
  const pctEl = document.getElementById('hospital-risk-pct');
  if (!warningEl || !pctEl) return;
  if (!hosp || !hosp.trim()) {
    warningEl.style.display = 'none';
    return;
  }
  
  const hName = hosp.trim().toLowerCase();
  const hospCases = cases.filter(c => (c.hospital||'').trim().toLowerCase() === hName);
  if (hospCases.length < 3) {
    warningEl.style.display = 'none';
    return;
  }
  
  const rejected = hospCases.filter(c => c.outcome === 'Rejected' || c.exception_type === 'Rejected').length;
  const fraudRate = Math.round((rejected / hospCases.length) * 100);
  
  if (fraudRate >= 30) {
    pctEl.textContent = fraudRate;
    warningEl.style.display = 'flex';
  } else {
    warningEl.style.display = 'none';
  }
}


// Restrict all date inputs to not allow future dates
function restrictFutureDates() {
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => {
    el.setAttribute('max', today);
  });
  document.querySelectorAll('input[type="month"]').forEach(el => {
    el.setAttribute('max', today.substring(0, 7));
  });
}




window.viewHospitalCases = function(hName) {
    const hospitalCases = cases.filter(c => c.hospital && c.hospital.trim().toUpperCase() === hName);
    
    document.getElementById('hospital-modal-title').textContent = 'Cases for: ' + hName + ' (' + hospitalCases.length + ')';
    
    let html = '';
    hospitalCases.forEach(c => {
        const outcome = c.outcome || 'Pending';
        let outColor = 'var(--sub)';
        let bg = 'transparent';
        const outLow = outcome.toLowerCase();
        const excLow = (c.exception_type||'').toLowerCase();
        
        if (outLow.includes('repudiated') || outLow.includes('fraud') || outLow.includes('rejected') || excLow.includes('rejected') || outLow.includes('fake')) {
            outColor = 'var(--red)';
            bg = '#FFF5F3';
        } else if (outLow.includes('approved') || outLow.includes('genuine') || outLow.includes('settled') || outLow.includes('paid')) {
            outColor = 'var(--green)';
            bg = '#F0F8F3';
        } else if (outLow.includes('suspicious') || outLow.includes('hold') || outLow.includes('doubt')) {
            outColor = '#966C18';
            bg = '#FBF7ED';
        }

        html += `<tr data-id="${c.id}" data-doccode="${c.doc_code || ''}" style="background:${bg}; border-bottom:1px solid #E3E8EC; cursor:pointer;">
            <td class="mono" style="font-weight:600;">${c.doc_code || '—'}</td>
            <td>${c.date || '—'}</td>
            <td class="mono">${c.claim_no || '—'}</td>
            <td>${c.company || '—'}</td>
            <td style="font-weight:600;">${c.insured_name || '—'}</td>
            <td style="color:${outColor}; font-weight:800; font-size:10.5px; text-transform:uppercase;">${outcome} ${c.exception_type ? `(${c.exception_type})` : ''}</td>
        </tr>`;
    });
    
    document.getElementById('hospital-modal-tbody').innerHTML = html || '<tr><td colspan="6" style="text-align:center;padding:20px;">No cases found</td></tr>';
    document.getElementById('hospital-cases-modal').style.display = 'flex';
};



window.renderAll = renderAll;
window.handleRealtimePayload = (payload) => {
  if (typeof cases === 'undefined') return;
  const processRow = (row) => ({
    ...row, 
    total_payable: Number(row.total_payable || 0), 
    profit: Number(row.profit || 0),
    fee1: Number(row.fee1 || 0), 
    fee2: Number(row.fee2 || 0), 
    ta1: Number(row.ta1 || 0), 
    ta2: Number(row.ta2 || 0), 
    received: Number(row.received || 0)
  });

  if (payload.eventType === 'INSERT') {
    const exists = cases.some(c => c.id === payload.new.id);
    if (!exists) cases.unshift(processRow(payload.new));
  } else if (payload.eventType === 'UPDATE') {
    const idx = cases.findIndex(c => c.id === payload.new.id);
    if (idx !== -1) cases[idx] = processRow(payload.new);
  } else if (payload.eventType === 'DELETE') {
    const idx = cases.findIndex(c => c.id === payload.old.id);
    if (idx !== -1) cases.splice(idx, 1);
  }
  window.cases = cases;
  renderAll();
};
