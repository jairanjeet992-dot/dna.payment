// ========================================================================
// 🏢 COMPANY OUTSTANDING & PAYMENT RECOVERY HUB
// Dedicated engine for tracking unpaid cases by company, exporting
// company-facing Excel recovery sheets with return-information columns,
// managing Reject & Withdrawn business logic, and recording remittances.
// ========================================================================

window.crSelectedCompany = '';
window.crSelectedCategory = 'billable_unpaid';
window.crSelectedMonth = '';
window.crSearchQuery = '';
window.crSelectedDocCodes = new Set();
window.crCurrentFilteredCases = [];

/**
 * Evaluates a case and returns its billing, exception, and recovery profile.
 */
window.getCaseBillingProfile = function(c) {
  const exType = (c.exception_type || '').trim();
  const isWithdrawn = exType.toLowerCase() === 'withdrawn';
  const isRejected = exType.toLowerCase() === 'rejected';
  
  const invoiceAmt = Number(c.invoice_amount || 0);
  const receivedAmt = Number(c.received || 0);
  const tdsAmt = Number(c.tds_deducted || 0);
  const payableAmt = Number(c.total_payable || 0);
  const settledAmt = receivedAmt + tdsAmt;

  // Billing amount logic:
  // Withdrawn = 0 (cancelled by company)
  // Otherwise if invoice_amount is specified, use it. If not, use payableAmt as baseline or 0.
  const billedAmt = isWithdrawn ? 0 : (invoiceAmt > 0 ? invoiceAmt : (payableAmt > 0 ? payableAmt : 0));
  
  // Balance due logic (deducts both Bank Received and Client TDS Deducted):
  let balanceDue = 0;
  if (isWithdrawn) {
    balanceDue = 0;
  } else if (isRejected) {
    balanceDue = billedAmt > 0 ? billedAmt : (payableAmt > 0 ? payableAmt : 0);
  } else {
    balanceDue = Math.max(0, billedAmt - settledAmt);
  }

  let category = 'billable_unpaid';
  let statusBadge = '';
  let logicExplanation = '';

  if (isWithdrawn) {
    category = 'withdrawn';
    statusBadge = '<span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-weight:700;">⚫ Withdrawn / Cancelled</span>';
    logicExplanation = c.exception_reason ? `Cancelled: ${c.exception_reason}` : 'Assignment cancelled by insurer (Zero-Billing)';
  } else if (isRejected) {
    category = 'rejected';
    statusBadge = '<span class="badge danger" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-weight:700;">🔴 Rejected Bill</span>';
    logicExplanation = c.exception_reason ? `Rejected: ${c.exception_reason}` : 'Bill rejected by insurer (Reason query required)';
  } else if (settledAmt > 0 && balanceDue > 0) {
    category = 'partially_paid';
    statusBadge = '<span class="badge warning" style="background:#fef3c7; color:#92400e; border:1px solid #fcd34d; font-weight:700;">🟡 Partially Paid</span>';
    const parts = [`Recv ₹${fmt(receivedAmt)}`];
    if (tdsAmt > 0) parts.push(`TDS ₹${fmt(tdsAmt)}`);
    logicExplanation = `${parts.join(' + ')} of ₹${fmt(billedAmt)} (Due ₹${fmt(balanceDue)})`;
  } else if (balanceDue > 0 || (billedAmt === 0 && receivedAmt === 0 && tdsAmt === 0)) {
    category = 'billable_unpaid';
    if (billedAmt > 0) {
      statusBadge = '<span class="badge" style="background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe; font-weight:700;">🔵 Billable Overdue</span>';
      logicExplanation = `Invoiced ₹${fmt(billedAmt)} — Payment Pending`;
    } else {
      statusBadge = '<span class="badge" style="background:#e0e7ff; color:#3730a3; border:1px solid #c7d2fe; font-weight:700;">🟣 Bill Pending / Completed</span>';
      logicExplanation = 'Investigation Completed — Invoice Not Set';
    }
  } else {
    category = 'paid';
    statusBadge = '<span class="badge success" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:700;">🟢 Paid in Full</span>';
    logicExplanation = tdsAmt > 0 
      ? `Fully Settled (₹${fmt(receivedAmt)} Recv + ₹${fmt(tdsAmt)} TDS)`
      : `Fully Received (₹${fmt(receivedAmt)})`;
  }

  return {
    isWithdrawn,
    isRejected,
    invoiceAmt,
    receivedAmt,
    tdsAmt,
    settledAmt,
    payableAmt,
    billedAmt,
    balanceDue,
    category,
    statusBadge,
    logicExplanation,
    outcome: c.outcome || 'Pending'
  };
};

/**
 * Opens the Company Outstanding & Recovery Modal
 */
