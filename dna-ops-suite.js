// =============================================================================
// dna-ops-suite.js — 
// 1. SLA / TAT Breach Alarm & Live Countdown Badges
// 2. Smart Courier Manifest / Dispatch Docket for Hard Copy & Documents
// 3. Form 26AS / AIS TDS Reconciliation & Matchmaker Engine
// =============================================================================
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. SLA / TAT BREACH ALARM & LIVE STATUS ENGINE
  // ---------------------------------------------------------------------------
  function parseCaseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date && !isNaN(dateStr.getTime())) return dateStr;
    const str = String(dateStr).trim();
    const isoDate = new Date(str);
    if (!isNaN(isoDate.getTime()) && str.includes('-') && str.split('-')[0].length === 4) {
      return isoDate;
    }
    const parts = str.split(/[-/]/);
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return isNaN(d.getTime()) ? null : d;
      } else if (parts[2].length === 4) {
        const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        return isNaN(d.getTime()) ? null : d;
      }
    }
    return isNaN(isoDate.getTime()) ? null : isoDate;
  }

  window.computeCaseSlaStatus = function(c) {
    if (!c) return { status: 'NO_SLA', label: '—', color: 'var(--sub)', bg: 'var(--paper)', text: '—' };

    // If case is already completed or marked withdrawn/rejected, SLA is settled
    if (c.completed_at || c.exception_type === 'Withdrawn' || c.exception_type === 'Rejected' || (c.investigation_status || '').toLowerCase() === 'completed') {
      return { status: 'COMPLETED', label: 'Completed', color: 'var(--green)', bg: '#f0fdf4', diffHours: null, text: 'Done' };
    }

    // Determine due date
    let due = null;
    if (c.due_date) {
      due = parseCaseDate(c.due_date);
    } else if (c.date) {
      const slaHrs = parseInt(c.sla_hours) || 48; // default 48h SLA if not configured
      const base = parseCaseDate(c.date);
      if (base && !isNaN(base.getTime())) {
        due = new Date(base.getTime() + (slaHrs * 3600000));
      }
    }

    if (!due || isNaN(due.getTime())) {
      return { status: 'NO_SLA', label: 'No SLA', color: 'var(--sub)', bg: 'var(--paper)', diffHours: null, text: '—' };
    }

    const now = new Date();
    const diffHours = (due - now) / (1000 * 60 * 60);

    if (diffHours < 0) {
      const overdueHrs = Math.abs(Math.round(diffHours));
      return {
        status: 'BREACHED',
        label: `🚨 SLA Breached (${overdueHrs}h overdue)`,
        badgeText: `BREACHED · ${overdueHrs}h`,
        color: '#b91c1c',
        bg: '#fee2e2',
        border: '#ef4444',
        diffHours,
        isAlarm: true
      };
    } else if (diffHours <= 12) {
      const leftHrs = Math.round(diffHours);
      return {
        status: 'CRITICAL',
        label: `⚠️ Critical SLA (${leftHrs}h remaining)`,
        badgeText: `CRITICAL · ${leftHrs}h`,
        color: '#c2410c',
        bg: '#ffedd5',
        border: '#f97316',
        diffHours,
        isAlarm: true
      };
    } else if (diffHours <= 24) {
      const leftHrs = Math.round(diffHours);
      return {
        status: 'APPROACHING',
        label: `⏳ Approaching SLA (${leftHrs}h)`,
        badgeText: `DUE IN ${leftHrs}h`,
        color: '#b45309',
        bg: '#fef3c7',
        border: '#f59e0b',
        diffHours,
        isAlarm: false
      };
    } else {
      const leftDays = (diffHours / 24).toFixed(1);
      return {
        status: 'ON_TRACK',
        label: `🟢 On Track (${leftDays}d)`,
        badgeText: `ON TRACK (${leftDays}d)`,
        color: '#15803d',
        bg: '#dcfce7',
        border: '#86efac',
        diffHours,
        isAlarm: false
      };
    }
  };

  // Enhance original slaBadge to show live countdown badge with high contrast
  window.slaBadge = function(c) {
    const s = window.computeCaseSlaStatus(c);
    if (s.status === 'COMPLETED') {
      return '<span class="badge success" style="font-weight:700;">Done</span>';
    }
    if (s.status === 'NO_SLA') {
      return '<span class="badge na">—</span>';
    }
    return `<span class="badge" style="background:${s.bg}; color:${s.color}; border:1px solid ${s.border||'transparent'}; font-weight:800; font-size:10px; letter-spacing:0.3px;" title="${s.label}">${s.badgeText}</span>`;
  };

  // Quick filter by SLA on Cases Table
  window.filterCasesBySla = function(slaType) {
    const slaSelect = document.getElementById('filter-sla-status');
    if (slaSelect) {
      slaSelect.value = slaType;
      if (typeof filterCases === 'function') filterCases();
    }
  };

  // ---------------------------------------------------------------------------
  // 2. COURIER MANIFEST PRINTER (INTEGRATED IN BULK DOCS & DISPATCH MANAGER)
  // ---------------------------------------------------------------------------
  // Smart Print Manifest directly from Bulk Document & Dispatch Manager Modal
  window.printManifestFromBulkModal = function() {
    const tbody = document.querySelector('#bulkdoc-dispatch-table tbody');
    if (!tbody) {
      if (typeof showToast === 'function') showToast('Dispatch table not loaded.', true);
      return;
    }

    const checkedBoxes = tbody.querySelectorAll('input[type="checkbox"]:checked');
    if (!checkedBoxes.length) {
      if (typeof showToast === 'function') showToast('Please tick at least one case in the Dispatch table to print manifest.', true);
      return;
    }

    const chosenDocCodes = [];
    checkedBoxes.forEach(cb => {
      const tr = cb.closest('tr');
      const docCode = tr?.getAttribute('data-doccode');
      if (docCode) chosenDocCodes.push(docCode);
    });

    const allCases = window.cases || [];
    const chosenCases = allCases.filter(c => chosenDocCodes.includes(c.doc_code));
    if (!chosenCases.length) {
      if (typeof showToast === 'function') showToast('No cases found for printing.', true);
      return;
    }

    let company = document.getElementById('bulkdoc-dispatch-co')?.value || '';
    if (company === 'ALL' || !company) {
      company = chosenCases[0]?.company || 'Insurance Company';
    }
    const awbNo = document.getElementById('bulkdoc-dispatch-awb')?.value.trim() || 'PENDING-AWB';
    const dispatchDate = document.getElementById('bulkdoc-dispatch-date')?.value || new Date().toISOString().slice(0, 10);
    const courierPartner = 'Courier / Speed Post';

    generatePrintableManifest(chosenCases, company, courierPartner, awbNo, dispatchDate);
  };

  // Core Manifest PDF/Print HTML Generator
  function generatePrintableManifest(chosenCases, company, courierPartner, awbNo, dispatchDate) {
    const agencyName = (typeof settings !== 'undefined' && settings?.agencyName) 
      ? settings.agencyName 
      : ((typeof window !== 'undefined' && window.settings?.agencyName) ? window.settings.agencyName : 'DNA PROFESSIONAL INVESTIGATION AGENCY');
    const agencyAddress = (typeof settings !== 'undefined' && settings?.agencyAddress) 
      ? settings.agencyAddress 
      : ((typeof window !== 'undefined' && window.settings?.agencyAddress) ? window.settings.agencyAddress : 'Corporate Investigation & Claim Verification Office');
    const agencyLogo = (typeof settings !== 'undefined' && settings?.logo) 
      ? settings.logo 
      : ((typeof window !== 'undefined' && window.settings?.logo) ? window.settings.logo : '');

    const safeCompName = (company || 'Dispatch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Courier_Manifest_${safeCompName}_${dispatchDate}.pdf`;

    const manifestBodyHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1e293b; font-size: 12px; background: #fff;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="display:flex; gap:16px; align-items:center;">
            ${agencyLogo ? `<img src="${agencyLogo}" alt="Agency Logo" style="max-height: 52px; max-width: 140px; object-fit: contain;">` : ''}
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 4px;">${agencyName}</div>
              <div style="font-size: 11px; color: #64748b;">${agencyAddress}</div>
              <div style="margin-top: 4px; font-size: 11px; font-weight: 700; color: #b8862e;">HARD COPY DOCUMENT DISPATCH MANIFEST &amp; COURIER TRANSMITTAL SLIP</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Manifest Date</div>
            <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${dispatchDate}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
          <div>
            <label style="display: block; font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px;">Recipient Insurer</label>
            <span style="font-size: 13px; font-weight: 700; color: #0f172a;">${company}</span>
          </div>
          <div>
            <label style="display: block; font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px;">Courier Service</label>
            <span style="font-size: 13px; font-weight: 700; color: #0f172a;">${courierPartner}</span>
          </div>
          <div>
            <label style="display: block; font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px;">Docket / AWB Tracking No</label>
            <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: #2563eb;">${awbNo}</span>
          </div>
          <div>
            <label style="display: block; font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px;">Total Files Dispatched</label>
            <span style="font-size: 13px; font-weight: 700; color: #16a34a;">${chosenCases.length} Enclosures</span>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr>
              <th style="width: 32px; background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;">#</th>
              <th style="background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;">Doc Code</th>
              <th style="background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;">Claim No</th>
              <th style="background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;">Insured Name</th>
              <th style="background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;">Hospital / Facility</th>
              <th style="background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;">Hardcopy Content</th>
              <th style="background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;">Receiver Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${chosenCases.map((c, i) => `
              <tr style="background: ${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${i + 1}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace; font-weight: 700;">${c.doc_code || '—'}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace; font-weight: 700; color: #1e3a8a;">${c.claim_no || '—'}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 600;">${c.insured_name || '—'}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${c.hospital_name || c.hospital || '—'}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">Complete Report + Bills + Verification Sheets</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="font-size: 10.5px; color: #64748b; margin-bottom: 24px; line-height: 1.5;">
          * Note: All hardcopy documents mentioned above have been verified, signed, and dispatched in sealed tamper-evident envelope. Please acknowledge receipt upon physical delivery.
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; border-top: 1px dashed #cbd5e1;">
          <div>
            <div style="margin-bottom: 36px;"></div>
            <div style="text-align: center; width: 200px; border-top: 1px solid #0f172a; padding-top: 6px; font-weight: 700; font-size: 11px;">Prepared By (Dispatch Staff)</div>
          </div>
          <div>
            <div style="margin-bottom: 36px;"></div>
            <div style="text-align: center; width: 200px; border-top: 1px solid #0f172a; padding-top: 6px; font-weight: 700; font-size: 11px;">Courier Pick-up / Signature</div>
          </div>
          <div>
            <div style="margin-bottom: 36px;"></div>
            <div style="text-align: center; width: 200px; border-top: 1px solid #0f172a; padding-top: 6px; font-weight: 700; font-size: 11px;">Company Inward Receiving Stamp</div>
          </div>
        </div>
      </div>
    `;

    // Seamless UX: Use in-app openPDFPreview modal if available
    if (typeof openPDFPreview === 'function') {
      openPDFPreview(manifestBodyHtml, filename, { orientation: 'landscape' });
      if (typeof showToast === 'function') {
        showToast(`Courier Manifest prepared for ${chosenCases.length} files.`);
      }
      return;
    }

    // Fallback if openPDFPreview not found: try printHTML or window.open
    if (typeof printHTML === 'function') {
      printHTML(manifestBodyHtml);
      return;
    }

    // Secondary fallback: window.open
    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to print the courier manifest docket.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Dispatch Manifest - ${company}</title></head><body>${manifestBodyHtml}<script>window.onload = function(){ window.print(); }<\/script></body></html>`);
    printWindow.document.close();
  }

  // ---------------------------------------------------------------------------
  // 3. FORM 26AS / AIS TDS RECONCILIATION & MATCHMAKER ENGINE
  // ---------------------------------------------------------------------------
  const TDS_RECON_STORAGE_KEY = 'dna_tds_26as_records_v1';

  function getSaved26ASRecords() {
    try {
      const raw = localStorage.getItem(TDS_RECON_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('Could not read 26AS records', e);
      return {};
    }
  }

  function save26ASRecord(compKey, fy, amount, ackNo = '') {
    try {
      const recs = getSaved26ASRecords();
      const key = `${compKey.trim().toUpperCase()}_${fy.trim().toUpperCase()}`;
      recs[key] = {
        compKey: compKey.trim().toUpperCase(),
        fy: fy.trim().toUpperCase(),
        tds26AS: Number(amount) || 0,
        ackNo: ackNo.trim(),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(TDS_RECON_STORAGE_KEY, JSON.stringify(recs));
      return true;
    } catch (e) {
      console.error('Failed to save 26AS record', e);
      return false;
    }
  }

  window.open26ASModal = function(company = '', fy = '') {
    const compInput = document.getElementById('recon-26as-company');
    const fyInput = document.getElementById('recon-26as-fy');
    const amtInput = document.getElementById('recon-26as-amount');
    const ackInput = document.getElementById('recon-26as-ack');

    if (compInput) compInput.value = company || '';
    if (fyInput) fyInput.value = fy || '';

    // If record already exists, preload
    if (company && fy) {
      const recs = getSaved26ASRecords();
      const key = `${company.trim().toUpperCase()}_${fy.trim().toUpperCase()}`;
      if (recs[key]) {
        if (amtInput) amtInput.value = recs[key].tds26AS || '';
        if (ackInput) ackInput.value = recs[key].ackNo || '';
      } else {
        if (amtInput) amtInput.value = '';
        if (ackInput) ackInput.value = '';
      }
    }

    document.getElementById('recon-26as-modal').classList.add('open');
  };

  window.save26ASEntry = function() {
    const comp = document.getElementById('recon-26as-company')?.value.trim();
    const fy = document.getElementById('recon-26as-fy')?.value.trim();
    const amt = parseFloat(document.getElementById('recon-26as-amount')?.value);
    const ack = document.getElementById('recon-26as-ack')?.value.trim() || '';

    if (!comp || !fy || isNaN(amt)) {
      if (typeof showToast === 'function') showToast('Please enter valid Company, FY, and 26AS TDS Amount.', true);
      return;
    }

    save26ASRecord(comp, fy, amt, ack);
    if (typeof closeModal === 'function') closeModal('recon-26as-modal');
    if (typeof showToast === 'function') showToast(`26AS TDS record saved for ${comp} (${fy}).`);
    
    // Re-render TDS Ledger with comparison badges
    if (typeof window.renderFinanceLedger === 'function') {
      window.renderFinanceLedger();
    }
  };

  // Enhance renderFinanceLedger to display 26AS comparison
  const originalRenderFinanceLedger = window.renderFinanceLedger;
  window.renderFinanceLedger = function() {
    if (typeof originalRenderFinanceLedger === 'function') {
      originalRenderFinanceLedger();
    }

    // Now inject 26AS Verification column if not already present
    const theadTr = document.querySelector('#view-finance table thead tr');
    if (theadTr && !theadTr.querySelector('.th-26as')) {
      const th = document.createElement('th');
      th.className = 'th-26as';
      th.style.textAlign = 'right';
      th.innerHTML = 'Form 26AS Credit · Status';
      theadTr.appendChild(th);
    }

    const tbody = document.getElementById('finance-tds-tbody');
    if (!tbody) return;

    const saved26AS = getSaved26ASRecords();
    const rows = tbody.querySelectorAll('tr');

    rows.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 6 || tds[0].textContent.includes('No financial records')) return;

      const compName = tds[0].textContent.trim();
      const fy = tds[1].textContent.trim();
      const systemTds = Number(tds[4].textContent.replace(/[^0-9.-]/g, '')) || 0;

      const key = `${compName.toUpperCase()}_${fy.toUpperCase()}`;
      const rec = saved26AS[key];

      let matchHtml = '';
      if (!rec) {
        matchHtml = `
          <button class="btn btn-ghost btn-sm" style="padding:2px 8px; font-size:10.5px; border:1px dashed var(--line);" onclick="open26ASModal('${compName.replace(/'/g, "\\'")}', '${fy}')">
            + Verify 26AS
          </button>
        `;
      } else {
        const portalTds = rec.tds26AS;
        const diff = portalTds - systemTds;

        let badge = '';
        if (Math.abs(diff) <= 2) {
          badge = `<span class="badge success" style="font-weight:700;">🟢 26AS Matched</span>`;
        } else if (diff < 0) {
          badge = `<span class="badge danger" style="font-weight:700;" title="Portal is showing ₹${Math.abs(Math.round(diff))} less than your system deducted">🔴 Short Deposit (-₹${Math.abs(Math.round(diff))})</span>`;
        } else {
          badge = `<span class="badge warning" style="font-weight:700;" title="Portal shows ₹${Math.round(diff)} excess TDS">🟡 Excess (+₹${Math.round(diff)})</span>`;
        }

        matchHtml = `
          <div style="display:inline-flex; flex-direction:column; align-items:flex-end; gap:2px;">
            <div style="font-family:var(--mono); font-size:11px; font-weight:700;">₹${Number(portalTds).toLocaleString('en-IN')}</div>
            <div style="display:flex; align-items:center; gap:4px;">
              ${badge}
              <button class="btn btn-ghost btn-sm" style="padding:1px 4px; font-size:9px;" onclick="open26ASModal('${compName.replace(/'/g, "\\'")}', '${fy}')" title="Edit 26AS entry">✏️</button>
            </div>
          </div>
        `;
      }

      let actionTd = tr.querySelector('.td-26as-action');
      if (!actionTd) {
        actionTd = document.createElement('td');
        actionTd.className = 'td-26as-action';
        actionTd.style.textAlign = 'right';
        tr.appendChild(actionTd);
      }
      actionTd.innerHTML = matchHtml;
    });
  };

  // ---------------------------------------------------------------------------
  // INITIALIZATION ON DOM READY
  // ---------------------------------------------------------------------------
  function initOpsSuite() {
    // Add SLA dropdown filter into the Cases filter bar if not present
    const filterContainer = document.querySelector('#view-cases .filters');
    if (filterContainer && !document.getElementById('filter-sla-status')) {
      const slaSelect = document.createElement('select');
      slaSelect.id = 'filter-sla-status';
      slaSelect.className = 'fin';
      slaSelect.style.fontWeight = '600';
      slaSelect.style.minWidth = '140px';
      slaSelect.innerHTML = `
        <option value="">SLA: All Cases</option>
        <option value="BREACHED">🚨 Breached / Overdue</option>
        <option value="CRITICAL">⚠️ Critical (&lt;12h)</option>
        <option value="APPROACHING">⏳ Approaching (&lt;24h)</option>
        <option value="ON_TRACK">🟢 On Track</option>
      `;
      slaSelect.onchange = function() {
        if (typeof filterCases === 'function') filterCases();
      };

      const resetBtn = filterContainer.querySelector('button[onclick*="resetFilters"]');
      if (resetBtn) {
        filterContainer.insertBefore(slaSelect, resetBtn);
      } else {
        filterContainer.appendChild(slaSelect);
      }
    }

    // Integrate SLA Filter into app.js filtering engine
    if (typeof window.filterCases === 'function') {
      const originalFilterCases = window.filterCases;
      window.filterCases = function() {
        originalFilterCases();
        const slaFilterVal = document.getElementById('filter-sla-status')?.value;
        if (slaFilterVal && typeof filteredCases !== 'undefined') {
          filteredCases = filteredCases.filter(c => {
            const s = window.computeCaseSlaStatus(c);
            return s.status === slaFilterVal;
          });
          if (typeof applySortToFilteredCases === 'function') applySortToFilteredCases();
          if (typeof renderCasesTable === 'function') renderCasesTable();
        }
      };
    }

    // Ensure resetFilters also resets the SLA filter
    if (typeof window.resetFilters === 'function') {
      const origReset = window.resetFilters;
      window.resetFilters = function() {
        const slaSelect = document.getElementById('filter-sla-status');
        if (slaSelect) slaSelect.value = '';
        origReset();
      };
    }

    // Hook into switchDocTab so Print Courier Manifest is smartly shown on Dispatch tab
    if (typeof window.switchDocTab === 'function') {
      const origSwitchDocTab = window.switchDocTab;
      window.switchDocTab = function(tab) {
        origSwitchDocTab(tab);
        const manifestBtn = document.getElementById('bulkdoc-print-manifest-btn');
        if (manifestBtn) {
          manifestBtn.style.display = (tab === 'dispatch') ? 'inline-flex' : 'none';
        }
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOpsSuite);
  } else {
    initOpsSuite();
  }
})();
