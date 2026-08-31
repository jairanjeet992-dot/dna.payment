// =============================================================================
// smart-merge-engine.js — Universal Smart Bulk Paste, Merge & Outcome Engine
// =============================================================================
(() => {
  'use strict';

  // Normalize helper for fuzzy matching claim numbers & names
  function normStr(v) {
    return String(v ?? '').trim();
  }

  function cleanKey(v) {
    return String(v ?? '').trim().toUpperCase().replace(/[\s\-_/\\#.]/g, '');
  }

  // Standardize Outcome strings into clean badges
  function standardizeOutcome(raw) {
    if (!raw) return 'Pending';
    const s = String(raw).trim().toLowerCase();
    if (s.includes('fraud') || s.includes('fake') || s.includes('bogus') || s.includes('fabricated')) return 'Fraud';
    if (s.includes('repudiat') || s.includes('reject') || s.includes('deni') || s.includes('cancel')) return 'Repudiated';
    if (s.includes('genuin') || s.includes('positive') || s.includes('ok') || s.includes('settled') || s.includes('approved')) return 'Genuine';
    if (s.includes('suspicious') || s.includes('doubt')) return 'Suspicious';
    if (s.includes('not found') || s.includes('untraceable')) return 'Not Found';
    if (s.includes('closed') || s.includes('completed')) return 'Settled';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function parseAmount(v) {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    const cleaned = String(v).replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  // Extended Dictionary for Intelligent Excel Column Mapping
  const EXTENDED_COL_MAP = {
    company: ['company', 'company name', 'client', 'insurance company', 'insurer', 'co', 'co.'],
    date: ['date', 'allocation date', 'assigned date', 'entry date', 'claim date', 'intimation date'],
    case_type: ['case_type', 'case type', 'type', 'claim type', 'investigation type'],
    claim_no: ['claim_no', 'claim no', 'claim no.', 'claim', 'claim number', 'claim id', 'clm no', 'claim_id', 'clm_no'],
    policy_no: ['policy_no', 'policy no', 'policy no.', 'policy', 'policy number', 'pol no'],
    insured_name: ['insured_name', 'insured name', 'insured', 'patient name', 'patient', 'customer name', 'customer', 'proposer', 'name'],
    hospital: ['hospital', 'hospital / address', 'hospital/address', 'hospital name', 'treating hospital', 'hosp name'],
    location: ['location', 'insured location', 'city', 'place', 'district', 'state'],
    inv1: ['inv1', 'investigator 1', 'investigator1', 'inv 1', 'field investigator', 'investigator', 'inv_1', 'fi1', 'fi name'],
    inv2: ['inv2', 'investigator 2', 'investigator2', 'inv 2', 'inv_2', 'fi2', 'secondary investigator'],
    fee1: ['fee1', 'payment fee 1', 'payment (fee)', 'inv1 fee', 'fee 1', 'inv1_fee'],
    fee2: ['fee2', 'payment fee 2', 'inv2 fee', 'fee 2', 'inv2_fee'],
    ta1: ['ta1', 'other expense', 'other expense 1', 'other expense 1 (inv1 ta)', 'ta 1', 'ta/expense 1', 'inv1 ta', 'ta_1'],
    ta2: ['ta2', 'other expense 2', 'other expense 2 (inv2 ta)', 'ta 2', 'ta/expense 2', 'inv2 ta', 'ta_2'],
    received: ['received', 'payment received', 'amount received', 'received amount', 'amount paid', 'recv amt', 'recv amount', 'company payment'],
    invoice_no: ['invoice_no', 'invoice no', 'invoice no.', 'inv no', 'inv no.', 'invoice #', 'bill no', 'bill no.', 'invoice number'],
    invoice_amount: ['invoice_amount', 'invoice amount', 'invoice amt', 'inv amt', 'inv amount', 'billed', 'bill amount', 'billed amount', 'invoice value', 'bill amt'],
    outcome: ['outcome', 'investigation outcome', 'investigation_outcome', 'case outcome', 'status outcome', 'finding', 'findings', 'decision', 'result', 'status_outcome'],
    fraud_reason: ['fraud_reason', 'fraud reason', 'fraud type', 'fraud trigger', 'fraud remarks', 'findings remarks', 'fraud details', 'discrepancy'],
    inv1_status: ['inv1_status', 'inv1 status', 'inv1 pay status', 'inv1 payment status'],
    inv2_status: ['inv2_status', 'inv2 status', 'inv2 pay status', 'inv2 payment status'],
    remarks: ['remarks', 'remark', 'comment', 'comments', 'notes', 'narration', 'case remarks']
  };

  /**
   * Smart Parser for both Tab-Separated Bulk Paste & CSV
   */
  window.parseUniversalRows = function(text) {
    if (!text || !text.trim()) return [];

    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (!lines.length) return [];

    function splitLine(line) {
      if (line.includes('\t')) {
        return line.split('\t').map(x => x.replace(/^"|"$/g, '').trim());
      }
      const out = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      out.push(cur.trim());
      return out;
    }

    const rawRows = lines.map(splitLine);
    const firstLineNorm = lines[0].toLowerCase();
    const hasHeader = firstLineNorm.includes('claim') || firstLineNorm.includes('company') || 
                      firstLineNorm.includes('insured') || firstLineNorm.includes('policy') || 
                      firstLineNorm.includes('outcome') || firstLineNorm.includes('invoice');

    const header = hasHeader ? rawRows[0].map(h => h.toLowerCase().trim()) : null;
    const startIdx = hasHeader ? 1 : 0;

    const idx = {};
    if (hasHeader) {
      Object.keys(EXTENDED_COL_MAP).forEach(f => {
        idx[f] = -1;
        for (const name of EXTENDED_COL_MAP[f]) {
          const i = header.indexOf(name);
          if (i >= 0) { idx[f] = i; break; }
        }
      });
    }

    // Build DB Lookup maps for instant matching
    const existingCases = window.cases || [];
    const dbByClaimKey = new Map(); // cleanKey(claim_no) -> case
    const dbByCompanyClaimKey = new Map(); // cleanKey(company) + '|' + cleanKey(claim_no) -> case
    const dbByDocCode = new Map(); // cleanKey(doc_code) -> case

    existingCases.forEach(c => {
      if (c.claim_no) {
        dbByClaimKey.set(cleanKey(c.claim_no), c);
        if (c.company) {
          dbByCompanyClaimKey.set(cleanKey(c.company) + '|' + cleanKey(c.claim_no), c);
        }
      }
      if (c.doc_code) {
        dbByDocCode.set(cleanKey(c.doc_code), c);
      }
    });

    const parsedRows = [];
    const seenClaimKeys = new Set();

    for (let i = startIdx; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!r || r.length < 1 || r.every(cell => !cell)) continue;

      let company = '', date = '', case_type = '', claim_no = '', policy_no = '';
      let insured_name = '', hospital = '', location = '', inv1 = '', inv2 = '';
      let fee1 = 0, fee2 = 0, ta1 = 0, ta2 = 0, received = 0, invoice_amount = 0;
      let invoice_no = '', outcome = '', fraud_reason = '', inv1_status = '', inv2_status = '';
      let remarks = '';

      if (hasHeader) {
        const get = (f) => idx[f] >= 0 ? (r[idx[f]] || '').toString().trim() : '';
        company = get('company');
        date = get('date');
        case_type = get('case_type');
        claim_no = get('claim_no');
        policy_no = get('policy_no');
        insured_name = get('insured_name');
        hospital = get('hospital');
        location = get('location');
        inv1 = get('inv1');
        inv2 = get('inv2');
        fee1 = parseAmount(get('fee1'));
        fee2 = parseAmount(get('fee2'));
        ta1 = parseAmount(get('ta1'));
        ta2 = parseAmount(get('ta2'));
        received = parseAmount(get('received'));
        invoice_no = get('invoice_no');
        invoice_amount = parseAmount(get('invoice_amount'));
        outcome = get('outcome');
        fraud_reason = get('fraud_reason');
        inv1_status = get('inv1_status');
        inv2_status = get('inv2_status');
        remarks = get('remarks');
      } else {
        // Positional fallback for standard un-headered template
        company = r[0] || '';
        date = r[1] || '';
        case_type = r[2] || '';
        claim_no = r[3] || '';
        policy_no = r[4] || '';
        insured_name = r[5] || '';
        hospital = r[6] || '';
        inv1 = r[7] || '';
        location = r[8] || '';
        inv2 = r[9] || '';
        fee1 = parseAmount(r[10]);
        fee2 = parseAmount(r[11]);
        ta1 = parseAmount(r[12]);
        ta2 = parseAmount(r[13]);
        received = parseAmount(r[15]);
        invoice_no = r[16] || '';
        inv1_status = r[18] || '';
        inv2_status = r[19] || '';
        remarks = r[20] || '';
        outcome = r[21] || '';
        invoice_amount = parseAmount(r[22]);
      }

      if (!claim_no && !invoice_no && !insured_name) {
        continue;
      }

      // Check if matching case exists in DB
      const claimK = cleanKey(claim_no);
      const compK = cleanKey(company);
      let matchedExisting = null;

      if (compK && claimK && dbByCompanyClaimKey.has(compK + '|' + claimK)) {
        matchedExisting = dbByCompanyClaimKey.get(compK + '|' + claimK);
      } else if (claimK && dbByClaimKey.has(claimK)) {
        matchedExisting = dbByClaimKey.get(claimK);
      } else if (claim_no && dbByDocCode.has(cleanKey(claim_no))) {
        matchedExisting = dbByDocCode.get(cleanKey(claim_no));
      }

      // Standardize Date
      let useDate = date || (matchedExisting ? matchedExisting.date : new Date().toISOString().slice(0, 10));
      const dm = useDate.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (dm) useDate = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;

      // Standardize Outcome
      const cleanOutcome = standardizeOutcome(outcome || (matchedExisting ? matchedExisting.outcome : 'Pending'));

      // If fraud reason provided in remarks or dedicated column
      let combinedRemarks = remarks;
      if (fraud_reason && !combinedRemarks.includes(fraud_reason)) {
        combinedRemarks = combinedRemarks ? `${combinedRemarks} | ${fraud_reason}` : fraud_reason;
      }

      const isMerge = Boolean(matchedExisting);
      const isBatchDup = !isMerge && seenClaimKeys.has(claimK);
      if (claimK) seenClaimKeys.add(claimK);

      // Validation errors ONLY if creating brand new case without essentials
      let error = null;
      if (!isMerge) {
        if (!claim_no) error = 'Missing Claim No';
        else if (!company) error = 'Missing Company name';
        else if (!insured_name) error = 'Missing Insured / Patient name';
      }

      parsedRows.push({
        error,
        raw: r.join('\t'),
        isMerge,
        existingCase: matchedExisting,
        matchedDocCode: matchedExisting ? matchedExisting.doc_code : null,
        isBatchDup,
        claim_no: claim_no || (matchedExisting ? matchedExisting.claim_no : ''),
        company: (company ? company.toUpperCase() : (matchedExisting ? matchedExisting.company : '')),
        date: useDate,
        case_type: (case_type ? case_type.toUpperCase() : (matchedExisting ? matchedExisting.case_type : '')),
        policy_no: policy_no || (matchedExisting ? matchedExisting.policy_no : ''),
        insured_name: insured_name || (matchedExisting ? matchedExisting.insured_name : ''),
        hospital: hospital || (matchedExisting ? matchedExisting.hospital : ''),
        location: location || (matchedExisting ? matchedExisting.location : ''),
        inv1: inv1 || (matchedExisting ? matchedExisting.inv1 : ''),
        inv2: inv2 || (matchedExisting ? matchedExisting.inv2 : ''),
        fee1: fee1 || (matchedExisting ? (matchedExisting.fee1 || 0) : 0),
        fee2: fee2 || (matchedExisting ? (matchedExisting.fee2 || 0) : 0),
        ta1: ta1 || (matchedExisting ? (matchedExisting.ta1 || 0) : 0),
        ta2: ta2 || (matchedExisting ? (matchedExisting.ta2 || 0) : 0),
        total_payable: (fee1 + fee2 + ta1 + ta2) || (matchedExisting ? (matchedExisting.total_payable || 0) : 0),
        received: received || (matchedExisting ? (matchedExisting.received || 0) : 0),
        invoice_no: invoice_no || (matchedExisting ? matchedExisting.invoice_no : ''),
        invoice_amount: invoice_amount || (matchedExisting ? matchedExisting.invoice_amount : null),
        outcome: cleanOutcome,
        fraud_reason: fraud_reason || '',
        inv1_status: inv1_status || (matchedExisting ? matchedExisting.inv1_status : ''),
        inv2_status: inv2_status || (matchedExisting ? matchedExisting.inv2_status : ''),
        remarks: combinedRemarks || (matchedExisting ? matchedExisting.remarks : '')
      });
    }

    return parsedRows;
  };

  /**
   * Render Comprehensive Smart Preview Modal with Old -> New Diff Viewer
   */
  window.showSmartImportPreview = function(rows, sourceLabel) {
    window.pendingSmartRows = rows;

    const newRows = rows.filter(r => !r.error && !r.isMerge && !r.isBatchDup);
    const mergeRows = rows.filter(r => !r.error && r.isMerge);
    const errorRows = rows.filter(r => r.error);
    const batchDupRows = rows.filter(r => r.isBatchDup);

    // Calculate outcomes count
    const outcomeCounts = { Genuine: 0, Fraud: 0, Repudiated: 0, Suspicious: 0, Pending: 0, Other: 0 };
    rows.forEach(r => {
      const oc = r.outcome || 'Pending';
      if (outcomeCounts[oc] !== undefined) outcomeCounts[oc]++;
      else outcomeCounts.Other++;
    });

    // Check unknown investigators for mapping
    const allKnownInv = typeof getAllInvestigators === 'function' ? getAllInvestigators() : [];
    const knownLower = new Set(allKnownInv.map(x => x.toLowerCase()));
    const unmatchedNames = new Map();

    newRows.forEach(r => {
      [r.inv1, r.inv2].forEach(n => {
        if (!n || n === 'NA') return;
        if (knownLower.has(n.toLowerCase())) return;
        if (unmatchedNames.has(n)) return;
        unmatchedNames.set(n, typeof findClosestInvestigator === 'function' ? findClosestInvestigator(n) : null);
      });
    });

    // Function to calculate exact field diffs for a merge row
    function getRowDiffs(r, overwrite) {
      if (!r.isMerge || !r.existingCase) return [];
      const ex = r.existingCase;
      const diffs = [];

      function checkField(label, oldVal, newVal, isAmount = false) {
        const oldStr = isAmount ? (Number(oldVal || 0) > 0 ? '₹' + Number(oldVal).toLocaleString('en-IN') : '₹0') : (oldVal || '—');
        const newStr = isAmount ? (Number(newVal || 0) > 0 ? '₹' + Number(newVal).toLocaleString('en-IN') : '₹0') : (newVal || '—');

        const hasOld = isAmount ? Number(oldVal || 0) > 0 : Boolean(oldVal && oldVal !== '—');
        const hasNew = isAmount ? Number(newVal || 0) > 0 : Boolean(newVal && newVal !== '—');

        if (!hasNew) return; // No new data passed in this column

        if (!hasOld) {
          // Filling previously blank column
          diffs.push({ label, oldStr: '<span style="color:#94a3b8;font-style:italic;">[Blank]</span>', newStr: `<b style="color:#0284c7;">${newStr}</b>`, type: 'fill' });
        } else if (oldStr !== newStr) {
          // Conflict / change
          if (overwrite) {
            diffs.push({ label, oldStr: `<span style="text-decoration:line-through;color:#94a3b8;">${oldStr}</span>`, newStr: `<b style="color:#ea580c;">${newStr}</b>`, type: 'overwrite' });
          } else {
            diffs.push({ label, oldStr: `<b>${oldStr}</b>`, newStr: `<span style="color:#64748b;font-size:10px;">(${newStr} ignored, keeping existing)</span>`, type: 'kept' });
          }
        }
      }

      checkField('Outcome', ex.outcome || 'Pending', r.outcome);
      checkField('Invoice No', ex.invoice_no, r.invoice_no);
      checkField('Invoice Amount', ex.invoice_amount, r.invoice_amount, true);
      checkField('Amount Received', ex.received, r.received, true);
      checkField('Fraud Remarks', ex.remarks, r.remarks);
      checkField('Policy No', ex.policy_no, r.policy_no);
      checkField('Hospital', ex.hospital, r.hospital);
      checkField('Location', ex.location, r.location);

      return diffs;
    }

    let html = `
      <!-- Summary Kicker & KPI banner -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:14px;">
        <div style="background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:8px 12px;text-align:center;">
          <div style="font-size:9.5px;text-transform:uppercase;color:var(--sub);font-weight:700;">Total Rows</div>
          <div style="font-size:18px;font-weight:800;color:var(--navy);margin-top:2px;">${rows.length}</div>
        </div>
        <div style="background:rgba(16,185,129,0.1);border:1px solid #10b981;border-radius:6px;padding:8px 12px;text-align:center;">
          <div style="font-size:9.5px;text-transform:uppercase;color:#065f46;font-weight:700;">➕ New Cases</div>
          <div style="font-size:18px;font-weight:800;color:#047857;margin-top:2px;">${newRows.length}</div>
        </div>
        <div style="background:rgba(59,130,246,0.1);border:1px solid #3b82f6;border-radius:6px;padding:8px 12px;text-align:center;">
          <div style="font-size:9.5px;text-transform:uppercase;color:#1e40af;font-weight:700;">🔄 Smart Merge/Update</div>
          <div style="font-size:18px;font-weight:800;color:#1d4ed8;margin-top:2px;">${mergeRows.length}</div>
        </div>
        <div style="background:rgba(239,68,68,0.1);border:1px solid #ef4444;border-radius:6px;padding:8px 12px;text-align:center;">
          <div style="font-size:9.5px;text-transform:uppercase;color:#991b1b;font-weight:700;">⚡ Fraud Flagged</div>
          <div style="font-size:18px;font-weight:800;color:#b91c1c;margin-top:2px;">${outcomeCounts.Fraud}</div>
        </div>
        <div style="background:rgba(245,158,11,0.1);border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;text-align:center;">
          <div style="font-size:9.5px;text-transform:uppercase;color:#92400e;font-weight:700;">Warnings / Skip</div>
          <div style="font-size:18px;font-weight:800;color:#b45309;margin-top:2px;">${errorRows.length + batchDupRows.length}</div>
        </div>
      </div>

      <!-- Merge Mode Options & Legend -->
      <div class="notice" style="background:#f0f7ff;border-left:3px solid #0052cc;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div style="font-size:11.5px;color:#0747a6;">
          <b>🔄 Smart Merge Active:</b> Inspecting differences below. Blank fields are auto-filled. Original customer details remain safely protected.
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--navy);cursor:pointer;">
          <input type="checkbox" id="smart-overwrite-toggle" onchange="window.reRenderSmartDiffPreview()">
          <span>Overwrite non-empty existing values</span>
        </label>
      </div>

      <!-- Filter Tabs -->
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;">
        <button type="button" class="btn btn-sm btn-navy" id="tab-all-rows" onclick="window.filterSmartPreviewTab('all')">All Rows (${rows.length})</button>
        <button type="button" class="btn btn-sm btn-ghost" id="tab-merge-rows" onclick="window.filterSmartPreviewTab('merge')">🔄 Merged / Updated Only (${mergeRows.length})</button>
        <button type="button" class="btn btn-sm btn-ghost" id="tab-new-rows" onclick="window.filterSmartPreviewTab('new')">➕ New Cases Only (${newRows.length})</button>
      </div>
    `;

    // Investigator mapping UI if any unmatched found
    if (unmatchedNames.size) {
      html += `<datalist id="smart-known-inv-list">${allKnownInv.map(inv => `<option value="${inv.replace(/"/g, '&quot;')}">`).join('')}</datalist>`;
      html += `<div class="notice" style="background:var(--amber-bg);border-left-color:var(--amber);margin-bottom:10px;">
        <b>★ Investigator Review:</b> ${unmatchedNames.size} investigator name(s) need matching. Type in the box to search or keep as typed.
      </div>`;
      html += `<div style="max-height:160px;overflow-y:auto;border:1px solid var(--line);border-radius:4px;margin-bottom:14px;">
        <table style="width:100%;"><thead><tr><th>Name in Excel</th><th>Map to Known Investigator</th></tr></thead><tbody>`;
      let i = 0;
      unmatchedNames.forEach((sugg, name) => {
        const safeName = name.replace(/'/g, "\\'");
        const suggestedMatch = (sugg && !sugg.ambiguous) ? sugg.match : '';
        html += `<tr>
          <td class="mono" style="font-weight:700;">${name}</td>
          <td>
            <input type="text" id="smart-inv-resolve-${i}" data-original="${safeName}" list="smart-known-inv-list"
              value="${suggestedMatch.replace(/"/g, '&quot;')}"
              placeholder="Type to search..."
              style="font-size:11px;padding:4px 8px;width:100%;max-width:300px;box-sizing:border-box;border:1px solid var(--line);border-radius:4px;">
          </td>
        </tr>`;
        i++;
      });
      html += `</tbody></table></div>`;
    }

    // Detailed Table Preview with Old -> New Diff Badges
    html += `
      <div id="smart-preview-table-container" style="max-height:360px;overflow-y:auto;border:1px solid var(--line);border-radius:4px;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;" id="smart-preview-table">
          <thead>
            <tr style="position:sticky;top:0;background:var(--paper);border-bottom:2px solid var(--line);z-index:2;">
              <th style="padding:8px 10px;">Action / Doc Code</th>
              <th style="padding:8px 10px;">Claim No</th>
              <th style="padding:8px 10px;">Insured & Company</th>
              <th style="padding:8px 10px;">Outcome & Findings</th>
              <th style="padding:8px 10px;">Billing & Invoice</th>
              <th style="padding:8px 10px;min-width:240px;">🔍 What Is Changing (Old ➔ New Diff)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.slice(0, 300).map((r, rowIdx) => {
              if (r.error) {
                return `<tr class="smart-row-error" style="background:var(--red-bg);"><td colspan="6" style="padding:8px 10px;">⚠️ <b>${r.error}</b> — <span class="mono">${(r.raw || '').slice(0, 80)}</span></td></tr>`;
              }

              const rowType = r.isMerge ? 'merge' : (r.isBatchDup ? 'dup' : 'new');

              let actionBadge = '<span class="badge paid" style="font-weight:700;">➕ NEW CASE</span>';
              if (r.isMerge) {
                actionBadge = `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;font-family:var(--mono);">🔄 MERGE (${r.matchedDocCode})</span>`;
              } else if (r.isBatchDup) {
                actionBadge = '<span class="badge overdue">SKIP DUP</span>';
              }

              let outcomeBadge = `<span class="badge pending">${r.outcome || 'Pending'}</span>`;
              if (r.outcome === 'Genuine') outcomeBadge = '<span class="badge" style="background:#dcfce7;color:#15803d;font-weight:700;">✓ Genuine</span>';
              else if (r.outcome === 'Fraud') outcomeBadge = `<span class="badge" style="background:#fee2e2;color:#b91c1c;font-weight:700;" title="${r.remarks || ''}">⚡ FRAUD</span>`;
              else if (r.outcome === 'Repudiated') outcomeBadge = '<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">✕ Repudiated</span>';

              // Generate Diff Card for this row
              const diffs = getRowDiffs(r, false);
              let diffHtml = '';
              if (r.isMerge) {
                if (diffs.length > 0) {
                  diffHtml = `
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px 8px;font-size:10.5px;line-height:1.4;">
                      ${diffs.map(d => `
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                          <span style="color:#64748b;font-weight:600;min-width:85px;">${d.label}:</span>
                          <span>${d.oldStr}</span>
                          <span style="color:#0284c7;font-weight:800;">➔</span>
                          <span>${d.newStr}</span>
                        </div>
                      `).join('')}
                    </div>
                  `;
                } else {
                  diffHtml = `<span style="color:#64748b;font-style:italic;font-size:10.5px;">✓ No field changes detected (Data matches existing)</span>`;
                }
              } else {
                diffHtml = `<span style="color:#059669;font-size:10.5px;font-weight:600;">➕ Complete new record will be created</span>`;
              }

              return `
                <tr class="smart-row-${rowType}" style="border-bottom:1px solid var(--line);background:${r.isMerge ? '#fafcff' : 'transparent'};">
                  <td style="padding:8px 10px;vertical-align:top;">${actionBadge}</td>
                  <td class="mono" style="padding:8px 10px;vertical-align:top;font-weight:700;">${r.claim_no}</td>
                  <td style="padding:8px 10px;vertical-align:top;">
                    <div style="font-weight:700;color:var(--navy);">${r.insured_name}</div>
                    <div style="font-size:10px;color:var(--sub);">${r.company} · ${r.hospital || 'No hospital'}</div>
                  </td>
                  <td style="padding:8px 10px;vertical-align:top;">
                    <div>${outcomeBadge}</div>
                    ${r.remarks ? `<div style="font-size:10px;color:var(--sub);margin-top:2px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${r.remarks}">${r.remarks}</div>` : ''}
                  </td>
                  <td style="padding:8px 10px;vertical-align:top;font-size:10.5px;">
                    <div><b>Inv:</b> <span class="mono">${r.invoice_no || '—'}</span></div>
                    <div><b>Billed:</b> ${r.invoice_amount ? '₹' + Number(r.invoice_amount).toLocaleString('en-IN') : '—'}</div>
                    <div><b>Recv:</b> ${r.received ? '₹' + Number(r.received).toLocaleString('en-IN') : '—'}</div>
                  </td>
                  <td style="padding:8px 10px;vertical-align:top;" id="smart-diff-cell-${rowIdx}">
                    ${diffHtml}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (rows.length > 300) {
      html += `<div style="text-align:center;color:var(--sub);font-size:11px;padding:8px;">+ ${rows.length - 300} more rows will be processed in background.</div>`;
    }

    const previewBody = document.getElementById('preview-body');
    if (previewBody) previewBody.innerHTML = html;

    const confirmBtn = document.getElementById('preview-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = commitSmartImportPreview;
      confirmBtn.disabled = false;
      confirmBtn.textContent = `Confirm & Process ${rows.length} Rows`;
    }

    const previewModal = document.getElementById('preview-modal');
    if (previewModal) previewModal.classList.add('open');
  };

  // Live filter tabs between All, Merge-only, and New-only
  window.filterSmartPreviewTab = function(tab) {
    const table = document.getElementById('smart-preview-table');
    if (!table) return;

    ['all', 'merge', 'new'].forEach(t => {
      const btn = document.getElementById(`tab-${t}-rows`);
      if (btn) {
        if (t === tab) {
          btn.className = 'btn btn-sm btn-navy';
        } else {
          btn.className = 'btn btn-sm btn-ghost';
        }
      }
    });

    const mergeRows = table.querySelectorAll('.smart-row-merge');
    const newRows = table.querySelectorAll('.smart-row-new');
    const dupRows = table.querySelectorAll('.smart-row-dup');

    if (tab === 'all') {
      mergeRows.forEach(r => r.style.display = '');
      newRows.forEach(r => r.style.display = '');
      dupRows.forEach(r => r.style.display = '');
    } else if (tab === 'merge') {
      mergeRows.forEach(r => r.style.display = '');
      newRows.forEach(r => r.style.display = 'none');
      dupRows.forEach(r => r.style.display = 'none');
    } else if (tab === 'new') {
      mergeRows.forEach(r => r.style.display = 'none');
      newRows.forEach(r => r.style.display = '');
      dupRows.forEach(r => r.style.display = 'none');
    }
  };

  // Re-render Diffs when Overwrite Toggle is clicked
  window.reRenderSmartDiffPreview = function() {
    const rows = window.pendingSmartRows || [];
    const overwrite = document.getElementById('smart-overwrite-toggle')?.checked || false;

    rows.slice(0, 300).forEach((r, idx) => {
      const cell = document.getElementById(`smart-diff-cell-${idx}`);
      if (!cell || !r.isMerge || !r.existingCase) return;

      const ex = r.existingCase;
      const diffs = [];

      function checkField(label, oldVal, newVal, isAmount = false) {
        const oldStr = isAmount ? (Number(oldVal || 0) > 0 ? '₹' + Number(oldVal).toLocaleString('en-IN') : '₹0') : (oldVal || '—');
        const newStr = isAmount ? (Number(newVal || 0) > 0 ? '₹' + Number(newVal).toLocaleString('en-IN') : '₹0') : (newVal || '—');

        const hasOld = isAmount ? Number(oldVal || 0) > 0 : Boolean(oldVal && oldVal !== '—');
        const hasNew = isAmount ? Number(newVal || 0) > 0 : Boolean(newVal && newVal !== '—');

        if (!hasNew) return;

        if (!hasOld) {
          diffs.push({ label, oldStr: '<span style="color:#94a3b8;font-style:italic;">[Blank]</span>', newStr: `<b style="color:#0284c7;">${newStr}</b>` });
        } else if (oldStr !== newStr) {
          if (overwrite) {
            diffs.push({ label, oldStr: `<span style="text-decoration:line-through;color:#94a3b8;">${oldStr}</span>`, newStr: `<b style="color:#ea580c;">${newStr}</b>` });
          } else {
            diffs.push({ label, oldStr: `<b>${oldStr}</b>`, newStr: `<span style="color:#64748b;font-size:10px;">(${newStr} ignored, keeping existing)</span>` });
          }
        }
      }

      checkField('Outcome', ex.outcome || 'Pending', r.outcome);
      checkField('Invoice No', ex.invoice_no, r.invoice_no);
      checkField('Invoice Amount', ex.invoice_amount, r.invoice_amount, true);
      checkField('Amount Received', ex.received, r.received, true);
      checkField('Fraud Remarks', ex.remarks, r.remarks);
      checkField('Policy No', ex.policy_no, r.policy_no);
      checkField('Hospital', ex.hospital, r.hospital);
      checkField('Location', ex.location, r.location);

      if (diffs.length > 0) {
        cell.innerHTML = `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px 8px;font-size:10.5px;line-height:1.4;">
            ${diffs.map(d => `
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                <span style="color:#64748b;font-weight:600;min-width:85px;">${d.label}:</span>
                <span>${d.oldStr}</span>
                <span style="color:#0284c7;font-weight:800;">➔</span>
                <span>${d.newStr}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        cell.innerHTML = `<span style="color:#64748b;font-style:italic;font-size:10.5px;">✓ No field changes detected (Data matches existing)</span>`;
      }
    });
  };

  /**
   * Commit Import with 1-Click Rollback Snapshot & Atomic Upsert
   */
  async function commitSmartImportPreview() {
    const rows = window.pendingSmartRows || [];
    const btn = document.getElementById('preview-confirm-btn');
    if (!rows.length) return;

    const overwrite = document.getElementById('smart-overwrite-toggle')?.checked || false;

    // Resolve investigator mappings
    const allKnown = typeof getAllInvestigators === 'function' ? getAllInvestigators() : [];
    const knownInvLower = new Map(allKnown.map(x => [x.toLowerCase(), x]));
    const nameResolution = {};
    document.querySelectorAll('[id^="smart-inv-resolve-"]').forEach(input => {
      const original = input.dataset.original;
      const typed = input.value.trim();
      const exactMatch = typed ? knownInvLower.get(typed.toLowerCase()) : null;
      nameResolution[original] = exactMatch || original;
    });

    const resolveName = (n) => {
      if (!n || n === 'NA') return n || '';
      return nameResolution[n] !== undefined ? nameResolution[n] : n;
    };

    const newRows = rows.filter(r => !r.error && !r.isMerge && !r.isBatchDup);
    const mergeRows = rows.filter(r => !r.error && r.isMerge);

    if (!newRows.length && !mergeRows.length) {
      if (typeof showToast === 'function') showToast('No valid rows to process.', true);
      closeModal('preview-modal');
      closeModal('bulk-modal');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Applying updates & saving snapshot…';

    const previousStates = [];
    const updatedDocCodes = [];
    const insertedDocCodes = [];

    try {
      // 1. PROCESS SMART MERGES (UPDATE EXISTING)
      if (mergeRows.length > 0) {
        for (const mr of mergeRows) {
          const ex = mr.existingCase;
          if (!ex || !ex.doc_code) continue;

          previousStates.push(JSON.parse(JSON.stringify(ex)));
          updatedDocCodes.push(ex.doc_code);

          const payload = {};

          // Field merge logic: overwrite OR only fill if existing was empty/zero
          const setField = (key, newVal, isNumber = false) => {
            if (isNumber) {
              if (overwrite && newVal !== undefined) payload[key] = newVal;
              else if ((!ex[key] || ex[key] === 0) && newVal > 0) payload[key] = newVal;
            } else {
              if (overwrite && newVal) payload[key] = newVal;
              else if (!ex[key] && newVal) payload[key] = newVal;
            }
          };

          setField('outcome', mr.outcome);
          setField('invoice_no', mr.invoice_no);
          setField('invoice_amount', mr.invoice_amount, true);
          setField('received', mr.received, true);
          setField('policy_no', mr.policy_no);
          setField('hospital', mr.hospital);
          setField('location', mr.location);
          setField('inv1_status', mr.inv1_status);
          setField('inv2_status', mr.inv2_status);

          if (mr.remarks) {
            if (overwrite) payload.remarks = mr.remarks;
            else if (!ex.remarks) payload.remarks = mr.remarks;
            else if (!ex.remarks.includes(mr.remarks)) payload.remarks = `${ex.remarks} | ${mr.remarks}`;
          }

          // Recalculate totals if financial values updated
          const f1 = ex.fee1 || 0, f2 = ex.fee2 || 0, t1 = ex.ta1 || 0, t2 = ex.ta2 || 0;
          const payable = f1 + f2 + t1 + t2;
          const recv = payload.received !== undefined ? payload.received : (ex.received || 0);
          payload.total_payable = payable;
          payload.profit = recv - payable;

          const { error: updateErr } = await supabaseClient.from('cases').update(payload).eq('doc_code', ex.doc_code);
          if (updateErr) throw updateErr;
        }
      }

      // 2. PROCESS NEW CASES (INSERT)
      if (newRows.length > 0) {
        const toInsert = [];
        const localMonthCounters = {};

        for (const r of newRows) {
          const inv1 = resolveName(r.inv1);
          const inv2 = resolveName(r.inv2);

          const d = new Date(r.date || new Date().toISOString().slice(0, 10));
          const mo = window.MONTHS ? window.MONTHS.find(m => m.m === (d.getMonth() + 1) && m.y === d.getFullYear()) : null;
          const monthCode = mo ? mo.code : String(d.getMonth() + 1) + d.getFullYear();

          let doc_code;
          if (localMonthCounters[monthCode]) {
            localMonthCounters[monthCode]++;
            doc_code = `${monthCode}-${String(localMonthCounters[monthCode]).padStart(4, '0')}`;
          } else {
            doc_code = typeof genDocCodeDB === 'function' ? await genDocCodeDB(r.date) : `${monthCode}-0001`;
            const match = doc_code.match(/-(\d+)$/);
            localMonthCounters[monthCode] = match ? parseInt(match[1], 10) : 1;
          }

          toInsert.push({
            doc_code,
            company: r.company,
            date: r.date,
            case_type: r.case_type,
            claim_no: r.claim_no,
            policy_no: r.policy_no,
            insured_name: r.insured_name,
            hospital: r.hospital,
            location: r.location,
            inv1,
            inv2,
            fee1: r.fee1,
            fee2: r.fee2,
            ta1: r.ta1,
            ta2: r.ta2,
            total_payable: r.total_payable,
            received: r.received,
            invoice_no: r.invoice_no,
            invoice_amount: r.invoice_amount || null,
            outcome: r.outcome || 'Pending',
            inv1_status: r.inv1_status,
            inv2_status: r.inv2_status,
            remarks: r.remarks
          });

          insertedDocCodes.push(doc_code);
        }

        const { error: insErr } = await supabaseClient.from('cases').insert(toInsert);
        if (insErr) throw insErr;
      }

      // 3. RECORD BATCH SNAPSHOT FOR INSTANT ROLLBACK SAFETY
      if (typeof recordBatchSnapshot === 'function') {
        if (mergeRows.length > 0) {
          recordBatchSnapshot({
            action: `Bulk Smart Merge: enriched ${mergeRows.length} existing cases`,
            type: 'update',
            docCodes: updatedDocCodes,
            previousState: previousStates
          });
        }
        if (newRows.length > 0) {
          recordBatchSnapshot({
            action: `Bulk Paste: added ${newRows.length} new cases`,
            type: 'insert',
            docCodes: insertedDocCodes
          });
        }
      }

      // Refresh DB cache & UI
      if (typeof loadCasesFromDB === 'function') await loadCasesFromDB();
      if (typeof renderAll === 'function') renderAll();
      if (typeof closeModal === 'function') {
        closeModal('preview-modal');
        closeModal('bulk-modal');
      }

      const msg = `Done! ➕ ${newRows.length} cases added, 🔄 ${mergeRows.length} existing cases enriched. (Undo available in Rollback Log).`;
      if (typeof showToast === 'function') showToast(msg);

    } catch (err) {
      console.error('[Smart Merge Error]', err);
      btn.disabled = false;
      btn.textContent = 'Confirm & Process';
      if (typeof showToast === 'function') showToast('Process failed: ' + (err.message || err), true);
    }
  }

  // Hook into Bulk Paste & CSV Handlers safely
  ready(() => {
    window.processBulkPaste = function() {
      const raw = document.getElementById('bulk-input')?.value.trim();
      if (!raw) {
        if (typeof showToast === 'function') showToast('Please paste Excel data first.', true);
        return;
      }
      const rows = window.parseUniversalRows(raw);
      window.showSmartImportPreview(rows, 'Universal Bulk Paste');
    };

    window.parseBulkPasteRows = window.parseUniversalRows;
    window.showImportPreview = window.showSmartImportPreview;
  });

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }
})();