window.openCompanyRecoveryModal = function(preselectedCompany = '') {
  const modal = document.getElementById('company-recovery-modal');
  if (!modal) return;

  if (preselectedCompany) {
    window.crSelectedCompany = preselectedCompany;
  }

  // Populate company dropdown
  const compSelect = document.getElementById('cr-company-select');
  if (compSelect) {
    const compList = (window.COMPANIES && Array.isArray(window.COMPANIES) && window.COMPANIES.length)
      ? window.COMPANIES
      : ["ADITYA BIRLA","BRAINBIRD","CARE","CHOLA","IFFCO TOKIO","KOTAK","MAGMA","RELIANCE","SBI","STAR HEALTH","TATA AIA","TATA AIG","VIDAL HEALTH"];
    
    compSelect.innerHTML = '<option value="">All Companies</option>' + 
      compList.map(c => `<option value="${escAttr(c)}" ${c.toUpperCase() === (window.crSelectedCompany||'').toUpperCase() ? 'selected' : ''}>${escAttr(c)}</option>`).join('');
  }

  // Populate month dropdown from cases
  const monthSelect = document.getElementById('cr-month-select');
  if (monthSelect) {
    const allCases = window.cases || [];
    const monthSet = new Set();
    allCases.forEach(c => {
      if (c.date && c.date.length >= 7) {
        monthSet.add(c.date.slice(0, 7));
      }
    });
    const sortedMonths = Array.from(monthSet).sort().reverse();
    monthSelect.innerHTML = '<option value="">All Time</option>' +
      sortedMonths.map(m => `<option value="${m}">${m}</option>`).join('');
    monthSelect.value = window.crSelectedMonth || '';
  }

  // Set category
  const catSelect = document.getElementById('cr-category-select');
  if (catSelect && window.crSelectedCategory) {
    catSelect.value = window.crSelectedCategory;
  }

  window.crSelectedDocCodes.clear();
  modal.classList.add('open');

  // Check saved collapsed preference (default to collapsed for maximum cases room)
  const savedCollapsed = localStorage.getItem('dna_cr_stats_collapsed');
  const shouldCollapse = savedCollapsed === null ? true : (savedCollapsed === 'true');
  applyCRStatsDisplay(shouldCollapse);

  renderCompanyRecoveryHub();
};

function applyCRStatsDisplay(collapse) {
  const panel = document.getElementById('cr-collapsible-panel');
  const btn = document.getElementById('cr-toggle-stats-btn');
  const miniStrip = document.getElementById('cr-mini-stats-strip');
  if (!panel) return;
  if (collapse) {
    panel.style.display = 'none';
    if (btn) btn.innerHTML = '📊 Show Stats Cards';
    if (miniStrip) miniStrip.style.display = 'inline-flex';
  } else {
    panel.style.display = 'block';
    if (btn) btn.innerHTML = '▴ Hide Stats Cards';
    if (miniStrip) miniStrip.style.display = 'none';
  }
}

/**
 * Toggles the KPI & intelligence stats panel to give maximum height to the table
 */
window.toggleCRStats = function() {
  const panel = document.getElementById('cr-collapsible-panel');
  if (!panel) return;
  const isCurrentlyHidden = panel.style.display === 'none';
  // If hidden, show it; if shown, collapse it
  const newCollapse = !isCurrentlyHidden;
  applyCRStatsDisplay(newCollapse);
  try {
    localStorage.setItem('dna_cr_stats_collapsed', String(newCollapse));
  } catch (_) {}
};

/**
 * Resets filters back to default
 */
window.resetCompanyRecoveryFilters = function() {
  window.crSelectedCompany = '';
  window.crSelectedCategory = 'billable_unpaid';
  window.crSelectedMonth = '';
  window.crSearchQuery = '';
  window.crSelectedDocCodes.clear();

  const compSelect = document.getElementById('cr-company-select');
  if (compSelect) compSelect.value = '';
  const catSelect = document.getElementById('cr-category-select');
  if (catSelect) catSelect.value = 'billable_unpaid';
  const monthSelect = document.getElementById('cr-month-select');
  if (monthSelect) monthSelect.value = '';
  const searchInp = document.getElementById('cr-search-input');
  if (searchInp) searchInp.value = '';

  renderCompanyRecoveryHub();
};

/**
 * Renders the intelligence notice, KPI cards, and case table
 */
