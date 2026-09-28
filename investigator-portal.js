// =============================================================================
// investigator-portal.js — Secure Field Investigator Self-Service Portal
// & Admin 1-Click TA Approval Queue Engine
// DNA Professional Investigation Agency
// =============================================================================
(() => {
  'use strict';

  // --- STATE ---
  let invSession = null;
  let invCases = [];
  let currentInvFilter = 'all';
  let currentInvMonth = 'all';
  let taAdminRequests = [];
  let currentTaAdminMonth = 'all';

  // Helper escape
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function fmtMoney(n) {
    return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  }

  // --- MONTH PARSING & FORMATTING UTILITIES ---
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function getCaseMonthKey(dateStr) {
    if (!dateStr) return 'Unknown';
    const str = String(dateStr).trim();
    const parts = str.split(/[-/]/);
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          return `${y}-${String(m).padStart(2, '0')}`;
        }
      } else {
        // DD-MM-YYYY or MM-DD-YYYY
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        let m = p1;
        if (p1 > 12 && p0 <= 12) m = p0;
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          return `${y}-${String(m).padStart(2, '0')}`;
        }
      }
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      return `${y}-${String(m).padStart(2, '0')}`;
    }
    return 'Unknown';
  }

  function formatMonthLabel(monthKey, short = false) {
    if (!monthKey || monthKey === 'all') return 'All Months';
    if (monthKey === 'Unknown') return 'Other Dates';
    const [y, m] = monthKey.split('-').map(Number);
    if (y && m && m >= 1 && m <= 12) {
      return short ? `${SHORT_MONTH_NAMES[m - 1]} ${y}` : `${MONTH_NAMES[m - 1]} ${y}`;
    }
    return monthKey;
  }

  // --- LOCAL/SESSION STORAGE HELPERS ---
  function getInvToken() {
    return sessionStorage.getItem('dna_inv_token');
  }

  function getInvProfile() {
    try {
      return JSON.parse(sessionStorage.getItem('dna_inv_profile') || 'null');
    } catch (e) {
      return null;
    }
  }

  // --- SWITCH BETWEEN ADMIN & INVESTIGATOR LOGIN SCREENS ---
  window.switchLoginTab = function(mode) {
    const adminForm = document.getElementById('login-admin-form');
    const invForm = document.getElementById('login-inv-form');
    const tabAdmin = document.getElementById('tab-login-admin');
    const tabInv = document.getElementById('tab-login-inv');

    if (!adminForm || !invForm) return;

    if (mode === 'inv') {
      adminForm.style.display = 'none';
      invForm.style.display = 'flex';
      if (tabAdmin) tabAdmin.classList.remove('active');
      if (tabInv) tabInv.classList.add('active');
    } else {
      adminForm.style.display = 'flex';
      invForm.style.display = 'none';
      if (tabAdmin) tabAdmin.classList.add('active');
      if (tabInv) tabInv.classList.remove('active');
    }
  };

  // --- INVESTIGATOR LOGIN ACTION ---
  window.doInvestigatorLogin = async function() {
    const phoneInput = document.getElementById('inv-login-phone');
    const pinInput = document.getElementById('inv-login-pin');
    const errEl = document.getElementById('inv-login-error');
    const btn = document.getElementById('inv-login-btn');

    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    const phone = (phoneInput?.value || '').trim().replace(/\D/g, '').slice(-10);
    const pin = (pinInput?.value || '').trim();

    if (!phone || phone.length !== 10) {
      if (errEl) { errEl.textContent = 'Please enter a valid 10-digit registered mobile number.'; errEl.style.display = 'block'; }
      return;
    }
    if (!pin || pin.length !== 4) {
      if (errEl) { errEl.textContent = 'Please enter your 4-digit security PIN.'; errEl.style.display = 'block'; }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }

    try {
      const res = await fetch('/api/investigator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid mobile number or security PIN.');
      }

      // Save session
      sessionStorage.setItem('dna_inv_token', data.token);
      sessionStorage.setItem('dna_inv_profile', JSON.stringify(data.investigator));
      invSession = data.investigator;

      // Hide login screen and display investigator portal app
      document.getElementById('login-screen').style.display = 'none';
      const portalApp = document.getElementById('investigator-portal-app');
      if (portalApp) {
        portalApp.style.display = 'block';
        initInvestigatorPortal();
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Login failed. Please verify credentials.';
        errEl.style.display = 'block';
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In to Portal'; }
    }
  };

  // --- INVESTIGATOR LOGOUT ---
  window.doInvestigatorLogout = function() {
    sessionStorage.removeItem('dna_inv_token');
    sessionStorage.removeItem('dna_inv_profile');
    invSession = null;
    invCases = [];
    const portalApp = document.getElementById('investigator-portal-app');
    if (portalApp) portalApp.style.display = 'none';
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      loginScreen.style.display = 'flex';
      window.switchLoginTab('inv');
    }
  };

  // --- INITIALIZE INVESTIGATOR PORTAL ---
  async function initInvestigatorPortal() {
    const profile = getInvProfile();
    if (!profile) {
      window.doInvestigatorLogout();
      return;
    }
    invSession = profile;

    // Set Header
    const nameEl = document.getElementById('inv-portal-name');
    const phoneEl = document.getElementById('inv-portal-phone');
    if (nameEl) nameEl.textContent = profile.name || 'Investigator';
    if (phoneEl) phoneEl.textContent = '📱 ' + (profile.phone || 'Phone not set');

    await loadInvestigatorCases();
  }

  // --- FETCH CASES FOR LOGGED IN INVESTIGATOR ---
  async function loadInvestigatorCases() {
    const token = getInvToken();
    if (!token) return;

    const listEl = document.getElementById('inv-portal-cases-list');
    if (listEl) {
      listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--sub);"><div class="dna-spinner" style="margin:0 auto 12px;"></div>Loading your assigned cases…</div>';
    }

    try {
      const res = await fetch('/api/investigator/my-cases', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 401) {
          window.doInvestigatorLogout();
          return;
        }
        throw new Error(data.error || 'Failed to load cases');
      }

      invCases = data.cases || [];
      populateMonthSelector();
      updateInvestigatorMetrics();
      renderInvestigatorCasesList();
    } catch (err) {
      if (listEl) {
        listEl.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red);">Failed to load cases: ${esc(err.message)}</div>`;
      }
    }
  }

  // --- POPULATE DYNAMIC MONTH SELECTOR & QUICK PILLS ---
  function populateMonthSelector() {
    const sel = document.getElementById('inv-portal-month-select');
    const pillsContainer = document.getElementById('inv-month-pills');
    if (!sel) return;

    // Count cases per monthKey
    const monthCounts = {};
    invCases.forEach(c => {
      const mk = getCaseMonthKey(c.date);
      monthCounts[mk] = (monthCounts[mk] || 0) + 1;
    });

    // Sort monthKeys descending (newest first, 'Unknown' at bottom)
    const sortedKeys = Object.keys(monthCounts).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return b.localeCompare(a);
    });

    // Populate Select Options
    let optionsHtml = `<option value="all" ${currentInvMonth === 'all' ? 'selected' : ''}>📅 All Months (${invCases.length} Cases)</option>`;
    sortedKeys.forEach(mk => {
      const label = formatMonthLabel(mk);
      const isSel = currentInvMonth === mk ? 'selected' : '';
      optionsHtml += `<option value="${esc(mk)}" ${isSel}>${esc(label)} (${monthCounts[mk]} Cases)</option>`;
    });
    sel.innerHTML = optionsHtml;

    // Populate Quick Month Pills for instant 1-tap filtering
    if (pillsContainer) {
      if (sortedKeys.length > 1) {
        let pillsHtml = `<button type="button" class="btn btn-ghost btn-sm inv-month-pill ${currentInvMonth === 'all' ? 'active' : ''}" style="padding:3px 8px;font-size:10.5px;font-weight:700;" onclick="onInvMonthSelect('all')">All</button>`;
        // Render top 4 months as quick tap pills
        sortedKeys.slice(0, 4).forEach(mk => {
          const isAct = currentInvMonth === mk ? 'active' : '';
          pillsHtml += `<button type="button" class="btn btn-ghost btn-sm inv-month-pill ${isAct}" style="padding:3px 8px;font-size:10.5px;font-weight:600;" onclick="onInvMonthSelect('${esc(mk)}')">${esc(formatMonthLabel(mk, true))} (${monthCounts[mk]})</button>`;
        });
        pillsContainer.innerHTML = pillsHtml;
        pillsContainer.style.display = 'flex';
      } else {
        pillsContainer.innerHTML = '';
        pillsContainer.style.display = 'none';
      }
    }
  }

  window.onInvMonthSelect = function(monthKey) {
    currentInvMonth = monthKey || 'all';

    // Sync dropdown if called from a pill button
    const sel = document.getElementById('inv-portal-month-select');
    if (sel && sel.value !== currentInvMonth) sel.value = currentInvMonth;

    // Sync pill active states
    document.querySelectorAll('.inv-month-pill').forEach(btn => {
      const onclickAttr = btn.getAttribute('onclick') || '';
      if (currentInvMonth === 'all' ? onclickAttr.includes("'all'") : onclickAttr.includes(`'${currentInvMonth}'`)) {
        btn.classList.add('active');
        btn.style.background = 'var(--navy)';
        btn.style.color = '#fff';
      } else {
        btn.classList.remove('active');
        btn.style.background = '';
        btn.style.color = '';
      }
    });

    updateInvestigatorMetrics();
    renderInvestigatorCasesList();
  };

  // --- UPDATE METRICS ROW ON PORTAL (SCOPED TO SELECTED MONTH) ---
  function updateInvestigatorMetrics() {
    // If a month is selected, scope KPIs specifically to that month
    const casesInScope = currentInvMonth === 'all'
      ? invCases
      : invCases.filter(c => getCaseMonthKey(c.date) === currentInvMonth);

    const totalCases = casesInScope.length;
    const paidCases = casesInScope.filter(c => c.is_paid || (c.payment_status || '').toLowerCase() === 'paid');
    const unpaidCases = casesInScope.filter(c => !c.is_paid && (c.payment_status || '').toLowerCase() !== 'paid');
    const taCases = casesInScope.filter(c => (c.ta_request && c.ta_request.status !== 'none' && c.ta_request.status !== 'local_zero') || c.current_ta > 0);
    const pendingFindingCases = casesInScope.filter(c => !c.outcome || c.outcome === 'Pending');

    const totalEarned = casesInScope.reduce((sum, c) => sum + (Number(c.assigned_fee) || 0) + (Number(c.current_ta) || 0), 0);
    const totalDisbursed = paidCases.reduce((sum, c) => sum + (Number(c.assigned_fee) || 0) + (Number(c.current_ta) || 0), 0);

    // KPI labels
    const mTotal = document.getElementById('inv-metric-total');
    const mUnpaid = document.getElementById('inv-metric-unpaid');
    const mPaid = document.getElementById('inv-metric-paid');
    const mEarned = document.getElementById('inv-metric-total-earned');
    const mDisbursed = document.getElementById('inv-metric-disbursed');

    if (mTotal) mTotal.textContent = totalCases;
    if (mUnpaid) mUnpaid.textContent = unpaidCases.length;
    if (mPaid) mPaid.textContent = paidCases.length;
    if (mEarned) mEarned.textContent = fmtMoney(totalEarned);
    if (mDisbursed) mDisbursed.textContent = fmtMoney(totalDisbursed);

    // Filter button count badges
    const cAll = document.getElementById('flt-count-all');
    const cUnpaid = document.getElementById('flt-count-unpaid');
    const cPaid = document.getElementById('flt-count-paid');
    const cTa = document.getElementById('flt-count-ta');
    const cPending = document.getElementById('flt-count-pending');

    if (cAll) cAll.textContent = totalCases;
    if (cUnpaid) cUnpaid.textContent = unpaidCases.length;
    if (cPaid) cPaid.textContent = paidCases.length;
    if (cTa) cTa.textContent = taCases.length;
    if (cPending) cPending.textContent = pendingFindingCases.length;

    // Month summary badge
    const badge = document.getElementById('inv-month-summary-badge');
    if (badge) {
      if (currentInvMonth !== 'all') {
        badge.innerHTML = `🗓️ <strong>${esc(formatMonthLabel(currentInvMonth))}</strong>: ${totalCases} Cases · ${fmtMoney(totalDisbursed)} Disbursed · <a href="javascript:void(0)" onclick="onInvMonthSelect('all')" style="color:var(--navy);font-weight:700;text-decoration:underline;margin-left:4px;">View All Months</a>`;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // --- FILTER PORTAL CASES ---
  window.setInvPortalFilter = function(filter, btn) {
    currentInvFilter = filter;
    document.querySelectorAll('.inv-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderInvestigatorCasesList();
  };

  // --- RENDER CASES CARDS FOR INVESTIGATOR ---
  function renderInvestigatorCasesList() {
    const listEl = document.getElementById('inv-portal-cases-list');
    if (!listEl) return;

    const searchQ = (document.getElementById('inv-portal-search')?.value || '').toLowerCase().trim();

    const filtered = invCases.filter(c => {
      // Month filter
      if (currentInvMonth !== 'all') {
        const cMonth = getCaseMonthKey(c.date);
        if (cMonth !== currentInvMonth) return false;
      }

      const isPaid = c.is_paid || (c.payment_status || '').toLowerCase() === 'paid';
      const out = (c.outcome || '').toLowerCase();

      if (currentInvFilter === 'unpaid' && isPaid) return false;
      if (currentInvFilter === 'paid' && !isPaid) return false;
      if (currentInvFilter === 'pending' && out !== 'pending' && out !== '') return false;
      if (currentInvFilter === 'completed' && (out === 'pending' || out === '')) return false;
      if (currentInvFilter === 'ta') {
        const hasTaReq = c.ta_request && c.ta_request.status !== 'none' && c.ta_request.status !== 'local_zero';
        if (!hasTaReq && c.current_ta <= 0) return false;
      }

      // Search query
      if (searchQ) {
        const text = `${c.doc_code} ${c.claim_no} ${c.insured_name} ${c.hospital} ${c.company}`.toLowerCase();
        if (!text.includes(searchQ)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px;background:var(--card);border-radius:12px;border:1px dashed var(--line);color:var(--sub);">
          <div style="font-size:28px;margin-bottom:8px;">📋</div>
          <div style="font-weight:700;font-size:13px;color:var(--ink);">No cases found</div>
          <div style="font-size:11px;">No assigned cases match your current filter (${currentInvFilter}).</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(c => {
      const isPaid = c.is_paid || (c.payment_status || '').toLowerCase() === 'paid';
      const taReq = c.ta_request || null;
      let taBadge = '';

      if (taReq && taReq.status === 'pending') {
        taBadge = `<span class="badge" style="background:var(--amber-bg);color:var(--amber);font-size:10px;">⏳ TA Pending Approval: ₹${Math.round(taReq.requested_amount)} (${taReq.distance_km || 0} km)</span>`;
      } else if (taReq && taReq.status === 'approved') {
        taBadge = `<span class="badge" style="background:var(--green-bg);color:var(--green);font-size:10px;">✅ TA Approved: ₹${Math.round(taReq.approved_amount || c.current_ta)}</span>`;
      } else if (taReq && taReq.status === 'rejected') {
        taBadge = `<span class="badge" style="background:var(--red-bg);color:var(--red);font-size:10px;" title="${esc(taReq.reject_reason || '')}">❌ TA Rejected: ₹0 (${esc(taReq.reject_reason || 'By Admin')})</span>`;
      } else if (c.current_ta > 0) {
        taBadge = `<span class="badge" style="background:var(--green-bg);color:var(--green);font-size:10px;">✅ TA: ₹${Math.round(c.current_ta)}</span>`;
      }

      const paymentBadge = isPaid
        ? `<span class="badge" style="background:var(--green-bg);color:var(--green);font-size:10.5px;font-weight:700;border:1px solid rgba(22,101,52,0.25);">✅ PAID</span>`
        : `<span class="badge" style="background:var(--amber-bg);color:var(--amber);font-size:10px;font-weight:600;">⏳ UNPAID</span>`;

      // Fee rendering with clear Rate Card Assessment explanation
      let feeDisplayHtml = '';
      if (c.assigned_fee > 0) {
        feeDisplayHtml = `
          <div>
            <span style="font-size:10px;text-transform:uppercase;color:var(--sub);font-weight:700;">Assigned Case Fee:</span>
            <strong style="font-size:14px;color:var(--navy);margin-left:6px;">₹${Math.round(c.assigned_fee)}</strong>
            <span class="badge" style="background:rgba(15,41,66,0.08);color:var(--navy);font-size:9px;margin-left:4px;">🔒 Pre-Locked</span>
          </div>
        `;
      } else {
        feeDisplayHtml = `
          <div>
            <span style="font-size:10px;text-transform:uppercase;color:var(--amber);font-weight:700;">Case Fee:</span>
            <strong style="font-size:12.5px;color:var(--amber);margin-left:6px;">⏳ Fee Assessment Pending</strong>
            <span class="badge" style="background:var(--amber-bg);color:var(--amber);font-size:9px;margin-left:4px;" title="Agency Admin will update fee based on company rate card">Rate Card Review</span>
            <div style="font-size:10px;color:var(--sub);margin-top:2px;">(Fee will be confirmed by Agency Admin as per company rate card)</div>
          </div>
        `;
      }

      return `
        <div class="inv-case-card" id="card-${esc(c.doc_code)}" style="${isPaid ? 'border-left:4px solid var(--green);' : ''}">
          <div class="inv-case-header">
            <div>
              <span class="inv-doc-code">${esc(c.doc_code)}</span>
              <span class="badge" style="background:var(--navy);color:#fff;font-size:9.5px;margin-left:6px;">${esc(c.case_type || 'Case')}</span>
              <span class="badge" style="background:rgba(184,134,46,0.15);color:var(--gold);font-size:9.5px;margin-left:4px;">${esc(c.company || '')}</span>
              <span class="badge" style="background:rgba(15,41,66,0.06);color:var(--navy);font-size:9.5px;margin-left:4px;font-weight:600;">🗓️ ${esc(formatMonthLabel(getCaseMonthKey(c.date), true))}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${paymentBadge}
              <div style="font-size:11px;color:var(--sub);font-weight:600;">📅 ${esc(c.date || '')}</div>
            </div>
          </div>

          <div class="inv-case-body">
            <div class="inv-case-patient">
              👤 <strong>${esc(c.insured_name || 'Patient Name')}</strong>
              <div style="font-size:11px;color:var(--sub);margin-top:2px;">Claim No: <span class="mono">${esc(c.claim_no || '—')}</span></div>
            </div>

            <div class="inv-case-hospital">
              🏥 <strong>${esc(c.hospital || 'Hospital')}</strong>
              <div style="font-size:11px;color:var(--sub);margin-top:2px;">📍 ${esc(c.location || 'Location')}</div>
            </div>

            <!-- Pre-locked Fee Banner (Read-Only) -->
            <div class="inv-fee-locked-banner">
              ${feeDisplayHtml}
              <div>${taBadge}</div>
            </div>

            <!-- Case Action Area: Settled Banner if Paid, Else Input Form -->
            ${isPaid ? `
              <div style="background:rgba(22,101,52,0.05);border:1px solid rgba(22,101,52,0.2);border-radius:8px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-weight:700;color:var(--green);font-size:12px;">✅ Case Payment Settled &amp; Disbursed</div>
                  <div style="font-size:11px;color:var(--sub);margin-top:2px;">
                    Finding: <strong>${esc(c.outcome || 'Completed')}</strong> &nbsp;|&nbsp;
                    Total Disbursed: <strong style="color:var(--ink);">₹${Math.round((c.assigned_fee || 0) + (c.current_ta || 0))}</strong> 
                    (Fee: ₹${Math.round(c.assigned_fee || 0)} + TA: ₹${Math.round(c.current_ta || 0)})
                  </div>
                  ${c.remarks ? `<div style="font-size:10.5px;color:var(--sub);margin-top:2px;">Notes: ${esc(c.remarks)}</div>` : ''}
                </div>
                <span class="badge" style="background:var(--green);color:#fff;font-size:9.5px;padding:4px 8px;">🔒 Settled &amp; Closed</span>
              </div>
            ` : `
              <!-- Action Input Form -->
              <div class="inv-case-inputs">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                  <div class="fg">
                    <label>Investigation Finding / Outcome</label>
                    <select id="outcome-${esc(c.doc_code)}" class="fin" style="width:100%;">
                      <option value="Pending" ${c.outcome === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                      <option value="Genuine" ${c.outcome === 'Genuine' ? 'selected' : ''}>✅ Genuine</option>
                      <option value="Fraud" ${c.outcome === 'Fraud' ? 'selected' : ''}>🚨 Fraud</option>
                      <option value="Suspicious" ${c.outcome === 'Suspicious' ? 'selected' : ''}>⚠️ Suspicious</option>
                      <option value="Repudiated" ${c.outcome === 'Repudiated' ? 'selected' : ''}>🚫 Repudiated</option>
                      <option value="Untraceable" ${c.outcome === 'Untraceable' ? 'selected' : ''}>❓ Untraceable</option>
                      <option value="Completed" ${c.outcome === 'Completed' ? 'selected' : ''}>✓ Completed</option>
                    </select>
                  </div>
                  <div class="fg">
                    <label>Travel Allowance (TA) Type</label>
                    <select id="ta-type-${esc(c.doc_code)}" class="fin" style="width:100%;" onchange="toggleOutstationFields('${esc(c.doc_code)}')">
                      <option value="local" ${(!taReq || taReq.status === 'none' || taReq.status === 'local_zero') ? 'selected' : ''}>🔘 Local Visit (₹0 TA Included)</option>
                      <option value="outstation" ${(taReq && (taReq.status === 'pending' || taReq.status === 'approved')) ? 'selected' : ''}>🚗 Outstation Travel Claim (Request TA)</option>
                    </select>
                  </div>
                </div>

                <!-- Outstation details (shown only if outstation selected) -->
                <div id="outstation-fields-${esc(c.doc_code)}" style="display:${(taReq && (taReq.status === 'pending' || taReq.status === 'approved')) ? 'grid' : 'none'};grid-template-columns:100px 140px 1fr;gap:10px;margin-top:10px;background:rgba(184,134,46,0.06);padding:10px;border-radius:6px;border:1px dashed var(--gold);">
                  <div class="fg">
                    <label>Distance (KM)</label>
                    <input type="number" id="dist-${esc(c.doc_code)}" class="fin" placeholder="e.g. 45" value="${taReq?.distance_km || ''}" min="0">
                  </div>
                  <div class="fg">
                    <label>Claim Amount (₹)</label>
                    <input type="number" id="ta-amt-${esc(c.doc_code)}" class="fin" placeholder="e.g. 350" value="${taReq?.requested_amount || ''}" min="0">
                  </div>
                  <div class="fg">
                    <label>Travel Reason / Toll Details</label>
                    <input type="text" id="ta-reason-${esc(c.doc_code)}" class="fin" placeholder="e.g. Rural village visit beyond city limit" value="${esc(taReq?.reason || '')}">
                  </div>
                </div>

                <div class="fg" style="margin-top:10px;">
                  <label>Investigation Notes / Remarks</label>
                  <input type="text" id="remarks-${esc(c.doc_code)}" class="fin" placeholder="Hospital admission verified, doctor statement collected…" value="${esc(c.remarks || '')}">
                </div>

                <div style="display:flex;justify-content:flex-end;margin-top:12px;">
                  <button type="button" class="btn btn-navy" id="save-btn-${esc(c.doc_code)}" onclick="saveInvestigatorCaseUpdate('${esc(c.doc_code)}')">
                    💾 Submit Case Update
                  </button>
                </div>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  window.toggleOutstationFields = function(docCode) {
    const sel = document.getElementById(`ta-type-${docCode}`);
    const box = document.getElementById(`outstation-fields-${docCode}`);
    if (sel && box) {
      box.style.display = sel.value === 'outstation' ? 'grid' : 'none';
    }
  };

  // --- SUBMIT CASE UPDATE FROM INVESTIGATOR PORTAL ---
  window.saveInvestigatorCaseUpdate = async function(docCode) {
    const token = getInvToken();
    if (!token) {
      window.doInvestigatorLogout();
      return;
    }

    const btn = document.getElementById(`save-btn-${docCode}`);
    const outcome = document.getElementById(`outcome-${docCode}`)?.value || 'Pending';
    const remarks = document.getElementById(`remarks-${docCode}`)?.value || '';
    const taType = document.getElementById(`ta-type-${docCode}`)?.value || 'local';
    const isOutstation = taType === 'outstation';

    let dist = 0;
    let reqTa = 0;
    let reason = '';

    if (isOutstation) {
      dist = parseFloat(document.getElementById(`dist-${docCode}`)?.value || '0') || 0;
      reqTa = parseFloat(document.getElementById(`ta-amt-${docCode}`)?.value || '0') || 0;
      reason = (document.getElementById(`ta-reason-${docCode}`)?.value || '').trim();

      if (reqTa <= 0) {
        if (typeof showToast === 'function') showToast('Please enter a valid requested TA amount (> ₹0) for outstation travel.', true);
        else alert('Please enter a valid requested TA amount (> ₹0).');
        return;
      }
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      const res = await fetch('/api/investigator/submit-case-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          doc_code: docCode,
          outcome,
          remarks,
          is_outstation: isOutstation,
          distance_km: dist,
          requested_ta: reqTa,
          reason
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit update');
      }

      if (typeof showToast === 'function') showToast(data.message || 'Case updated successfully!');
      await loadInvestigatorCases();
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Failed to save update', true);
      else alert(err.message || 'Failed to save update');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Submit Case Update'; }
    }
  };

  // --- INVESTIGATOR CHANGE PIN MODAL ---
  window.openChangePinModal = function() {
    const m = document.getElementById('inv-change-pin-modal');
    if (m) m.classList.add('open');
  };

  window.closeChangePinModal = function() {
    const m = document.getElementById('inv-change-pin-modal');
    if (m) m.classList.remove('open');
  };

  window.submitChangePin = async function() {
    const token = getInvToken();
    if (!token) return;

    const oldPin = document.getElementById('inv-old-pin')?.value || '';
    const newPin = document.getElementById('inv-new-pin')?.value || '';
    const confPin = document.getElementById('inv-confirm-pin')?.value || '';
    const errEl = document.getElementById('inv-pin-error');

    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    if (!/^\d{4}$/.test(newPin)) {
      if (errEl) { errEl.textContent = 'New PIN must be exactly 4 digits.'; errEl.style.display = 'block'; }
      return;
    }
    if (newPin !== confPin) {
      if (errEl) { errEl.textContent = 'New PIN and Confirm PIN do not match.'; errEl.style.display = 'block'; }
      return;
    }

    try {
      const res = await fetch('/api/investigator/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ old_pin: oldPin, new_pin: newPin })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to change PIN');
      }

      if (typeof showToast === 'function') showToast('Security PIN updated successfully!');
      window.closeChangePinModal();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Failed to update PIN';
        errEl.style.display = 'block';
      }
    }
  };

  // ===========================================================================
  // ADMIN TA APPROVAL QUEUE (DASHBOARD & TAB)
  // ===========================================================================

  window.renderTaApprovalsView = async function() {
    const view = document.getElementById('view-ta-approvals');
    if (!view) return;

    view.innerHTML = `
      <div class="panel-head">
        <div>
          <div class="panel-title">Field Travel Allowance (TA) Approval Queue</div>
          <div class="panel-sub">Review outstation travel claims requested by field investigators. Approved amounts lock directly into the case ledger and payout slips.</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select id="ta-admin-month-select" class="fin" style="height:32px;font-weight:700;font-size:12px;background:var(--paper);border-color:var(--line);border-radius:6px;min-width:160px;" onchange="onTaAdminMonthSelect(this.value)">
            <option value="all">📅 All Months</option>
          </select>
          <button class="btn btn-navy" onclick="renderTaApprovalsView()">🔄 Refresh Queue</button>
          <button class="btn btn-gold" onclick="approveAllNormalTa()">⚡ Auto-Approve Normal Local TA (≤ ₹150)</button>
        </div>
      </div>

      <div class="kpi-row" style="margin-bottom:18px;">
        <div class="kpi gold"><div class="kpi-label">Pending TA Requests</div><div class="kpi-value gold" id="ta-stat-pending">0</div></div>
        <div class="kpi"><div class="kpi-label">Total Requested Amount</div><div class="kpi-value" id="ta-stat-amount">₹0</div></div>
        <div class="kpi red"><div class="kpi-label">Batch Hospital Alerts</div><div class="kpi-value red" id="ta-stat-batch">0</div></div>
      </div>

      <div class="panel" style="padding:0;overflow:hidden;">
        <div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;background:var(--paper);">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost btn-sm ta-admin-filter active" onclick="filterTaAdminRequests('pending',this)">Pending Review</button>
            <button class="btn btn-ghost btn-sm ta-admin-filter" onclick="filterTaAdminRequests('all',this)">All Requests</button>
            <button class="btn btn-ghost btn-sm ta-admin-filter" onclick="filterTaAdminRequests('approved',this)">Approved</button>
            <button class="btn btn-ghost btn-sm ta-admin-filter" onclick="filterTaAdminRequests('rejected',this)">Rejected</button>
          </div>
          <div style="font-size:11px;color:var(--sub);" id="ta-admin-count-label">Loading requests…</div>
        </div>
        <div class="tbl-scroll" id="ta-admin-table-container">
          <div style="text-align:center;padding:40px;color:var(--sub);"><div class="dna-spinner" style="margin:0 auto 12px;"></div>Loading TA requests from database…</div>
        </div>
      </div>
    `;

    await fetchAdminTaRequests();
  };

  async function getAdminAuthHeaders() {
    if (typeof window.getAuthHeaders === 'function') {
      try {
        const h = await window.getAuthHeaders();
        if (h && (h.Authorization || h.authorization)) return h;
      } catch (e) {}
    }
    try {
      const session = (await window.supabaseClient?.auth?.getSession())?.data?.session;
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}` };
      }
    } catch (e) {}
    return {};
  }

  async function fetchAdminTaRequests() {
    try {
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/ta-approval/list', { headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch TA requests');

      taAdminRequests = data.requests || [];
      populateTaAdminMonthSelector();
      updateAdminTaStats();
      paintAdminTaTable(currentTaAdminFilter);
    } catch (err) {
      const c = document.getElementById('ta-admin-table-container');
      if (c) c.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red);">Failed to load TA requests: ${esc(err.message)}</div>`;
    }
  }

  function populateTaAdminMonthSelector() {
    const sel = document.getElementById('ta-admin-month-select');
    if (!sel) return;

    const monthCounts = {};
    taAdminRequests.forEach(r => {
      const mk = getCaseMonthKey(r.date);
      monthCounts[mk] = (monthCounts[mk] || 0) + 1;
    });

    const sortedKeys = Object.keys(monthCounts).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return b.localeCompare(a);
    });

    let opts = `<option value="all" ${currentTaAdminMonth === 'all' ? 'selected' : ''}>📅 All Months (${taAdminRequests.length} Requests)</option>`;
    sortedKeys.forEach(mk => {
      const isSel = currentTaAdminMonth === mk ? 'selected' : '';
      opts += `<option value="${esc(mk)}" ${isSel}>${esc(formatMonthLabel(mk))} (${monthCounts[mk]})</option>`;
    });
    sel.innerHTML = opts;
  }

  window.onTaAdminMonthSelect = function(val) {
    currentTaAdminMonth = val || 'all';
    updateAdminTaStats();
    paintAdminTaTable(currentTaAdminFilter);
  };

  function updateAdminTaStats() {
    const inScope = currentTaAdminMonth === 'all'
      ? taAdminRequests
      : taAdminRequests.filter(r => getCaseMonthKey(r.date) === currentTaAdminMonth);

    const pending = inScope.filter(r => r.status === 'pending');
    const totalPendingAmt = pending.reduce((s, r) => s + (Number(r.requested_amount) || 0), 0);
    const batchCount = pending.filter(r => r.is_batch_hospital).length;

    const pEl = document.getElementById('ta-stat-pending');
    const aEl = document.getElementById('ta-stat-amount');
    const bEl = document.getElementById('ta-stat-batch');
    const badge = document.getElementById('ta-pending-badge');

    if (pEl) pEl.textContent = pending.length;
    if (aEl) aEl.textContent = fmtMoney(totalPendingAmt);
    if (bEl) bEl.textContent = batchCount;

    if (badge) {
      const globalPending = taAdminRequests.filter(r => r.status === 'pending').length;
      if (globalPending > 0) {
        badge.textContent = globalPending;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  let currentTaAdminFilter = 'pending';
  window.filterTaAdminRequests = function(filter, btn) {
    currentTaAdminFilter = filter;
    document.querySelectorAll('.ta-admin-filter').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    paintAdminTaTable(filter);
  };

  function paintAdminTaTable(filter) {
    const c = document.getElementById('ta-admin-table-container');
    const lbl = document.getElementById('ta-admin-count-label');
    if (!c) return;

    const list = taAdminRequests.filter(r => {
      if (currentTaAdminMonth !== 'all' && getCaseMonthKey(r.date) !== currentTaAdminMonth) return false;
      if (filter === 'pending') return r.status === 'pending';
      if (filter === 'approved') return r.status === 'approved';
      if (filter === 'rejected') return r.status === 'rejected';
      return true;
    });

    if (lbl) lbl.textContent = `Showing ${list.length} request(s)`;

    if (list.length === 0) {
      c.innerHTML = `
        <div style="text-align:center;padding:50px 20px;color:var(--sub);">
          <div style="font-size:32px;margin-bottom:8px;">✅</div>
          <div style="font-weight:700;font-size:14px;color:var(--ink);">All Clean!</div>
          <div style="font-size:12px;">No TA approval requests matching "${filter}".</div>
        </div>
      `;
      return;
    }

    c.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Doc Code / Claim No</th>
            <th>Investigator</th>
            <th>Hospital & Location</th>
            <th>Distance / Reason</th>
            <th>Requested TA</th>
            <th>Status / Fraud Warning</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(r => {
            const isBatch = r.is_batch_hospital;
            let statusBadge = `<span class="badge ${r.status}">${r.status.toUpperCase()}</span>`;
            if (isBatch && r.status === 'pending') {
              statusBadge += `<br><span class="badge" style="background:var(--red-bg);color:var(--red);font-size:9px;margin-top:3px;">🚨 Same Hospital Batch Visit</span>`;
            }

            return `
              <tr>
                <td>${esc(r.date || '')}</td>
                <td>
                  <strong>${esc(r.doc_code)}</strong>
                  <div style="font-size:10px;color:var(--sub);font-family:var(--mono);">${esc(r.claim_no || '')}</div>
                </td>
                <td>
                  <strong>${esc(r.inv_name)}</strong>
                </td>
                <td>
                  <strong>${esc(r.hospital || '')}</strong>
                  <div style="font-size:10px;color:var(--sub);">${esc(r.location || '')}</div>
                </td>
                <td>
                  <strong>${r.distance_km ? esc(r.distance_km) + ' KM' : 'Outstation'}</strong>
                  <div style="font-size:10px;color:var(--sub);max-width:240px;overflow:hidden;text-overflow:ellipsis;" title="${esc(r.reason || '')}">
                    ${esc(r.reason || 'No reason provided')}
                  </div>
                </td>
                <td style="font-weight:700;font-family:var(--mono);font-size:13px;color:var(--navy);">
                  ₹${Math.round(r.requested_amount)}
                </td>
                <td>${statusBadge}</td>
                <td style="text-align:right;white-space:nowrap;">
                  ${r.status === 'pending' ? `
                    <button class="btn btn-navy btn-sm" onclick="processAdminTaAction('${esc(r.doc_code)}', 'approve', ${r.requested_amount})">✅ Approve ₹${Math.round(r.requested_amount)}</button>
                    <button class="btn btn-gold btn-sm" onclick="promptCustomTaApprove('${esc(r.doc_code)}', ${r.requested_amount})">✏️ Modify</button>
                    <button class="btn btn-danger btn-sm" onclick="processAdminTaAction('${esc(r.doc_code)}', 'reject', 0)">❌ Reject</button>
                  ` : `
                    <span style="font-size:11px;color:var(--sub);font-weight:600;">
                      ${r.status === 'approved' ? `Approved: ₹${Math.round(r.approved_amount || r.current_case_ta)}` : 'Rejected'}
                    </span>
                  `}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // --- PROCESS ADMIN TA ACTION ---
  window.processAdminTaAction = async function(docCode, action, amount, remarks = '') {
    try {
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/ta-approval/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          doc_code: docCode,
          action,
          approved_amount: amount,
          admin_remarks: remarks
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to process TA action');

      if (typeof showToast === 'function') showToast(data.message || `TA ${action}d successfully.`);
      await fetchAdminTaRequests();
      // Reload in-memory cases in app.js if present
      if (typeof loadCasesFromDB === 'function') await loadCasesFromDB();
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Action failed', true);
      else alert(err.message || 'Action failed');
    }
  };

  window.promptCustomTaApprove = function(docCode, defaultAmt) {
    const val = prompt(`Enter custom approved TA amount for case ${docCode}:`, defaultAmt);
    if (val === null) return;
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      alert('Please enter a valid amount.');
      return;
    }
    const remarks = prompt('Enter remark (e.g. Capped to standard rate):', 'Capped to standard rate');
    window.processAdminTaAction(docCode, 'modify', num, remarks || '');
  };

  // 1-Click Approve all standard TA <= 150
  window.approveAllNormalTa = async function() {
    const eligible = taAdminRequests.filter(r => r.status === 'pending' && r.requested_amount <= 150 && !r.is_batch_hospital);
    if (eligible.length === 0) {
      if (typeof showToast === 'function') showToast('No pending normal TA claims (≤ ₹150) without batch alerts found.');
      else alert('No eligible claims found.');
      return;
    }

    if (!confirm(`Are you sure you want to 1-Click Auto-Approve ${eligible.length} normal TA request(s) (≤ ₹150)?`)) {
      return;
    }

    let successCount = 0;
    const authHeaders = await getAdminAuthHeaders();
    for (const r of eligible) {
      try {
        await fetch('/api/admin/ta-approval/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            doc_code: r.doc_code,
            action: 'approve',
            approved_amount: r.requested_amount,
            admin_remarks: 'Auto-approved standard allowance'
          })
        });
        successCount++;
      } catch (e) {
        console.error('Batch approve error for', r.doc_code, e);
      }
    }

    if (typeof showToast === 'function') showToast(`Successfully auto-approved ${successCount} TA requests!`);
    await fetchAdminTaRequests();
    if (typeof loadCasesFromDB === 'function') await loadCasesFromDB();
  };

  // --- ADMIN RESET INVESTIGATOR PIN ---
  window.openAdminResetPinModal = async function(invName) {
    const newPin = prompt(`Enter new 4-digit security PIN for ${invName}:`, '1234');
    if (newPin === null) return;
    if (!/^\d{4}$/.test(newPin.trim())) {
      alert('PIN must be exactly 4 numeric digits.');
      return;
    }

    const authHeaders = await getAdminAuthHeaders();
    fetch('/api/admin/reset-inv-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ investigator_name: invName, new_pin: newPin.trim() })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error);
        if (typeof showToast === 'function') showToast(data.message || `PIN for ${invName} updated to ${newPin}!`);
        else alert(`PIN for ${invName} updated to ${newPin}!`);
      })
      .catch(err => {
        if (typeof showToast === 'function') showToast(err.message || 'Failed to reset PIN', true);
        else alert(err.message || 'Failed to reset PIN');
      });
  };

  // --- PERIODIC SYNC FOR PENDING BADGE ---
  async function checkPendingTaBadge() {
    const authHeaders = await getAdminAuthHeaders();
    fetch('/api/admin/ta-approval/list', { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.requests)) {
          const pending = data.requests.filter(r => r.status === 'pending');
          const badge = document.getElementById('ta-pending-badge');
          if (badge) {
            if (pending.length > 0) {
              badge.textContent = pending.length;
              badge.style.display = 'inline-block';
            } else {
              badge.style.display = 'none';
            }
          }
        }
      })
      .catch(() => {});
  }

  // --- AUTO BOOTSTRAP CHECK ---
  document.addEventListener('DOMContentLoaded', () => {
    // If URL has ?portal=1 or ?mode=portal, switch to investigator login or open portal
    const urlParams = new URLSearchParams(window.location.search);
    const isPortalMode = urlParams.get('portal') === '1' || urlParams.get('mode') === 'portal';

    if (isPortalMode) {
      const token = getInvToken();
      const profile = getInvProfile();
      if (token && profile) {
        document.getElementById('login-screen').style.display = 'none';
        const portalApp = document.getElementById('investigator-portal-app');
        if (portalApp) {
          portalApp.style.display = 'block';
          initInvestigatorPortal();
        }
      } else {
        window.switchLoginTab('inv');
      }
    } else {
      // Regular admin view: periodic badge check
      setInterval(checkPendingTaBadge, 45000);
      setTimeout(checkPendingTaBadge, 3000);
    }
  });

})();