window.renderCompanyRecoveryHub = function() {
  const compSelect = document.getElementById('cr-company-select');
  if (compSelect) window.crSelectedCompany = compSelect.value.trim();

  const catSelect = document.getElementById('cr-category-select');
  if (catSelect) window.crSelectedCategory = catSelect.value;

  const monthSelect = document.getElementById('cr-month-select');
  if (monthSelect) window.crSelectedMonth = monthSelect.value;

  const searchInp = document.getElementById('cr-search-input');
  if (searchInp) window.crSearchQuery = (searchInp.value || '').trim().toLowerCase();

  const allCases = window.cases || [];

  // Filter cases
  let filtered = allCases.filter(c => {
    // 1. Company filter
    if (window.crSelectedCompany) {
      if ((c.company || '').trim().toUpperCase() !== window.crSelectedCompany.toUpperCase()) return false;
    }

    // 2. Month filter
    if (window.crSelectedMonth) {
      if (!(c.date || '').startsWith(window.crSelectedMonth)) return false;
    }

    const profile = getCaseBillingProfile(c);

    // 3. Category filter
    if (window.crSelectedCategory === 'billable_unpaid') {
      // Must NOT be withdrawn or rejected, and must be pending payment
      if (profile.isWithdrawn || profile.isRejected) return false;
      if (profile.receivedAmt > 0 && profile.balanceDue <= 0) return false; // Already paid in full
    } else if (window.crSelectedCategory === 'rejected') {
      if (!profile.isRejected) return false;
    } else if (window.crSelectedCategory === 'withdrawn') {
      if (!profile.isWithdrawn) return false;
    } else if (window.crSelectedCategory === 'partially_paid') {
      if (profile.category !== 'partially_paid') return false;
    } else if (window.crSelectedCategory === 'all_unpaid') {
      // Show any unpaid, rejected, or partially paid (exclude fully paid)
      if (profile.receivedAmt > 0 && profile.balanceDue <= 0) return false;
    }

    // 4. Search query
    if (window.crSearchQuery) {
      const q = window.crSearchQuery;
      const match = (c.claim_no && c.claim_no.toLowerCase().includes(q)) ||
                    (c.doc_code && c.doc_code.toLowerCase().includes(q)) ||
                    (c.insured_name && c.insured_name.toLowerCase().includes(q)) ||
                    (c.hospital && c.hospital.toLowerCase().includes(q)) ||
                    (c.policy_no && c.policy_no.toLowerCase().includes(q)) ||
                    (c.invoice_no && c.invoice_no.toLowerCase().includes(q)) ||
                    (c.location && c.location.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // Sort by date desc
  filtered.sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.doc_code||'').localeCompare(a.doc_code||''));
  window.crCurrentFilteredCases = filtered;

  // Render Intelligence Notice Banner
  renderCRIntelligenceBanner();

  // Calculate Metrics
  let totalBilled = 0;
  let totalReceived = 0;
  let totalTds = 0;
  let totalDue = 0;

  filtered.forEach(c => {
    const prof = getCaseBillingProfile(c);
    totalBilled += prof.billedAmt;
    totalReceived += prof.receivedAmt;
    totalTds += prof.tdsAmt;
    totalDue += prof.balanceDue;
  });

  // Update KPI Cards
  const elCases = document.getElementById('cr-kpi-cases');
  const elBilled = document.getElementById('cr-kpi-billed');
  const elRecv = document.getElementById('cr-kpi-received');
  const elDue = document.getElementById('cr-kpi-due');

  if (elCases) elCases.textContent = filtered.length;
  if (elBilled) elBilled.textContent = '₹' + fmt(totalBilled);
  if (elRecv) {
    elRecv.innerHTML = `₹${fmt(totalReceived)}${totalTds > 0 ? `<span style="font-size:11px; font-weight:600; color:#b45309; display:block; margin-top:2px;">(+₹${fmt(totalTds)} TDS)</span>` : ''}`;
  }
  if (elDue) elDue.textContent = '₹' + fmt(totalDue);

  // Update Mini Header / Toolbar Stats Strip (for compact view)
  const miniCases = document.getElementById('cr-mini-cases');
  const miniBilled = document.getElementById('cr-mini-billed');
  const miniRecv = document.getElementById('cr-mini-received');
  const miniDue = document.getElementById('cr-mini-due');
  if (miniCases) miniCases.textContent = `${filtered.length} Cases`;
  if (miniBilled) miniBilled.textContent = '₹' + fmt(totalBilled);
  if (miniRecv) miniRecv.textContent = '₹' + fmt(totalReceived);
  if (miniDue) miniDue.textContent = '₹' + fmt(totalDue);

  // Table count
  const countChip = document.getElementById('cr-table-count');
  if (countChip) countChip.textContent = `${filtered.length} Cases`;

  // Selected count badge
  updateCRSelectionBadge();

  // Render Table
  const tbody = document.getElementById('cr-table-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="14" style="text-align:center; padding:32px 16px; color:var(--sub);">
          <div style="font-size:24px; margin-bottom:8px;">🔍</div>
          <div style="font-weight:700; font-size:13px; color:var(--navy);">No matching cases found</div>
          <div style="font-size:11px; margin-top:4px;">Try changing the Company, Category filter, or Month period.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((c, idx) => {
    const prof = getCaseBillingProfile(c);
    const isSelected = window.crSelectedDocCodes.has(c.doc_code);
    
    // Outcome badge styling
    let outcomeBadge = `<span style="font-size:10.5px; color:var(--sub);">${escAttr(prof.outcome)}</span>`;
    if (prof.outcome === 'Fraud') {
      outcomeBadge = `<span style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-weight:700; font-size:10px;">⚠️ Fraud (Billable)</span>`;
    } else if (prof.outcome === 'Repudiated') {
      outcomeBadge = `<span style="background:#ffedd5; color:#c2410c; padding:2px 6px; border-radius:4px; font-weight:700; font-size:10px;">🛡️ Repudiated (Billable)</span>`;
    } else if (prof.outcome === 'Genuine') {
      outcomeBadge = `<span style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-weight:700; font-size:10px;">✓ Genuine</span>`;
    }

    return `
      <tr style="border-bottom:1px solid var(--line); ${isSelected ? 'background:color-mix(in srgb, var(--navy) 6%, transparent);' : ''}">
        <td style="text-align:center; padding:6px;">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCRSelect('${escAttr(c.doc_code)}', this.checked)">
        </td>
        <td style="font-family:var(--mono); font-weight:700; color:var(--navy); padding:6px;">${escAttr(c.doc_code || '—')}</td>
        <td style="font-family:var(--mono); font-weight:700; padding:6px;">${escAttr(c.claim_no || '—')}</td>
        <td style="padding:6px;"><span style="font-size:10.5px; font-weight:700; background:var(--bg); border:1px solid var(--line); border-radius:3px; padding:2px 6px;">${escAttr(c.company || '—')}</span></td>
        <td style="padding:6px; font-weight:600;">${escAttr(c.insured_name || '—')} <span style="font-size:10px; color:var(--sub); display:block;">Pol: ${escAttr(c.policy_no || '—')}</span></td>
        <td style="padding:6px; font-size:11px;">${escAttr(c.hospital || '—')}<span style="color:var(--sub); display:block; font-size:10px;">📍 ${escAttr(c.location || '—')}</span></td>
        <td style="padding:6px; font-size:11px; white-space:nowrap;">${escAttr(c.date || '—')}</td>
        <td style="padding:6px; font-family:var(--mono); font-size:11px;">${escAttr(c.invoice_no || '—')}</td>
        <td style="padding:6px; text-align:right; font-weight:600;">₹${fmt(prof.billedAmt)}</td>
        <td style="padding:6px; text-align:right; color:#15803d; font-weight:600;">
          ₹${fmt(prof.receivedAmt)}
          ${prof.tdsAmt > 0 ? `<span style="font-size:10px; color:#b45309; display:block; font-weight:700;">+₹${fmt(prof.tdsAmt)} TDS</span>` : ''}
        </td>
        <td style="padding:6px; text-align:right; font-weight:800; color:${prof.balanceDue > 0 ? '#b91c1c' : '#15803d'};">₹${fmt(prof.balanceDue)}</td>
        <td style="padding:6px; text-align:center;">${outcomeBadge}</td>
        <td style="padding:6px; text-align:center;">
          ${prof.statusBadge}
          <div style="font-size:9.5px; color:var(--sub); margin-top:2px;">${escAttr(prof.logicExplanation)}</div>
        </td>
        <td style="padding:6px; text-align:center; white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" style="font-size:10px; padding:2px 6px;" onclick="openRecordRemittanceModal('${escAttr(c.doc_code)}')" title="Record Payment / Region">⚡ Pay</button>
        </td>
      </tr>
    `;
  }).join('');
};

/**
 * Renders contextual intelligence alert explaining why cases are classified this way.
 */
function renderCRIntelligenceBanner() {
  const banner = document.getElementById('cr-intelligence-banner');
  if (!banner) return;

  const cat = window.crSelectedCategory;
  const comp = window.crSelectedCompany || 'All Companies';

  if (cat === 'billable_unpaid') {
    banner.style.background = '#f0fdf4';
    banner.style.border = '1px solid #bbf7d0';
    banner.style.color = '#166534';
    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b>🟢 Standard Company Recovery Mode (${escAttr(comp)}):</b> Showing active completed investigations where payment is pending. 
          <b>Withdrawn</b> and <b>Rejected</b> cases are automatically excluded so your company recovery sheet contains <u>100% verified billable claims</u>.
        </div>
        <span style="font-size:10px; background:#dcfce7; padding:2px 8px; border-radius:4px; font-weight:700; white-space:nowrap;">Clean Ledger</span>
      </div>
    `;
  } else if (cat === 'rejected') {
    banner.style.background = '#fef2f2';
    banner.style.border = '1px solid #fecaca';
    banner.style.color = '#991b1b';
    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b>🔴 Disputed &amp; Rejected Bills Query Mode:</b> In these cases, the investigator was paid by the agency, but the insurance company disallowed/rejected the payment. 
          Export this sheet to demand a <u>formal rejection reason</u>, policy clause clarification, or resubmit for claim review.
        </div>
        <span style="font-size:10px; background:#fee2e2; padding:2px 8px; border-radius:4px; font-weight:700; white-space:nowrap;">Disputed Bills</span>
      </div>
    `;
  } else if (cat === 'withdrawn') {
    banner.style.background = '#f8fafc';
    banner.style.border = '1px solid #cbd5e1';
    banner.style.color = '#334155';
    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b>⚫ Cancelled / Withdrawn Cases Mode:</b> Cases recalled or cancelled by the insurer (e.g. duplicate allotment, wrong area). 
          Both company billing and investigator fees are locked at ₹0. Use this list for closure and audit reconciliation.
        </div>
        <span style="font-size:10px; background:#e2e8f0; padding:2px 8px; border-radius:4px; font-weight:700; white-space:nowrap;">Zero-Bill Audit</span>
      </div>
    `;
  } else if (cat === 'partially_paid') {
    banner.style.background = '#fffbeb';
    banner.style.border = '1px solid #fde68a';
    banner.style.color = '#92400e';
    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b>🟡 Partially Paid / Short-Settlement Mode:</b> Cases where the company paid part of the invoice (e.g. 1-2% TDS deduction or disallowed TA). 
          Use this to follow up on deductions or balance recovery.
        </div>
        <span style="font-size:10px; background:#fef3c7; padding:2px 8px; border-radius:4px; font-weight:700; white-space:nowrap;">TDS / Short-Pay</span>
      </div>
    `;
  } else {
    banner.style.background = '#eff6ff';
    banner.style.border = '1px solid #bfdbfe';
    banner.style.color = '#1e40af';
    banner.innerHTML = `
      <div>
        <b>📋 Complete Outstanding Ledger:</b> Showing all unpaid and disputed cases. 
        <i>Pro-Tip: Cases with Outcome <b>'Fraud'</b> or <b>'Repudiated'</b> are 100% billable because the agency successfully protected the insurer's liability.</i>
      </div>
    `;
  }
}

/**
 * Toggles selection of a single case
 */
window.toggleCRSelect = function(docCode, checked) {
  if (checked) {
    window.crSelectedDocCodes.add(docCode);
  } else {
    window.crSelectedDocCodes.delete(docCode);
  }
  updateCRSelectionBadge();
};

/**
 * Select / Deselect all visible cases
 */
window.toggleCRSelectAll = function(checked) {
  if (checked) {
    window.crCurrentFilteredCases.forEach(c => {
      if (c.doc_code) window.crSelectedDocCodes.add(c.doc_code);
    });
  } else {
    window.crSelectedDocCodes.clear();
  }
  updateCRSelectionBadge();
  renderCompanyRecoveryHub();
};

function updateCRSelectionBadge() {
  const badge = document.getElementById('cr-selected-count-badge');
  const selAll = document.getElementById('cr-select-all');
  const payBtn = document.getElementById('cr-record-pay-btn');

  const count = window.crSelectedDocCodes.size;
  if (badge) {
    badge.textContent = count > 0 ? `(${count} selected)` : '';
  }
  if (selAll) {
    selAll.checked = count > 0 && count === window.crCurrentFilteredCases.length;
  }
  if (payBtn) {
    payBtn.textContent = count > 1 ? `⚡ Record Payment for (${count}) Cases` : '⚡ Record Payment / Region Details';
  }
}

// ========================================================================
// 📊 EXPORT COMPANY RECOVERY EXCEL (.XLSX)
// Generates an executive, client-ready Excel spreadsheet with:
// 1. Official Header with Agency Name & Outstanding Summary
// 2. Full Case Data (Claim No, Policy, Insured, Hospital, Invoice, Billed, Recv, Due, Outcome)
// 3. Designated "[COMPANY USE]" columns for the Insurance Company to fill:
//    Region, Payment UTR, Payment Date, TDS/Deduction Amount, and Rejection Remarks
// ========================================================================
window.exportCompanyRecoveryExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Excel library is loading. Please check your internet connection.', true);
    return;
  }

  const casesToExport = window.crCurrentFilteredCases;
  if (!casesToExport || casesToExport.length === 0) {
    showToast('No cases to export in current filter.', true);
    return;
  }

  const compName = window.crSelectedCompany || 'ALL COMPANIES';
  const categoryKey = window.crSelectedCategory;
  const todayStr = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  let categoryLabel = 'Billable Unpaid Recovery Statement';
  if (categoryKey === 'rejected') categoryLabel = 'Disputed / Rejected Bills Query Statement';
  else if (categoryKey === 'withdrawn') categoryLabel = 'Cancelled / Withdrawn Cases Audit Statement';
  else if (categoryKey === 'partially_paid') categoryLabel = 'Short-Settlement & TDS Deduction Recovery Statement';
  else if (categoryKey === 'all_unpaid') categoryLabel = 'Comprehensive Outstanding Ledger';

  let totalBilled = 0;
  let totalRecv = 0;
  let totalTds = 0;
  let totalDue = 0;

  casesToExport.forEach(c => {
    const p = getCaseBillingProfile(c);
    totalBilled += p.billedAmt;
    totalRecv += p.receivedAmt;
    totalTds += (p.tdsAmt || 0);
    totalDue += p.balanceDue;
  });

  // Construct Sheet Data via Array-of-Arrays
  const aoa = [
    // Header Block
    ["DNA PROFESSIONAL INVESTIGATION AGENCY"],
    ["CLIENT OUTSTANDING PAYMENT RECOVERY & RECONCILIATION STATEMENT"],
    ["Insurance Client / Company:", compName, "Generated On:", todayStr, "Statement Type:", categoryLabel],
    [
      "Summary Metrics:",
      `Total Cases: ${casesToExport.length}`,
      `Total Billed: Rs ${fmt(totalBilled)}`,
      `Total Received: Rs ${fmt(totalRecv)}`,
      `Total TDS Deducted: Rs ${fmt(totalTds)}`,
      `Net Outstanding Balance Due: Rs ${fmt(totalDue)}`
    ],
    [""], // Empty spacing row

    // Table Column Headers (Row 6)
    [
      "S.No.",
      "Agency Doc Code",
      "Insurance Claim No",
      "Policy No",
      "Insured / Patient Name",
      "Hospital / Medical Center",
      "City / Location",
      "Investigation Type",
      "Allocation Date",
      "Agency Invoice No",
      "Invoice Billed Amount (INR)",
      "Amount Received (INR)",
      "TDS Deducted (INR)",
      "Outstanding Balance Due (INR)",
      "Investigation Outcome / Finding",
      "Billing Classification",
      "Agency Remarks / Exceptions",
      "[COMPANY USE] Regional Office / Branch",
      "[COMPANY USE] Settlement Status (Paid / In-Process / Disallowed)",
      "[COMPANY USE] Payment UTR / Cheque Ref No",
      "[COMPANY USE] Payment Date (DD/MM/YYYY)",
      "[COMPANY USE] TDS / Deduction Amount (INR)",
      "[COMPANY USE] Remarks / Reason for Deduction or Rejection"
    ]
  ];

  // Populate Data Rows
  casesToExport.forEach((c, idx) => {
    const prof = getCaseBillingProfile(c);
    aoa.push([
      idx + 1,
      c.doc_code || '',
      c.claim_no || '',
      c.policy_no || '',
      c.insured_name || '',
      c.hospital || '',
      c.location || '',
      c.case_type || '',
      c.date || '',
      c.invoice_no || '',
      prof.billedAmt,
      prof.receivedAmt,
      prof.tdsAmt || 0,
      prof.balanceDue,
      prof.outcome || 'Pending',
      prof.category.toUpperCase(),
      c.remarks || (c.exception_reason ? `Exception: ${c.exception_reason}` : ''),
      "", // [COMPANY USE] Region / Branch
      "", // [COMPANY USE] Settlement Status
      "", // [COMPANY USE] UTR No
      "", // [COMPANY USE] Payment Date
      "", // [COMPANY USE] Deduction Amount
      ""  // [COMPANY USE] Reason / Remarks
    ]);
  });

  // Add Grand Totals Row
  aoa.push([
    "",
    "GRAND TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    totalBilled,
    totalRecv,
    totalTds,
    totalDue,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Define Column Widths for readability
  ws['!cols'] = [
    { wch: 6 },   // S.No
    { wch: 16 },  // Doc Code
    { wch: 18 },  // Claim No
    { wch: 16 },  // Policy No
    { wch: 24 },  // Insured Name
    { wch: 24 },  // Hospital
    { wch: 16 },  // Location
    { wch: 16 },  // Case Type
    { wch: 13 },  // Date
    { wch: 16 },  // Invoice No
    { wch: 16 },  // Billed
    { wch: 16 },  // Recv
    { wch: 16 },  // Due
    { wch: 18 },  // Outcome
    { wch: 18 },  // Billing Classification
    { wch: 24 },  // Agency Remarks
    { wch: 22 },  // [COMPANY USE] Region
    { wch: 24 },  // [COMPANY USE] Settlement Status
    { wch: 24 },  // [COMPANY USE] UTR No
    { wch: 18 },  // [COMPANY USE] Payment Date
    { wch: 18 },  // [COMPANY USE] TDS Deduction
    { wch: 32 }   // [COMPANY USE] Reason / Remarks
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Recovery Statement');

  const cleanName = compName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `DNA_Recovery_${cleanName}_${categoryKey}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  showToast(`📊 Downloaded: ${filename}`);
};

// ========================================================================
// 📄 EXPORT PDF STATEMENT
// ========================================================================
window.exportCompanyRecoveryPDF = function() {
  const casesToExport = window.crCurrentFilteredCases;
  if (!casesToExport || casesToExport.length === 0) {
    showToast('No cases to export in current filter.', true);
    return;
  }

  const compName = window.crSelectedCompany || 'All Companies';
  const categoryKey = window.crSelectedCategory;
  const title = `Outstanding Statement — ${compName}`;

  let totalBilled = 0;
  let totalRecv = 0;
  let totalDue = 0;

  casesToExport.forEach(c => {
    const prof = getCaseBillingProfile(c);
    totalBilled += prof.billedAmt;
    totalRecv += prof.receivedAmt;
    totalDue += prof.balanceDue;
  });

  const summaryLines = [
    `Client: ${compName}`,
    `Classification: ${categoryKey.toUpperCase()}`,
    `Total Cases: ${casesToExport.length}`,
    `Total Billed: Rs ${fmt(totalBilled)}`,
    `Total Received: Rs ${fmt(totalRecv)}`,
    `Outstanding Balance: Rs ${fmt(totalDue)}`
  ];

  if (typeof buildReportHTML === 'function' && typeof openPDFPreview === 'function') {
    const html = buildReportHTML(title, summaryLines, casesToExport);
    openPDFPreview(html, `${title.replace(/\s+/g, '_')}.pdf`, { orientation: 'landscape' });
  } else {
    window.print();
  }
};

// ========================================================================
// ⚡ RECORD REMITTANCE & REGION DETAILS (SINGLE OR BATCH)
// ========================================================================
window.openRecordRemittanceModal = function(singleDocCode = null) {
  const modal = document.getElementById('cr-remittance-modal');
  if (!modal) return;

  let targetDocCodes = [];
  if (singleDocCode) {
    targetDocCodes = [singleDocCode];
  } else if (window.crSelectedDocCodes.size > 0) {
    targetDocCodes = Array.from(window.crSelectedDocCodes);
  } else {
    showToast('Please select at least one case using the checkboxes first.', true);
    return;
  }

  const allCases = window.cases || [];
  const targetCases = allCases.filter(c => targetDocCodes.includes(c.doc_code));

  if (targetCases.length === 0) {
    showToast('Could not find selected cases.', true);
    return;
  }

  window.crRemitTargetCases = targetCases;

  const infoEl = document.getElementById('cr-remit-target-info');
  let totalDue = 0;
  targetCases.forEach(c => {
    const p = getCaseBillingProfile(c);
    totalDue += p.balanceDue;
  });

  if (targetCases.length === 1) {
    const c = targetCases[0];
    const p = getCaseBillingProfile(c);
    infoEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <b style="font-family:var(--mono); color:var(--navy); font-size:14px;">${escAttr(c.doc_code)}</b>
          <span style="color:var(--sub); font-size:12px;"> (Claim: ${escAttr(c.claim_no)})</span>
          <div style="font-weight:700; margin-top:2px;">${escAttr(c.insured_name)}</div>
          <div style="font-size:11px; color:var(--sub);">${escAttr(c.company)} • ${escAttr(c.hospital)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px; color:var(--sub);">Balance Due</div>
          <b style="font-size:16px; color:#b91c1c;">₹${fmt(p.balanceDue)}</b>
          <div style="font-size:10px; color:var(--sub);">Billed: ₹${fmt(p.billedAmt)} | Recv: ₹${fmt(p.receivedAmt)}</div>
        </div>
      </div>
    `;
    const regInp = document.getElementById('cr-remit-region');
    if (regInp) regInp.value = c.location || '';
    const amtInp = document.getElementById('cr-remit-custom-amount');
    if (amtInp) amtInp.value = p.balanceDue > 0 ? p.balanceDue : (p.billedAmt || '');
  } else {
    infoEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b style="color:var(--navy); font-size:13px;">Updating ${targetCases.length} Selected Cases</b>
          <div style="font-size:11px; color:var(--sub); margin-top:2px;">Claims: ${targetCases.slice(0, 4).map(c=>c.claim_no).join(', ')}${targetCases.length > 4 ? '...' : ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px; color:var(--sub);">Total Due</div>
          <b style="font-size:16px; color:#b91c1c;">₹${fmt(totalDue)}</b>
        </div>
      </div>
    `;
  }

  // Set default payment date to today
  const dateInp = document.getElementById('cr-remit-date');
  if (dateInp) dateInp.value = new Date().toISOString().slice(0, 10);

  const utrInp = document.getElementById('cr-remit-utr');
  if (utrInp) utrInp.value = '';

  const remarksInp = document.getElementById('cr-remit-remarks');
  if (remarksInp) remarksInp.value = '';

  const modeSel = document.getElementById('cr-remit-mode');
  if (modeSel) modeSel.value = 'full';
  onCRRemitModeChange();

  modal.classList.add('open');
};

window.onCRRemitModeChange = function() {
  const mode = document.getElementById('cr-remit-mode')?.value;
  const amtGroup = document.getElementById('cr-remit-amt-group');
  if (amtGroup) {
    amtGroup.style.display = mode === 'custom' ? 'block' : 'none';
  }
};

window.saveCRRemittance = async function() {
  const targetCases = window.crRemitTargetCases;
  if (!targetCases || targetCases.length === 0) {
    showToast('No target cases selected.', true);
    return;
  }

  const mode = document.getElementById('cr-remit-mode')?.value || 'full';
  const customAmt = parseFloat(document.getElementById('cr-remit-custom-amount')?.value || 0) || 0;
  const utr = (document.getElementById('cr-remit-utr')?.value || '').trim();
  const date = document.getElementById('cr-remit-date')?.value || '';
  const region = (document.getElementById('cr-remit-region')?.value || '').trim();
  const remarks = (document.getElementById('cr-remit-remarks')?.value || '').trim();

  const saveBtn = document.getElementById('cr-remit-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving to Database...'; }

  let successCount = 0;
  let totalRecvUpdated = 0;

  try {
    for (const c of targetCases) {
      const p = getCaseBillingProfile(c);
      let newReceived = p.receivedAmt;
      let newTds = p.tdsAmt || 0;

      if (mode === 'full') {
        newReceived = p.billedAmt > 0 ? p.billedAmt : (p.payableAmt || 0);
      } else if (mode === 'custom') {
        newReceived = customAmt;
        const tdsInp = document.getElementById('cr-remit-tds-amount');
        if (tdsInp && tdsInp.value !== '') {
          newTds = parseFloat(tdsInp.value) || 0;
        }
      }

      const totalPayable = Number(c.total_payable || 0);
      const newProfit = (newReceived + newTds) - totalPayable;

      const updates = {
        received: newReceived,
        tds_deducted: newTds,
        profit: newProfit
      };

      // If region is entered, update location
      if (region) {
        updates.location = region;
      }

      // Build updated remarks
      let appendNotes = [];
      if (utr) appendNotes.push(`UTR: ${utr}`);
      if (date) appendNotes.push(`PayDate: ${date}`);
      if (remarks) appendNotes.push(remarks);

      if (appendNotes.length > 0) {
        const noteStr = appendNotes.join(' | ');
        updates.remarks = c.remarks ? `${c.remarks} [${noteStr}]` : noteStr;
      }

      // 1. Supabase update
      if (supabaseClient) {
        const { error } = await supabaseClient
          .from('cases')
          .update(updates)
          .eq('id', c.id);
        if (error) throw error;
      }

      // 2. In-memory update
      c.received = newReceived;
      c.tds_deducted = newTds;
      c.profit = newProfit;
      if (updates.location) c.location = updates.location;
      if (updates.remarks) c.remarks = updates.remarks;

      successCount++;
      totalRecvUpdated += newReceived;
    }

    // 3. Activity log
    if (supabaseClient) {
      try {
        await supabaseClient.from('activity_log').insert({
          action: 'COMPANY_PAYMENT_RECOVERY_UPDATED',
          module: 'Company Recovery',
          details: `Recorded company payment for ${successCount} cases (${targetCases[0]?.company || 'Multiple'}). UTR: ${utr || 'N/A'}`
        });
      } catch (_) {}
    }

    // 4. Refresh Views
    window.crSelectedDocCodes.clear();
    renderCompanyRecoveryHub();
    if (typeof filterCases === 'function') filterCases();
    if (typeof renderDashboard === 'function') renderDashboard();

    showToast(`✅ Successfully updated payment & region details for ${successCount} cases!`);
    closeModal('cr-remittance-modal');

  } catch (err) {
    console.error('Error saving company remittance:', err);
    showToast('Failed to save remittance: ' + err.message, true);
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Payment & Update Database'; }
  }
};
