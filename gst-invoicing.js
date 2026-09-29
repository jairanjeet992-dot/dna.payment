// ========================================================================
// DNA Professional Investigation Agency - GST Invoicing & Branch Master
// 100% Supabase Stored - Compliant with Indian GST & Corporate Insurance Billing
// ========================================================================

(function () {
  'use strict';

  // Global State
  window.companyBranches = [];
  window.allBulkInvoices = [];

  // Standard Indian States & State Codes List for GST
  const INDIAN_STATES = [
    { code: '23', name: 'Madhya Pradesh' },
    { code: '27', name: 'Maharashtra' },
    { code: '07', name: 'Delhi' },
    { code: '24', name: 'Gujarat' },
    { code: '09', name: 'Uttar Pradesh' },
    { code: '08', name: 'Rajasthan' },
    { code: '29', name: 'Karnataka' },
    { code: '33', name: 'Tamil Nadu' },
    { code: '36', name: 'Telangana' },
    { code: '28', name: 'Andhra Pradesh' },
    { code: '19', name: 'West Bengal' },
    { code: '10', name: 'Bihar' },
    { code: '06', name: 'Haryana' },
    { code: '03', name: 'Punjab' },
    { code: '22', name: 'Chhattisgarh' },
    { code: '20', name: 'Jharkhand' },
    { code: '21', name: 'Odisha' },
    { code: '05', name: 'Uttarakhand' },
    { code: '02', name: 'Himachal Pradesh' },
    { code: '01', name: 'Jammu and Kashmir' },
    { code: '30', name: 'Goa' },
    { code: '18', name: 'Assam' }
  ];
  window.INDIAN_STATES = INDIAN_STATES;

  // Dynamically extract Agency State Code from agency_settings.gstin (first 2 digits)
  function getAgencyStateCode() {
    const gstin = (window.settings?.gstin || '').trim();
    if (gstin.length >= 2 && /^\d{2}$/.test(gstin.slice(0, 2))) {
      return gstin.slice(0, 2);
    }
    return '23'; // Default fallback to Madhya Pradesh (23)
  }
  window.getAgencyStateCode = getAgencyStateCode;

  // Standard Official Registered Entity Names for Insurance Companies & TPAs
  const DEFAULT_LEGAL_NAMES = {
    'STAR HEALTH': 'Star Health and Allied Insurance Company Limited',
    'CARE': 'Care Health Insurance Limited',
    'SBI': 'SBI General Insurance Company Limited',
    'MAGMA': 'Magma HDI General Insurance Company Limited',
    'CHOLA': 'Cholamandalam MS General Insurance Company Limited',
    'TATA AIG': 'Tata AIG General Insurance Company Limited',
    'TATA AIA': 'Tata AIA Life Insurance Company Limited',
    'ADITYA BIRLA': 'Aditya Birla Health Insurance Co. Limited',
    'IFFCO TOKIO': 'IFFCO Tokio General Insurance Company Limited',
    'KOTAK': 'Kotak Mahindra General Insurance Company Limited',
    'RELIANCE': 'Reliance General Insurance Company Limited',
    'VIDAL HEALTH': 'Vidal Health Insurance TPA Private Limited',
    'BRAINBIRD': 'Brainbird Technology Private Limited',
    'BAJAJ ALLIANZ': 'Bajaj Allianz General Insurance Co. Ltd.',
    'HDFC ERGO': 'HDFC ERGO General Insurance Company Limited',
    'ICICI LOMBARD': 'ICICI Lombard General Insurance Co. Ltd.',
    'NEW INDIA': 'The New India Assurance Company Limited',
    'NATIONAL INSURANCE': 'National Insurance Company Limited',
    'ORIENTAL': 'The Oriental Insurance Company Limited',
    'UNITED INDIA': 'United India Insurance Company Limited',
    'FUTURE GENERALI': 'Future Generali India Insurance Co. Ltd.',
    'MANIPAL CIGNA': 'ManipalCigna Health Insurance Company Limited',
    'NIVA BUPA': 'Niva Bupa Health Insurance Company Limited',
    'GO DIGIT': 'Go Digit General Insurance Limited',
    'ACKO': 'Acko General Insurance Limited',
    'ZUNO': 'Zuno General Insurance Limited',
    'UNIVERSAL SOMPO': 'Universal Sompo General Insurance Co. Ltd.',
    'ROYAL SUNDARAM': 'Royal Sundaram General Insurance Co. Limited',
    'LIBERTY': 'Liberty General Insurance Limited',
    'RAHEJA QBE': 'Raheja QBE General Insurance Co. Ltd.'
  };
  window.DEFAULT_LEGAL_NAMES = DEFAULT_LEGAL_NAMES;

  function getCompanyLegalName(companyName, branchObj = null) {
    if (branchObj && branchObj.legal_name && branchObj.legal_name.trim()) {
      return branchObj.legal_name.trim();
    }
    const key = (companyName || '').trim().toUpperCase();
    if (DEFAULT_LEGAL_NAMES[key]) {
      return DEFAULT_LEGAL_NAMES[key];
    }
    if (window.companyBranches && Array.isArray(window.companyBranches)) {
      const bWithLegal = window.companyBranches.find(b => (b.company_name || '').toUpperCase() === key && b.legal_name);
      if (bWithLegal && bWithLegal.legal_name) return bWithLegal.legal_name.trim();
    }
    return companyName || 'INSURANCE COMPANY';
  }
  window.getCompanyLegalName = getCompanyLegalName;

  // Amount in Words (Indian Currency Standard)
  function numToIndianWords(n) {
    if (isNaN(n) || n === null || n === undefined) return '';
    n = Math.round(Number(n));
    if (n === 0) return 'Rupees Zero Only';

    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertGroup(num) {
      let str = '';
      if (num >= 100) {
        str += a[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }
      if (num >= 20) {
        str += b[Math.floor(num / 10)] + ' ';
        num %= 10;
      }
      if (num > 0) {
        str += a[num] + ' ';
      }
      return str;
    }

    let out = '';
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    const remainder = n;

    if (crore > 0) out += convertGroup(crore) + 'Crore ';
    if (lakh > 0) out += convertGroup(lakh) + 'Lakh ';
    if (thousand > 0) out += convertGroup(thousand) + 'Thousand ';
    if (remainder > 0) out += convertGroup(remainder);

    return 'Rupees ' + out.trim() + ' Only';
  }
  window.numToIndianWords = numToIndianWords;

  // Format INR Currency
  function fmtINR(val) {
    const num = Number(val || 0);
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ========================================================================
  // 1. SUPABASE DATA LOADER FOR BRANCHES
  // ========================================================================
  async function loadCompanyBranchesFromDB() {
    try {
      if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
      const { data, error } = await supabaseClient
        .from('insurance_company_branches')
        .select('*')
        .order('company_name', { ascending: true });

      if (error) {
        console.error('[GST] Error loading company branches:', error);
        return;
      }
      window.companyBranches = data || [];
      renderCompanyBranchesSettings();
      console.log(`[GST] Loaded ${window.companyBranches.length} company branches from Supabase.`);
    } catch (e) {
      console.error('[GST] Exception in loadCompanyBranchesFromDB:', e);
    }
  }
  window.loadCompanyBranchesFromDB = loadCompanyBranchesFromDB;

  // Helper to get all registered companies across the app
  function getKnownCompanies() {
    const compSet = new Set();
    if (typeof window.getAllCompanies === 'function') {
      const arr = window.getAllCompanies();
      if (Array.isArray(arr)) arr.forEach(c => c && compSet.add(c.trim().toUpperCase()));
    }
    if (Array.isArray(window.COMPANIES)) {
      window.COMPANIES.forEach(c => c && compSet.add(c.trim().toUpperCase()));
    }
    if (typeof COMPANIES !== 'undefined' && Array.isArray(COMPANIES)) {
      COMPANIES.forEach(c => c && compSet.add(c.trim().toUpperCase()));
    }
    if (window.companyBranches && Array.isArray(window.companyBranches)) {
      window.companyBranches.forEach(b => {
        if (b.company_name) compSet.add(b.company_name.trim().toUpperCase());
      });
    }
    if (window.allCases && Array.isArray(window.allCases)) {
      window.allCases.forEach(c => {
        if (c.company) compSet.add(c.company.trim().toUpperCase());
      });
    } else if (typeof cases !== 'undefined' && Array.isArray(cases)) {
      cases.forEach(c => {
        if (c.company) compSet.add(c.company.trim().toUpperCase());
      });
    }
    return Array.from(compSet).filter(Boolean).sort();
  }
  window.getKnownCompanies = getKnownCompanies;

  function populateBranchFilterDropdown() {
    const filterSel = document.getElementById('settings-branch-filter-company');
    if (!filterSel) return;
    const currentVal = (filterSel.value || '').trim().toUpperCase();
    const comps = getKnownCompanies();
    
    let html = '<option value="">All Companies</option>';
    comps.forEach(c => {
      html += `<option value="${escAttr(c)}" ${c === currentVal ? 'selected' : ''}>${escAttr(c)}</option>`;
    });
    filterSel.innerHTML = html;
    if (currentVal) filterSel.value = currentVal;
  }
  window.populateBranchFilterCompanies = populateBranchFilterDropdown;

  // ========================================================================
  // 2. SETTINGS: COMPANY BRANCHES MASTER UI
  // ========================================================================
  function renderCompanyBranchesSettings() {
    populateBranchFilterDropdown();
    const listEl = document.getElementById('settings-branches-list');
    if (!listEl) return;

    const filterComp = (document.getElementById('settings-branch-filter-company')?.value || '').trim();
    let filtered = window.companyBranches || [];
    if (filterComp) {
      filtered = filtered.filter(b => (b.company_name || '').toUpperCase() === filterComp.toUpperCase());
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="padding:28px 20px; text-align:center; color:var(--sub); font-size:12px;">
          🏢 No branches registered yet ${filterComp ? `for <b>${escAttr(filterComp)}</b>` : ''}.
          <div style="margin-top:8px;">
            <button class="btn btn-navy btn-sm" onclick="openAddBranchModal('${escAttr(filterComp)}')">+ Add First Branch</button>
          </div>
        </div>`;
      return;
    }

    const rows = filtered.map(b => {
      const isMP = b.state_code === '23';
      const taxBadge = isMP
        ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:10px; font-weight:700;">MP (CGST+SGST 18%)</span>`
        : `<span class="badge" style="background:#fef3c7; color:#b45309; font-size:10px; font-weight:700;">${escAttr(b.state || 'Other')} (IGST 18%)</span>`;

      return `
        <tr style="border-bottom:1px solid var(--line); font-size:12px;">
          <td style="padding:8px; font-weight:700; color:var(--navy);">
            <div>${escAttr(b.company_name)} ${b.is_default ? '<span class="badge" style="background:#dcfce7; color:#15803d; font-size:9.5px; margin-left:4px;">Default</span>' : ''}</div>
            <div style="font-size:10.5px; color:var(--sub); font-weight:500;">${escAttr(b.legal_name || getCompanyLegalName(b.company_name, b))}</div>
          </td>
          <td style="padding:8px; font-weight:600;">${escAttr(b.branch_name)}</td>
          <td style="padding:8px;">${taxBadge}</td>
          <td style="padding:8px; font-family:var(--mono); font-size:11px; font-weight:700;">${escAttr(b.gstin || '-')}</td>
          <td style="padding:8px; color:var(--sub); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escAttr(b.billing_address)}">
            ${escAttr(b.billing_address || '-')}
          </td>
          <td style="padding:8px; text-align:right; white-space:nowrap;">
            <button class="btn btn-ghost btn-sm" onclick="openEditBranchModal('${b.id}')" title="Edit Branch">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteCompanyBranch('${b.id}')" title="Delete Branch">🗑️</button>
          </td>
        </tr>`;
    }).join('');

    listEl.innerHTML = `
      <table style="width:100%; border-collapse:collapse; text-align:left;">
        <thead>
          <tr style="background:var(--paper); border-bottom:1px solid var(--line); font-size:10.5px; text-transform:uppercase; color:var(--sub);">
            <th style="padding:8px;">Company & Legal Entity</th>
            <th style="padding:8px;">Branch Name</th>
            <th style="padding:8px;">State & Tax Type</th>
            <th style="padding:8px;">GSTIN</th>
            <th style="padding:8px;">Billing Address</th>
            <th style="padding:8px; text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }
  window.renderCompanyBranchesSettings = renderCompanyBranchesSettings;

  // Add / Edit Branch Modals
  function openAddBranchModal(prefillCompany = '') {
    document.getElementById('branch-modal-title').textContent = 'Add Insurance Company Branch';
    document.getElementById('branch-form-id').value = '';
    
    // Populate Company Dropdown
    const compSel = document.getElementById('branch-form-company');
    const comps = getKnownCompanies();
    const targetComp = (prefillCompany || '').trim().toUpperCase();

    compSel.innerHTML = '<option value="">-- Select Company --</option>' + 
      comps.map(c => `<option value="${escAttr(c)}" ${c === targetComp ? 'selected' : ''}>${escAttr(c)}</option>`).join('');

    if (targetComp) compSel.value = targetComp;

    // Populate Legal Entity Name
    const legalInp = document.getElementById('branch-form-legal-name');
    if (legalInp) {
      legalInp.value = targetComp ? getCompanyLegalName(targetComp) : (comps[0] ? getCompanyLegalName(comps[0]) : '');
      legalInp.setAttribute('data-auto-filled', 'true');
    }

    document.getElementById('branch-form-name').value = '';
    
    // Populate States Dropdown
    const stateSel = document.getElementById('branch-form-state');
    stateSel.innerHTML = INDIAN_STATES.map(s => `<option value="${s.name}" data-code="${s.code}" ${s.code === '23' ? 'selected' : ''}>${s.name} (${s.code})</option>`).join('');
    
    document.getElementById('branch-form-state-code').value = '23';
    document.getElementById('branch-form-gstin').value = '';
    document.getElementById('branch-form-address').value = '';
    document.getElementById('branch-form-default').checked = false;

    document.getElementById('branch-modal').classList.add('open');
  }
  window.openAddBranchModal = openAddBranchModal;

  function onBranchCompanyChange() {
    const compSel = document.getElementById('branch-form-company');
    const legalInp = document.getElementById('branch-form-legal-name');
    if (!compSel || !legalInp) return;
    const selectedComp = (compSel.value || '').trim().toUpperCase();
    if (selectedComp) {
      legalInp.value = getCompanyLegalName(selectedComp);
      legalInp.setAttribute('data-auto-filled', 'true');
    }
  }
  window.onBranchCompanyChange = onBranchCompanyChange;

  function onBranchStateChange() {
    const stateSel = document.getElementById('branch-form-state');
    const selectedOpt = stateSel.options[stateSel.selectedIndex];
    const code = selectedOpt.getAttribute('data-code') || '';
    document.getElementById('branch-form-state-code').value = code;
  }
  window.onBranchStateChange = onBranchStateChange;

  function openEditBranchModal(branchId) {
    const b = (window.companyBranches || []).find(x => x.id === branchId);
    if (!b) return;

    document.getElementById('branch-modal-title').textContent = 'Edit Company Branch';
    document.getElementById('branch-form-id').value = b.id;

    const compSel = document.getElementById('branch-form-company');
    const comps = getKnownCompanies();
    const targetComp = (b.company_name || '').trim().toUpperCase();

    compSel.innerHTML = '<option value="">-- Select Company --</option>' + 
      comps.map(c => `<option value="${escAttr(c)}" ${c === targetComp ? 'selected' : ''}>${escAttr(c)}</option>`).join('');

    if (targetComp) compSel.value = targetComp;

    const legalInp = document.getElementById('branch-form-legal-name');
    if (legalInp) {
      legalInp.value = b.legal_name || getCompanyLegalName(b.company_name, b);
      legalInp.removeAttribute('data-auto-filled');
    }

    document.getElementById('branch-form-name').value = b.branch_name || '';

    const stateSel = document.getElementById('branch-form-state');
    stateSel.innerHTML = INDIAN_STATES.map(s => `<option value="${s.name}" data-code="${s.code}" ${(s.code === b.state_code || s.name === b.state) ? 'selected' : ''}>${s.name} (${s.code})</option>`).join('');

    document.getElementById('branch-form-state-code').value = b.state_code || '23';
    document.getElementById('branch-form-gstin').value = b.gstin || '';
    document.getElementById('branch-form-address').value = b.billing_address || '';
    document.getElementById('branch-form-default').checked = !!b.is_default;

    document.getElementById('branch-modal').classList.add('open');
  }
  window.openEditBranchModal = openEditBranchModal;

  async function promptAddNewCompanyForBranch() {
    const name = prompt('Enter new Insurance Company Name (e.g. ICICI LOMBARD):');
    if (!name || !name.trim()) return;
    const cleanName = name.trim().toUpperCase();

    if (typeof COMPANIES !== 'undefined') {
      if (!COMPANIES.includes(cleanName)) {
        COMPANIES.push(cleanName);
        COMPANIES.sort();
      }
      window.COMPANIES = COMPANIES;
    } else if (Array.isArray(window.COMPANIES)) {
      if (!window.COMPANIES.includes(cleanName)) {
        window.COMPANIES.push(cleanName);
        window.COMPANIES.sort();
      }
    }

    if (typeof _saveListsToDB === 'function') {
      try {
        await _saveListsToDB();
      } catch (e) {
        console.warn('[GST] Could not auto-save new company to agency_settings:', e);
      }
    }

    if (typeof refreshDynamicCompanies === 'function') refreshDynamicCompanies();
    if (typeof renderSettingsLists === 'function') renderSettingsLists();
    populateBranchFilterDropdown();

    const compSel = document.getElementById('branch-form-company');
    if (compSel) {
      const comps = getKnownCompanies();
      compSel.innerHTML = '<option value="">-- Select Company --</option>' + 
        comps.map(c => `<option value="${escAttr(c)}" ${c === cleanName ? 'selected' : ''}>${escAttr(c)}</option>`).join('');
      compSel.value = cleanName;
    }

    const legalInp = document.getElementById('branch-form-legal-name');
    if (legalInp) {
      legalInp.value = getCompanyLegalName(cleanName);
      legalInp.setAttribute('data-auto-filled', 'true');
    }

    if (typeof showToast === 'function') showToast(`Company "${cleanName}" added and selected!`);
  }
  window.promptAddNewCompanyForBranch = promptAddNewCompanyForBranch;

  async function saveBranchToDB() {
    const id = document.getElementById('branch-form-id').value;
    const company_name = document.getElementById('branch-form-company').value.trim().toUpperCase();
    const legal_name = (document.getElementById('branch-form-legal-name')?.value || '').trim() || getCompanyLegalName(company_name);
    const branch_name = document.getElementById('branch-form-name').value.trim();
    const state = document.getElementById('branch-form-state').value;
    const state_code = document.getElementById('branch-form-state-code').value.trim();
    const gstin = document.getElementById('branch-form-gstin').value.trim().toUpperCase();
    const billing_address = document.getElementById('branch-form-address').value.trim();
    const is_default = document.getElementById('branch-form-default').checked;

    if (!company_name || !branch_name || !billing_address) {
      if (typeof showToast === 'function') showToast('Please fill Company, Branch Name, and Billing Address.', true);
      return;
    }

    if (gstin && gstin.length !== 15) {
      if (typeof showToast === 'function') showToast('GSTIN must be exactly 15 characters long.', true);
      return;
    }

    const payload = {
      company_name,
      legal_name,
      branch_name,
      state,
      state_code,
      gstin: gstin || null,
      billing_address,
      is_default,
      updated_at: new Date().toISOString()
    };

    try {
      // If default is checked, reset other branches of this company
      if (is_default) {
        await supabaseClient
          .from('insurance_company_branches')
          .update({ is_default: false })
          .eq('company_name', company_name);
      }

      let error = null;
      if (id) {
        const res = await supabaseClient.from('insurance_company_branches').update(payload).eq('id', id);
        error = res.error;
      } else {
        const res = await supabaseClient.from('insurance_company_branches').insert([payload]);
        error = res.error;
      }

      if (error) throw error;

      // Auto-register company into COMPANIES and agency_settings if not present
      if (typeof COMPANIES !== 'undefined') {
        if (!COMPANIES.includes(company_name)) {
          COMPANIES.push(company_name);
          COMPANIES.sort();
        }
        window.COMPANIES = COMPANIES;
      } else if (Array.isArray(window.COMPANIES)) {
        if (!window.COMPANIES.includes(company_name)) {
          window.COMPANIES.push(company_name);
          window.COMPANIES.sort();
        }
      }
      if (typeof _saveListsToDB === 'function') {
        try { await _saveListsToDB(); } catch(e){}
      }
      if (typeof refreshDynamicCompanies === 'function') refreshDynamicCompanies();
      if (typeof renderSettingsLists === 'function') renderSettingsLists();
      populateBranchFilterDropdown();

      if (typeof showToast === 'function') showToast('Company Branch saved to Supabase successfully!');
      if (typeof closeModal === 'function') closeModal('branch-modal');
      await loadCompanyBranchesFromDB();
    } catch (err) {
      console.error('[GST] Error saving company branch:', err);
      if (typeof showToast === 'function') showToast('Failed to save branch: ' + err.message, true);
    }
  }
  window.saveBranchToDB = saveBranchToDB;

  async function deleteCompanyBranch(branchId) {
    if (!confirm('Are you sure you want to delete this company branch?')) return;
    try {
      const { error } = await supabaseClient.from('insurance_company_branches').delete().eq('id', branchId);
      if (error) throw error;
      if (typeof showToast === 'function') showToast('Branch deleted successfully.');
      await loadCompanyBranchesFromDB();
    } catch (err) {
      console.error('[GST] Error deleting branch:', err);
      if (typeof showToast === 'function') showToast('Failed to delete branch: ' + err.message, true);
    }
  }
  window.deleteCompanyBranch = deleteCompanyBranch;

  // ========================================================================
  // 3. SETTINGS: AGENCY GST & BANK DETAILS SAVE & LOAD
  // ========================================================================
  async function saveAgencyGstBankSettings() {
    const gstin = (document.getElementById('agency-gstin')?.value || '').trim().toUpperCase();
    const pan = (document.getElementById('agency-pan')?.value || '').trim().toUpperCase();
    const bank_name = (document.getElementById('agency-bank-name')?.value || '').trim();
    const bank_account_no = (document.getElementById('agency-bank-acc')?.value || '').trim();
    const bank_ifsc = (document.getElementById('agency-bank-ifsc')?.value || '').trim().toUpperCase();
    const bank_branch = (document.getElementById('agency-bank-branch')?.value || '').trim();
    const invoice_prefix = (document.getElementById('agency-invoice-prefix')?.value || 'DNA/').trim();
    const invoice_terms = (document.getElementById('agency-invoice-terms')?.value || '').trim();

    try {
      const { error } = await supabaseClient
        .from('agency_settings')
        .update({
          gstin,
          pan,
          bank_name,
          bank_account_no,
          bank_ifsc,
          bank_branch,
          invoice_prefix,
          invoice_terms,
          updated_at: new Date().toISOString()
        })
        .eq('id', '1');

      if (error) throw error;
      if (typeof showToast === 'function') showToast('Agency GST & Banking details saved to Supabase!');
      
      // Update local settings object
      if (window.settings) {
        window.settings.gstin = gstin;
        window.settings.pan = pan;
        window.settings.bankName = bank_name;
        window.settings.bankAccountNo = bank_account_no;
        window.settings.bankIfsc = bank_ifsc;
        window.settings.bankBranch = bank_branch;
        window.settings.invoicePrefix = invoice_prefix;
        window.settings.invoiceTerms = invoice_terms;
      }
    } catch (err) {
      console.error('[GST] Error saving agency billing details:', err);
      if (typeof showToast === 'function') showToast('Failed to save billing details: ' + err.message, true);
    }
  }
  window.saveAgencyGstBankSettings = saveAgencyGstBankSettings;

  function populateAgencyBillingFields(data) {
    if (!data) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('agency-gstin', data.gstin);
    setVal('agency-pan', data.pan);
    setVal('agency-bank-name', data.bank_name);
    setVal('agency-bank-acc', data.bank_account_no);
    setVal('agency-bank-ifsc', data.bank_ifsc);
    setVal('agency-bank-branch', data.bank_branch);
    setVal('agency-invoice-prefix', data.invoice_prefix || 'DNA/');
    setVal('agency-invoice-terms', data.invoice_terms || 'Payment due within 30 days of invoice receipt. Subject to Indore Jurisdiction.');
  }
  window.populateAgencyBillingFields = populateAgencyBillingFields;

  // ========================================================================
  // 4. CASE MODAL INVOICING CARD INTEGRATION
  // ========================================================================
  function populateCaseFormBranches(companyName, selectedBranchId = '') {
    const branchSel = document.getElementById('f-invoice-branch');
    if (!branchSel) return;

    if (!companyName) {
      branchSel.innerHTML = '<option value="">-- Select Company First --</option>';
      onInvoiceBranchChange();
      return;
    }

    const branches = (window.companyBranches || []).filter(
      b => (b.company_name || '').toUpperCase() === companyName.toUpperCase()
    );

    if (branches.length === 0) {
      branchSel.innerHTML = '<option value="">-- No Registered Branch (Default MP 23) --</option>';
    } else {
      branchSel.innerHTML = '<option value="">-- Select Billing Branch --</option>' + branches.map(b => {
        const isSel = (selectedBranchId && b.id === selectedBranchId) || (!selectedBranchId && b.is_default);
        const taxNote = b.state_code === '23' ? 'MP (CGST+SGST)' : `${b.state_code} (IGST)`;
        return `<option value="${b.id}" data-state-code="${b.state_code}" ${isSel ? 'selected' : ''}>${escAttr(b.branch_name)} — [${taxNote}]</option>`;
      }).join('');
    }

    onInvoiceBranchChange();
  }
  window.populateCaseFormBranches = populateCaseFormBranches;

  function onInvoiceBranchChange() {
    const branchSel = document.getElementById('f-invoice-branch');
    const badgeEl = document.getElementById('f-invoice-tax-type-badge');
    if (!branchSel) return;

    let stateCode = '23'; // Default MP
    const selectedOpt = branchSel.options[branchSel.selectedIndex];
    if (selectedOpt && selectedOpt.getAttribute('data-state-code')) {
      stateCode = selectedOpt.getAttribute('data-state-code');
    }

    const isIntraState = stateCode === '23';
    if (badgeEl) {
      badgeEl.innerHTML = isIntraState
        ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">🏛️ Intra-State: 9% CGST + 9% SGST</span>`
        : `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700;">✈️ Inter-State: 18% IGST</span>`;
    }

    calcInvoiceTotals();
  }
  window.onInvoiceBranchChange = onInvoiceBranchChange;

  function calcInvoiceTotals() {
    const fee = Math.max(0, parseFloat(document.getElementById('f-invoice-fee')?.value) || 0);
    const expense = Math.max(0, parseFloat(document.getElementById('f-invoice-expense')?.value) || 0);
    const gstRate = parseFloat(document.getElementById('f-invoice-gst-rate')?.value) || 0;

    const taxable = Math.round((fee + expense) * 100) / 100;
    const gstAmount = Math.round((taxable * (gstRate / 100)) * 100) / 100;
    const totalInvoice = Math.round((taxable + gstAmount) * 100) / 100;

    const taxInp = document.getElementById('f-invoice-taxable');
    if (taxInp) taxInp.value = taxable > 0 ? taxable : '';

    const gstInp = document.getElementById('f-invoice-gst-amount');
    if (gstInp) gstInp.value = gstAmount > 0 ? gstAmount : '';

    const totInp = document.getElementById('f-invoice-amount');
    if (totInp) totInp.value = totalInvoice > 0 ? totalInvoice : '';

    // Show breakdown detail below
    const detailEl = document.getElementById('f-invoice-calc-detail');
    if (detailEl) {
      const branchSel = document.getElementById('f-invoice-branch');
      const selectedOpt = branchSel?.options[branchSel.selectedIndex];
      const agencyStateCode = getAgencyStateCode();
      const stateCode = selectedOpt?.getAttribute('data-state-code') || agencyStateCode;
      const isIntraState = stateCode === agencyStateCode;

      if (gstRate > 0 && taxable > 0) {
        if (isIntraState) {
          const half = Math.round((gstAmount / 2) * 100) / 100;
          detailEl.innerHTML = `Breakdown: CGST (${gstRate / 2}%): ₹${half.toFixed(2)} + SGST (${gstRate / 2}%): ₹${half.toFixed(2)} | Total: ₹${totalInvoice.toFixed(2)}`;
        } else {
          detailEl.innerHTML = `Breakdown: IGST (${gstRate}%): ₹${gstAmount.toFixed(2)} | Total: ₹${totalInvoice.toFixed(2)}`;
        }
      } else {
        detailEl.innerHTML = taxable > 0 ? `Taxable Value: ₹${taxable.toFixed(2)} (Non-GST)` : '';
      }
    }

    // Update case total profit
    if (typeof calcTotal === 'function') calcTotal();
  }
  window.calcInvoiceTotals = calcInvoiceTotals;

  // ========================================================================
  // 5. TAX INVOICE HTML TEMPLATE GENERATOR (STANDARD A4 PORTRAIT)
  // ========================================================================
  function generateSingleCaseInvoiceHTML(c) {
    if (!c) return '';

    const ag = window.settings || {};
    const agencyName = ag.agencyName || 'DNA Professional Investigation Agency';
    const agencyAddress = ag.agencyAddress || 'Indore, Madhya Pradesh';
    const agencyGstin = ag.gstin || '23AAAAA0000A1Z5';
    const agencyPan = ag.pan || 'ABCDE1234F';
    const agencyLogo = ag.logo || '';
    const bankName = ag.bankName || 'Punjab National Bank';
    const bankAcc = ag.bankAccountNo || 'XXXXXXXXXXXX';
    const bankIfsc = ag.bankIfsc || 'PUNB0XXXXXX';
    const bankBranch = ag.bankBranch || 'Indore Branch';
    const invoiceTerms = ag.invoiceTerms || 'Payment due within 30 days of invoice receipt. Subject to Indore Jurisdiction.';

    // Client Branch Details
    let branch = (window.companyBranches || []).find(b => b.id === c.branch_id);
    if (!branch) {
      // Find default branch for company
      branch = (window.companyBranches || []).find(b => (b.company_name || '').toUpperCase() === (c.company || '').toUpperCase() && b.is_default);
    }
    if (!branch) {
      branch = {
        branch_name: `${c.company} Regional Office`,
        state: 'Madhya Pradesh',
        state_code: '23',
        gstin: '23AAAAA0000A1Z5',
        billing_address: `${c.company} Claims Department`
      };
    }
    const legalEntityName = getCompanyLegalName(c.company, branch);

    const agencyStateCode = getAgencyStateCode();
    const isIntraState = (branch.state_code || agencyStateCode) === agencyStateCode;
    const fee = Number(c.invoice_fee || 0);
    const expense = Number(c.invoice_expense || 0);
    const taxable = fee + expense;
    const gstRate = Number(c.invoice_gst_rate !== undefined ? c.invoice_gst_rate : 18);
    const gstAmount = Number(c.invoice_gst_amount || (taxable * (gstRate / 100)));
    const grandTotal = Number(c.invoice_amount || (taxable + gstAmount));

    const invoiceNo = c.invoice_no || `INV-${(c.doc_code || 'CASE').replace(/[^a-zA-Z0-9-]/g, '')}`;
    const invoiceDate = c.invoice_date || (c.client_invoice_date || new Date().toISOString().slice(0, 10));

    // Tax rows
    let taxRowsHTML = '';
    if (gstRate > 0) {
      if (isIntraState) {
        const halfRate = gstRate / 2;
        const halfAmt = gstAmount / 2;
        taxRowsHTML = `
          <tr>
            <td colspan="3" style="text-align:right; padding:6px 12px; font-weight:600; border-top:1px solid #e2e8f0;">Central GST (CGST ${halfRate}%):</td>
            <td style="text-align:right; padding:6px 12px; font-weight:600; border-top:1px solid #e2e8f0;">${fmtINR(halfAmt)}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align:right; padding:6px 12px; font-weight:600;">State GST (SGST ${halfRate}%):</td>
            <td style="text-align:right; padding:6px 12px; font-weight:600;">${fmtINR(halfAmt)}</td>
          </tr>`;
      } else {
        taxRowsHTML = `
          <tr>
            <td colspan="3" style="text-align:right; padding:6px 12px; font-weight:600; border-top:1px solid #e2e8f0;">Integrated GST (IGST ${gstRate}%):</td>
            <td style="text-align:right; padding:6px 12px; font-weight:600; border-top:1px solid #e2e8f0;">${fmtINR(gstAmount)}</td>
          </tr>`;
      }
    }

    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; background:#fff; padding:32px 36px; box-sizing:border-box; width:794px; min-height:1080px; margin:0 auto; line-height:1.45; font-size:12.5px;">
        
        <!-- Header Strip -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f2942; padding-bottom:16px; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:16px;">
            ${agencyLogo ? `<img src="${agencyLogo}" alt="Agency Logo" style="max-height:64px; max-width:180px; object-fit:contain;">` : ''}
            <div>
              <h1 style="margin:0; font-size:18px; font-weight:800; color:#0f2942; letter-spacing:0.5px;">${esc(agencyName)}</h1>
              <div style="font-size:11px; color:#475569; white-space:pre-line; margin-top:3px;">${esc(agencyAddress)}</div>
              <div style="font-size:11px; font-weight:700; color:#0f2942; margin-top:4px;">
                GSTIN: <span style="font-family:monospace;">${esc(agencyGstin)}</span> &nbsp;|&nbsp; PAN: <span style="font-family:monospace;">${esc(agencyPan)}</span>
              </div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="display:inline-block; background:#0f2942; color:#fff; padding:4px 12px; font-size:13px; font-weight:800; letter-spacing:1px; border-radius:3px;">TAX INVOICE</div>
            <div style="font-size:10px; color:#64748b; margin-top:4px; text-transform:uppercase;">Original for Recipient</div>
          </div>
        </div>

        <!-- Meta Strip -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; font-size:12px;">
          <tr>
            <td style="padding:8px 12px; width:25%;"><b>Invoice No:</b> <span style="font-family:monospace; font-weight:700; color:#0f2942;">${esc(invoiceNo)}</span></td>
            <td style="padding:8px 12px; width:25%;"><b>Invoice Date:</b> ${esc(invoiceDate)}</td>
            <td style="padding:8px 12px; width:25%;"><b>SAC Code:</b> 9983</td>
            <td style="padding:8px 12px; width:25%;"><b>Place of Supply:</b> ${esc(branch.state)} (${esc(branch.state_code)})</td>
          </tr>
        </table>

        <!-- Two Columns: Bill To & Case Info -->
        <div style="display:flex; gap:16px; margin-bottom:18px;">
          <!-- Bill To -->
          <div style="flex:1; border:1px solid #e2e8f0; border-radius:4px; padding:12px; background:#fafafa;">
            <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:#0f2942; border-bottom:1px solid #cbd5e1; padding-bottom:4px; margin-bottom:6px;">
              BILL TO (CLIENT):
            </div>
            <div style="font-size:13.5px; font-weight:800; color:#0f2942; line-height:1.3;">${esc(legalEntityName)}</div>
            ${legalEntityName.toUpperCase() !== (c.company || '').toUpperCase() ? `<div style="font-size:10.5px; color:#64748b; font-weight:600; margin-top:1px;">(${esc(c.company)})</div>` : ''}
            <div style="font-weight:600; font-size:11.5px; color:#334155; margin-top:3px;">${esc(branch.branch_name)}</div>
            <div style="font-size:11px; color:#475569; margin-top:3px; white-space:pre-line;">${esc(branch.billing_address)}</div>
            <div style="font-size:11px; margin-top:6px;"><b>GSTIN:</b> <span style="font-family:monospace; font-weight:700;">${esc(branch.gstin || 'Unregistered')}</span></div>
            <div style="font-size:11px;"><b>State:</b> ${esc(branch.state)} (Code: ${esc(branch.state_code)})</div>
          </div>

          <!-- Case Details -->
          <div style="flex:1; border:1px solid #e2e8f0; border-radius:4px; padding:12px; background:#fafafa;">
            <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:#0f2942; border-bottom:1px solid #cbd5e1; padding-bottom:4px; margin-bottom:6px;">
              INVESTIGATION PARTICULARS:
            </div>
            <table style="width:100%; font-size:11.5px; border-collapse:collapse;">
              <tr><td style="color:#64748b; padding:2px 0; width:40%;">Claim No:</td><td style="font-weight:700; font-family:monospace;">${esc(c.claim_no || '-')}</td></tr>
              <tr><td style="color:#64748b; padding:2px 0;">Policy No:</td><td>${esc(c.policy_no || '-')}</td></tr>
              <tr><td style="color:#64748b; padding:2px 0;">Insured Name:</td><td style="font-weight:700;">${esc(c.insured_name || '-')}</td></tr>
              <tr><td style="color:#64748b; padding:2px 0;">Hospital/Loc:</td><td>${esc(c.hospital || c.location || '-')}</td></tr>
              <tr><td style="color:#64748b; padding:2px 0;">Case Type:</td><td>${esc(c.case_type || 'Investigation')}</td></tr>
              <tr><td style="color:#64748b; padding:2px 0;">Investigation Date:</td><td>${esc(c.date ? c.date.slice(0, 10) : '-')}</td></tr>
            </table>
          </div>
        </div>

        <!-- Particulars & Line Items Table -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#0f2942; color:#fff; font-size:11px; text-transform:uppercase;">
              <th style="padding:8px 10px; width:45px; text-align:center;">S.No</th>
              <th style="padding:8px 12px; text-align:left;">Description of Services</th>
              <th style="padding:8px 12px; width:90px; text-align:center;">SAC Code</th>
              <th style="padding:8px 12px; width:130px; text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px; text-align:center; vertical-align:top;">1</td>
              <td style="padding:10px 12px;">
                <div style="font-weight:700; color:#0f2942;">Professional Investigation Charges</div>
                <div style="font-size:11px; color:#64748b;">Insurance claim investigation for Claim No: <b>${esc(c.claim_no || '-')}</b>, Insured: <b>${esc(c.insured_name || '-')}</b></div>
              </td>
              <td style="padding:10px 12px; text-align:center; vertical-align:top; font-family:monospace;">9983</td>
              <td style="padding:10px 12px; text-align:right; vertical-align:top; font-weight:700;">${fmtINR(fee)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px; text-align:center; vertical-align:top;">2</td>
              <td style="padding:10px 12px;">
                <div style="font-weight:700; color:#0f2942;">Conveyance & Incidental Out-of-pocket Expenses</div>
                <div style="font-size:11px; color:#64748b;">Travelling, verifications, and logistics expense</div>
              </td>
              <td style="padding:10px 12px; text-align:center; vertical-align:top; font-family:monospace;">9983</td>
              <td style="padding:10px 12px; text-align:right; vertical-align:top; font-weight:700;">${fmtINR(expense)}</td>
            </tr>
            <!-- Subtotal -->
            <tr style="background:#f8fafc; border-bottom:1px solid #cbd5e1;">
              <td colspan="3" style="text-align:right; padding:8px 12px; font-weight:700; color:#0f2942;">Subtotal (Taxable Value):</td>
              <td style="text-align:right; padding:8px 12px; font-weight:800; color:#0f2942;">${fmtINR(taxable)}</td>
            </tr>
            <!-- Taxes -->
            ${taxRowsHTML}
            <!-- Grand Total -->
            <tr style="background:#0f2942; color:#fff;">
              <td colspan="3" style="text-align:right; padding:10px 12px; font-size:13px; font-weight:800; letter-spacing:0.5px;">TOTAL INVOICE AMOUNT:</td>
              <td style="text-align:right; padding:10px 12px; font-size:14px; font-weight:800;">${fmtINR(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Amount in Words -->
        <div style="background:#f1f5f9; padding:8px 12px; border-radius:4px; font-size:11.5px; margin-bottom:18px; border-left:3px solid #0f2942;">
          <b>Amount in Words:</b> <span style="font-weight:700; color:#0f2942;">${numToIndianWords(grandTotal)}</span>
        </div>

        <!-- Bank Details & Signatory Strip -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #e2e8f0; padding-top:14px; margin-top:auto;">
          <!-- Bank Details -->
          <div style="border:1px dashed #cbd5e1; border-radius:4px; padding:10px 14px; font-size:11px; background:#fafafa; width:340px;">
            <div style="font-weight:800; color:#0f2942; margin-bottom:4px; text-transform:uppercase; font-size:11px;">🏦 Bank Payment Details</div>
            <div><b>Bank Name:</b> ${esc(bankName)}</div>
            <div><b>Account No:</b> <span style="font-family:monospace; font-weight:700;">${esc(bankAcc)}</span></div>
            <div><b>IFSC Code:</b> <span style="font-family:monospace; font-weight:700;">${esc(bankIfsc)}</span></div>
            <div><b>Branch:</b> ${esc(bankBranch)}</div>
          </div>

          <!-- Signatory -->
          <div style="text-align:center; width:220px;">
            <div style="font-size:11px; font-weight:700; color:#0f2942; margin-bottom:45px;">For ${esc(agencyName)}</div>
            <div style="border-top:1px solid #64748b; padding-top:4px; font-size:11px; font-weight:700;">Authorized Signatory</div>
            <div style="font-size:9.5px; color:#64748b;">(Computer Generated Tax Invoice)</div>
          </div>
        </div>

        <!-- Terms Footer -->
        <div style="margin-top:16px; font-size:9.5px; color:#64748b; border-top:1px solid #f1f5f9; padding-top:6px;">
          <b>Terms & Conditions:</b> ${esc(invoiceTerms)}
        </div>

      </div>`;
  }
  window.generateSingleCaseInvoiceHTML = generateSingleCaseInvoiceHTML;

  function previewSingleCaseInvoice(docCode) {
    let c = null;
    const isModalOpen = document.getElementById('case-modal')?.classList.contains('open');
    if (isModalOpen) {
      const modalCompany = document.getElementById('f-company')?.value?.trim();
      if (!modalCompany) {
        if (typeof showToast === 'function') showToast('Please select an Insurance Company first.', true);
        return;
      }
      const modalDocCode = (typeof editingDocCode !== 'undefined' && editingDocCode) ? editingDocCode : (docCode || document.getElementById('f-claim')?.value || 'DRAFT');
      const baseCase = (window.cases || []).find(x => x.doc_code === modalDocCode) || {};

      c = {
        ...baseCase,
        doc_code: modalDocCode,
        company: modalCompany,
        claim_no: document.getElementById('f-claim')?.value || baseCase.claim_no || '',
        policy_no: document.getElementById('f-policy')?.value || baseCase.policy_no || '',
        insured_name: document.getElementById('f-insured')?.value || baseCase.insured_name || '',
        hospital: document.getElementById('f-hospital')?.value || baseCase.hospital || '',
        location: document.getElementById('f-location')?.value || baseCase.location || '',
        case_type: document.getElementById('f-casetype')?.value || baseCase.case_type || 'Investigation',
        date: document.getElementById('f-date')?.value || baseCase.date || '',
        branch_id: document.getElementById('f-invoice-branch')?.value || baseCase.branch_id || null,
        invoice_no: document.getElementById('f-invoice')?.value?.trim() || baseCase.invoice_no || `INV-${modalDocCode}`,
        invoice_date: document.getElementById('f-invoice-date')?.value || baseCase.invoice_date || new Date().toISOString().slice(0, 10),
        invoice_fee: document.getElementById('f-invoice-fee')?.value !== '' ? parseFloat(document.getElementById('f-invoice-fee').value) : (baseCase.invoice_fee || baseCase.fee1 || 0),
        invoice_expense: document.getElementById('f-invoice-expense')?.value !== '' ? parseFloat(document.getElementById('f-invoice-expense').value) : (baseCase.invoice_expense || baseCase.ta1 || 0),
        invoice_gst_rate: document.getElementById('f-invoice-gst-rate')?.value !== '' ? parseFloat(document.getElementById('f-invoice-gst-rate').value) : (baseCase.invoice_gst_rate !== undefined ? baseCase.invoice_gst_rate : 18),
        invoice_gst_amount: document.getElementById('f-invoice-gst-amount')?.value !== '' ? parseFloat(document.getElementById('f-invoice-gst-amount').value) : (baseCase.invoice_gst_amount || 0),
        invoice_amount: document.getElementById('f-invoice-amount')?.value !== '' ? parseFloat(document.getElementById('f-invoice-amount').value) : (baseCase.invoice_amount || 0)
      };
    } else if (docCode) {
      c = (window.cases || []).find(x => x.doc_code === docCode);
    }

    if (!c) {
      if (typeof showToast === 'function') showToast('Please select or save a case first.', true);
      return;
    }

    const html = generateSingleCaseInvoiceHTML(c);
    const invoiceNo = c.invoice_no || `INV-${c.doc_code || 'CASE'}`;
    const filename = `Tax_Invoice_${(c.company || 'Company').replace(/[^a-zA-Z0-9]/g, '_')}_${invoiceNo.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

    if (typeof openPDFPreview === 'function') {
      openPDFPreview(html, filename, { orientation: 'portrait' });
    } else if (typeof window.openPDFPreview === 'function') {
      window.openPDFPreview(html, filename, { orientation: 'portrait' });
    } else {
      console.warn('openPDFPreview not available. Opening fallback print window.');
      if (typeof printHTML === 'function') printHTML(html);
      else if (typeof window.printHTML === 'function') window.printHTML(html);
    }
  }
  window.previewSingleCaseInvoice = previewSingleCaseInvoice;

  // ========================================================================
  // 6. BULK CONSOLIDATED TAX INVOICE ENGINE (FOR INSURANCE COMPANIES)
  // ========================================================================
  function openBulkInvoiceModal() {
    const selectedCodes = Array.from(window.crSelectedDocCodes || []);
    if (selectedCodes.length === 0) {
      if (typeof showToast === 'function') showToast('Please select at least 1 case to generate a bulk invoice.', true);
      return;
    }

    const allCases = window.cases || [];
    const selectedCases = allCases.filter(c => selectedCodes.includes(c.doc_code));

    // Verify all cases belong to same company
    const companies = Array.from(new Set(selectedCases.map(c => (c.company || '').toUpperCase()))).filter(Boolean);
    if (companies.length > 1) {
      if (typeof showToast === 'function') {
        showToast(`Selected cases belong to multiple companies (${companies.join(', ')}). Please filter by a single company first.`, true);
      }
      return;
    }

    const compName = companies[0] || 'INSURANCE COMPANY';
    document.getElementById('cr-bulk-inv-company-name').textContent = compName;
    document.getElementById('cr-bulk-inv-count-badge').textContent = `${selectedCases.length} Cases Selected`;

    // Populate Branches for this company
    const branchSel = document.getElementById('cr-bulk-inv-branch-select');
    const branches = (window.companyBranches || []).filter(b => (b.company_name || '').toUpperCase() === compName.toUpperCase());
    
    if (branches.length === 0) {
      branchSel.innerHTML = '<option value="">-- No Branch Registered (Default MP 23) --</option>';
    } else {
      branchSel.innerHTML = branches.map(b => {
        const taxNote = b.state_code === '23' ? 'MP (CGST+SGST)' : `${b.state_code} (IGST)`;
        return `<option value="${b.id}" data-state-code="${b.state_code}" ${b.is_default ? 'selected' : ''}>${escAttr(b.branch_name)} — [${taxNote}]</option>`;
      }).join('');
    }

    // Auto Invoice No
    const prefix = window.settings?.invoicePrefix || 'DNA/';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    document.getElementById('cr-bulk-inv-number').value = `${prefix}BULK/${dateStr}/${selectedCases.length}`;
    document.getElementById('cr-bulk-inv-date').value = new Date().toISOString().slice(0, 10);

    // Sum Fees & Expenses
    let totalFee = 0;
    let totalTA = 0;
    selectedCases.forEach(c => {
      totalFee += Number(c.invoice_fee || c.fee1 || 0);
      totalTA += Number(c.invoice_expense || c.ta1 || 0);
    });

    document.getElementById('cr-bulk-inv-fee').value = totalFee;
    document.getElementById('cr-bulk-inv-ta').value = totalTA;

    calcBulkInvoiceTotals();
    document.getElementById('cr-bulk-invoice-modal').classList.add('open');
  }
  window.openBulkInvoiceModal = openBulkInvoiceModal;

  function calcBulkInvoiceTotals() {
    const fee = Math.max(0, parseFloat(document.getElementById('cr-bulk-inv-fee')?.value) || 0);
    const ta = Math.max(0, parseFloat(document.getElementById('cr-bulk-inv-ta')?.value) || 0);
    const gstRate = parseFloat(document.getElementById('cr-bulk-inv-gst-rate')?.value) || 18;

    const branchSel = document.getElementById('cr-bulk-inv-branch-select');
    const selectedOpt = branchSel?.options[branchSel.selectedIndex];
    const stateCode = selectedOpt?.getAttribute('data-state-code') || '23';
    const isIntraState = stateCode === '23';

    const taxable = Math.round((fee + ta) * 100) / 100;
    const gstAmount = Math.round((taxable * (gstRate / 100)) * 100) / 100;
    const grandTotal = Math.round((taxable + gstAmount) * 100) / 100;

    document.getElementById('cr-bulk-inv-taxable').textContent = fmtINR(taxable);
    document.getElementById('cr-bulk-inv-gst-amount').textContent = fmtINR(gstAmount);
    document.getElementById('cr-bulk-inv-grand-total').textContent = fmtINR(grandTotal);

    const taxTypeBadge = document.getElementById('cr-bulk-inv-tax-type-badge');
    if (taxTypeBadge) {
      taxTypeBadge.innerHTML = isIntraState
        ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">Intra-State: CGST (9%) + SGST (9%)</span>`
        : `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700;">Inter-State: IGST (18%)</span>`;
    }
  }
  window.calcBulkInvoiceTotals = calcBulkInvoiceTotals;

  // Generate 2-Part Bulk Tax Invoice HTML (Master Tax Invoice + Case Annexure Table)
  function generateBulkInvoiceHTML(bulkRecord, selectedCases, branchObj) {
    const ag = window.settings || {};
    const agencyName = ag.agencyName || 'DNA Professional Investigation Agency';
    const agencyAddress = ag.agencyAddress || 'Indore, Madhya Pradesh';
    const agencyGstin = ag.gstin || '23AAAAA0000A1Z5';
    const agencyPan = ag.pan || 'ABCDE1234F';
    const agencyLogo = ag.logo || '';
    const bankName = ag.bankName || 'Punjab National Bank';
    const bankAcc = ag.bankAccountNo || 'XXXXXXXXXXXX';
    const bankIfsc = ag.bankIfsc || 'PUNB0XXXXXX';
    const bankBranch = ag.bankBranch || 'Indore Branch';
    const invoiceTerms = ag.invoiceTerms || 'Payment due within 30 days of invoice receipt. Subject to Indore Jurisdiction.';

    const isIntraState = (branchObj.state_code || '23') === '23';
    const legalEntityName = getCompanyLegalName(bulkRecord.company_name, branchObj);
    const gstRate = Number(bulkRecord.gst_rate || 18);
    const taxable = Number(bulkRecord.taxable_amount || 0);
    const gstAmount = Number(bulkRecord.gst_amount || 0);
    const grandTotal = Number(bulkRecord.grand_total || 0);

    let taxRowsHTML = '';
    if (gstRate > 0) {
      if (isIntraState) {
        const half = gstAmount / 2;
        taxRowsHTML = `
          <tr>
            <td colspan="3" style="text-align:right; padding:6px 12px; font-weight:600; border-top:1px solid #e2e8f0;">Central GST (CGST ${gstRate / 2}%):</td>
            <td style="text-align:right; padding:6px 12px; font-weight:600; border-top:1px solid #e2e8f0;">${fmtINR(half)}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align:right; padding:6px 12px; font-weight:600;">State GST (SGST ${gstRate / 2}%):</td>
            <td style="text-align:right; padding:6px 12px; font-weight:600;">${fmtINR(half)}</td>
          </tr>`;
      } else {
        taxRowsHTML = `
          <tr>
            <td colspan="3" style="text-align:right; padding:6px 12px; font-weight:600; border-top:1px solid #e2e8f0;">Integrated GST (IGST ${gstRate}%):</td>
            <td style="text-align:right; padding:6px 12px; font-weight:600; border-top:1px solid #e2e8f0;">${fmtINR(gstAmount)}</td>
          </tr>`;
      }
    }

    // Annexure Rows
    const annexureRows = selectedCases.map((c, i) => {
      const caseFee = Number(c.invoice_fee || c.fee1 || 0);
      const caseTA = Number(c.invoice_expense || c.ta1 || 0);
      return `
        <tr style="border-bottom:1px solid #e2e8f0; font-size:11px;">
          <td style="padding:6px; text-align:center;">${i + 1}</td>
          <td style="padding:6px; font-family:monospace; font-weight:700;">${esc(c.doc_code || '-')}</td>
          <td style="padding:6px; font-family:monospace; font-weight:700;">${esc(c.claim_no || '-')}</td>
          <td style="padding:6px;">${esc(c.policy_no || '-')}</td>
          <td style="padding:6px; font-weight:600;">${esc(c.insured_name || '-')}</td>
          <td style="padding:6px; color:#475569;">${esc(c.hospital || c.location || '-')}</td>
          <td style="padding:6px; text-align:center;">${esc(c.date ? c.date.slice(0, 10) : '-')}</td>
          <td style="padding:6px; text-align:right; font-weight:600;">${fmtINR(caseFee)}</td>
          <td style="padding:6px; text-align:right;">${fmtINR(caseTA)}</td>
          <td style="padding:6px; text-align:right; font-weight:700;">${fmtINR(caseFee + caseTA)}</td>
        </tr>`;
    }).join('');

    return `
      <!-- PAGE 1: MASTER TAX INVOICE -->
      <div style="font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; background:#fff; padding:32px 36px; box-sizing:border-box; width:794px; min-height:1080px; margin:0 auto; line-height:1.45; font-size:12.5px; page-break-after:always;">
        
        <!-- Header Strip -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f2942; padding-bottom:16px; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:16px;">
            ${agencyLogo ? `<img src="${agencyLogo}" alt="Agency Logo" style="max-height:64px; max-width:180px; object-fit:contain;">` : ''}
            <div>
              <h1 style="margin:0; font-size:18px; font-weight:800; color:#0f2942; letter-spacing:0.5px;">${esc(agencyName)}</h1>
              <div style="font-size:11px; color:#475569; white-space:pre-line; margin-top:3px;">${esc(agencyAddress)}</div>
              <div style="font-size:11px; font-weight:700; color:#0f2942; margin-top:4px;">
                GSTIN: <span style="font-family:monospace;">${esc(agencyGstin)}</span> &nbsp;|&nbsp; PAN: <span style="font-family:monospace;">${esc(agencyPan)}</span>
              </div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="display:inline-block; background:#0f2942; color:#fff; padding:4px 12px; font-size:13px; font-weight:800; letter-spacing:1px; border-radius:3px;">TAX INVOICE</div>
            <div style="font-size:10px; color:#64748b; margin-top:4px; text-transform:uppercase;">Bulk Consolidated Bill</div>
          </div>
        </div>

        <!-- Meta Strip -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; font-size:12px;">
          <tr>
            <td style="padding:8px 12px; width:28%;"><b>Invoice No:</b> <span style="font-family:monospace; font-weight:700; color:#0f2942;">${esc(bulkRecord.invoice_no)}</span></td>
            <td style="padding:8px 12px; width:22%;"><b>Invoice Date:</b> ${esc(bulkRecord.invoice_date)}</td>
            <td style="padding:8px 12px; width:20%;"><b>SAC Code:</b> 9983</td>
            <td style="padding:8px 12px; width:30%;"><b>Place of Supply:</b> ${esc(branchObj.state)} (${esc(branchObj.state_code)})</td>
          </tr>
        </table>

        <!-- Bill To -->
        <div style="border:1px solid #e2e8f0; border-radius:4px; padding:12px; background:#fafafa; margin-bottom:18px;">
          <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:#0f2942; border-bottom:1px solid #cbd5e1; padding-bottom:4px; margin-bottom:6px;">
            BILL TO (INSURANCE COMPANY):
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:14.5px; font-weight:800; color:#0f2942; line-height:1.3;">${esc(legalEntityName)}</div>
              ${legalEntityName.toUpperCase() !== (bulkRecord.company_name || '').toUpperCase() ? `<div style="font-size:10.5px; color:#64748b; font-weight:600; margin-top:1px;">(${esc(bulkRecord.company_name)})</div>` : ''}
              <div style="font-weight:600; font-size:12px; color:#334155; margin-top:3px;">${esc(branchObj.branch_name)}</div>
              <div style="font-size:11px; color:#475569; margin-top:2px;">${esc(branchObj.billing_address)}</div>
            </div>
            <div style="text-align:right; font-size:11.5px;">
              <div><b>GSTIN:</b> <span style="font-family:monospace; font-weight:700;">${esc(branchObj.gstin || 'Unregistered')}</span></div>
              <div><b>State:</b> ${esc(branchObj.state)} (Code: ${esc(branchObj.state_code)})</div>
              <div style="margin-top:4px;"><span class="badge" style="background:#dcfce7; color:#15803d; font-weight:700;">Total Claims Billed: ${selectedCases.length} Cases</span></div>
            </div>
          </div>
        </div>

        <!-- Line Items -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#0f2942; color:#fff; font-size:11px; text-transform:uppercase;">
              <th style="padding:8px 10px; width:45px; text-align:center;">S.No</th>
              <th style="padding:8px 12px; text-align:left;">Description of Services</th>
              <th style="padding:8px 12px; width:90px; text-align:center;">SAC Code</th>
              <th style="padding:8px 12px; width:130px; text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:12px 10px; text-align:center; vertical-align:top;">1</td>
              <td style="padding:12px 12px;">
                <div style="font-weight:700; color:#0f2942;">Consolidated Professional Charges for Claim Investigation Services</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">Investigation charges for <b>${selectedCases.length} Cases</b> (Detailed breakdown attached in Annexure-I)</div>
              </td>
              <td style="padding:12px 12px; text-align:center; vertical-align:top; font-family:monospace;">9983</td>
              <td style="padding:12px 12px; text-align:right; vertical-align:top; font-weight:700;">${fmtINR(bulkRecord.subtotal_fee)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:12px 10px; text-align:center; vertical-align:top;">2</td>
              <td style="padding:12px 12px;">
                <div style="font-weight:700; color:#0f2942;">Travelling, Conveyance & Incidental Out-of-pocket Expenses</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">Field verification conveyance across assigned districts</div>
              </td>
              <td style="padding:12px 12px; text-align:center; vertical-align:top; font-family:monospace;">9983</td>
              <td style="padding:12px 12px; text-align:right; vertical-align:top; font-weight:700;">${fmtINR(bulkRecord.subtotal_expense)}</td>
            </tr>
            <!-- Subtotal -->
            <tr style="background:#f8fafc; border-bottom:1px solid #cbd5e1;">
              <td colspan="3" style="text-align:right; padding:8px 12px; font-weight:700; color:#0f2942;">Subtotal (Taxable Value):</td>
              <td style="text-align:right; padding:8px 12px; font-weight:800; color:#0f2942;">${fmtINR(taxable)}</td>
            </tr>
            <!-- Taxes -->
            ${taxRowsHTML}
            <!-- Grand Total -->
            <tr style="background:#0f2942; color:#fff;">
              <td colspan="3" style="text-align:right; padding:10px 12px; font-size:13px; font-weight:800; letter-spacing:0.5px;">TOTAL INVOICE AMOUNT:</td>
              <td style="text-align:right; padding:10px 12px; font-size:14px; font-weight:800;">${fmtINR(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Amount in Words -->
        <div style="background:#f1f5f9; padding:8px 12px; border-radius:4px; font-size:11.5px; margin-bottom:18px; border-left:3px solid #0f2942;">
          <b>Amount in Words:</b> <span style="font-weight:700; color:#0f2942;">${numToIndianWords(grandTotal)}</span>
        </div>

        <!-- Bank Details & Signatory Strip -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #e2e8f0; padding-top:14px; margin-top:auto;">
          <div style="border:1px dashed #cbd5e1; border-radius:4px; padding:10px 14px; font-size:11px; background:#fafafa; width:340px;">
            <div style="font-weight:800; color:#0f2942; margin-bottom:4px; text-transform:uppercase; font-size:11px;">🏦 Bank Payment Details</div>
            <div><b>Bank Name:</b> ${esc(bankName)}</div>
            <div><b>Account No:</b> <span style="font-family:monospace; font-weight:700;">${esc(bankAcc)}</span></div>
            <div><b>IFSC Code:</b> <span style="font-family:monospace; font-weight:700;">${esc(bankIfsc)}</span></div>
            <div><b>Branch:</b> ${esc(bankBranch)}</div>
          </div>
          <div style="text-align:center; width:220px;">
            <div style="font-size:11px; font-weight:700; color:#0f2942; margin-bottom:45px;">For ${esc(agencyName)}</div>
            <div style="border-top:1px solid #64748b; padding-top:4px; font-size:11px; font-weight:700;">Authorized Signatory</div>
            <div style="font-size:9.5px; color:#64748b;">(Computer Generated Tax Invoice)</div>
          </div>
        </div>

        <div style="margin-top:16px; font-size:9.5px; color:#64748b; border-top:1px solid #f1f5f9; padding-top:6px;">
          <b>Terms & Conditions:</b> ${esc(invoiceTerms)}
        </div>
      </div>

      <!-- PAGE 2: ANNEXURE STATEMENT TABLE -->
      <div style="font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; background:#fff; padding:32px 36px; box-sizing:border-box; width:794px; min-height:1080px; margin:0 auto; line-height:1.4; font-size:11px;">
        <div style="border-bottom:2px solid #0f2942; padding-bottom:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h2 style="margin:0; font-size:15px; font-weight:800; color:#0f2942;">ANNEXURE — I: CASE-WISE STATEMENT OF CHARGES</h2>
            <div style="font-size:11px; color:#475569;">Attached to Tax Invoice No: <b>${esc(bulkRecord.invoice_no)}</b> | Client: <b>${esc(legalEntityName)}</b> | Dated: <b>${esc(bulkRecord.invoice_date)}</b></div>
          </div>
          <div style="text-align:right;">
            <span class="badge" style="background:#0f2942; color:#fff; font-weight:700; font-size:11px;">Total Cases: ${selectedCases.length}</span>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:16px; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#0f2942; color:#fff; font-size:10px; text-transform:uppercase;">
              <th style="padding:6px; width:30px; text-align:center;">#</th>
              <th style="padding:6px; text-align:left;">Doc Code</th>
              <th style="padding:6px; text-align:left;">Claim No</th>
              <th style="padding:6px; text-align:left;">Policy No</th>
              <th style="padding:6px; text-align:left;">Insured Name</th>
              <th style="padding:6px; text-align:left;">Hospital / Loc</th>
              <th style="padding:6px; text-align:center;">Date</th>
              <th style="padding:6px; text-align:right;">Fee (₹)</th>
              <th style="padding:6px; text-align:right;">TA (₹)</th>
              <th style="padding:6px; text-align:right;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${annexureRows}
            <tr style="background:#f8fafc; font-weight:800; border-top:2px solid #0f2942;">
              <td colspan="7" style="padding:8px 6px; text-align:right; font-size:11px; text-transform:uppercase;">Total Taxable Charges:</td>
              <td style="padding:8px 6px; text-align:right;">${fmtINR(bulkRecord.subtotal_fee)}</td>
              <td style="padding:8px 6px; text-align:right;">${fmtINR(bulkRecord.subtotal_expense)}</td>
              <td style="padding:8px 6px; text-align:right; color:#0f2942; font-size:12px;">${fmtINR(taxable)}</td>
            </tr>
          </tbody>
        </table>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:10px; font-size:10px; color:#64748b;">
          <div>End of Annexure — Generated by ${esc(agencyName)} System</div>
          <div>Page 2 of 2</div>
        </div>
      </div>`;
  }
  window.generateBulkInvoiceHTML = generateBulkInvoiceHTML;

  async function saveAndGenerateBulkInvoice() {
    const saveBtn = document.getElementById('cr-save-bulk-inv-btn');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const selectedCodes = Array.from(window.crSelectedDocCodes || []);
      const allCases = window.cases || [];
      const selectedCases = allCases.filter(c => selectedCodes.includes(c.doc_code));

      if (selectedCases.length === 0) {
        if (typeof showToast === 'function') showToast('No cases selected.', true);
        return;
      }

      const invoice_no = (document.getElementById('cr-bulk-inv-number')?.value || '').trim();
      const invoice_date = document.getElementById('cr-bulk-inv-date')?.value || new Date().toISOString().slice(0, 10);
      const company_name = document.getElementById('cr-bulk-inv-company-name')?.textContent?.trim() || '';
      const branch_id = document.getElementById('cr-bulk-inv-branch-select')?.value || null;

      const subtotal_fee = Math.max(0, parseFloat(document.getElementById('cr-bulk-inv-fee')?.value) || 0);
      const subtotal_expense = Math.max(0, parseFloat(document.getElementById('cr-bulk-inv-ta')?.value) || 0);
      const taxable_amount = subtotal_fee + subtotal_expense;
      const gst_rate = parseFloat(document.getElementById('cr-bulk-inv-gst-rate')?.value) || 18;

      let branch = (window.companyBranches || []).find(b => b.id === branch_id);
      if (!branch) {
        branch = {
          branch_name: `${company_name} Regional Office`,
          state: 'Madhya Pradesh',
          state_code: '23',
          gstin: '23AAAAA0000A1Z5',
          billing_address: `${company_name} Claims Office`
        };
      }

      const agencyStateCode = getAgencyStateCode();
      const isIntraState = (branch.state_code || agencyStateCode) === agencyStateCode;
      const gst_type = isIntraState ? 'CGST+SGST' : 'IGST';
      const gst_amount = Math.round((taxable_amount * (gst_rate / 100)) * 100) / 100;
      const grand_total = Math.round((taxable_amount + gst_amount) * 100) / 100;

      if (!invoice_no) {
        if (typeof showToast === 'function') showToast('Please enter an Invoice Number.', true);
        return;
      }

      // 1. Insert into Supabase bulk_invoices table
      const bulkPayload = {
        invoice_no,
        invoice_date,
        company_name,
        branch_id: branch.id || null,
        case_ids: selectedCodes,
        total_cases: selectedCases.length,
        subtotal_fee,
        subtotal_expense,
        taxable_amount,
        gst_rate,
        gst_type,
        gst_amount,
        grand_total,
        payment_status: 'Unpaid'
      };

      const { data: bulkData, error: bulkErr } = await supabaseClient
        .from('bulk_invoices')
        .insert([bulkPayload])
        .select()
        .single();

      if (bulkErr) throw bulkErr;

      // 2. Update each selected case in Supabase cases table with billing_status and calculated case-level invoice amounts
      const caseUpdates = selectedCases.map(c => {
        const caseFee = (Number(c.fee1) || 0) + (Number(c.fee2) || 0);
        const caseTa = (Number(c.ta1) || 0) + (Number(c.ta2) || 0);
        const caseTaxable = caseFee + caseTa;
        const caseGst = Math.round(caseTaxable * (gst_rate / 100) * 100) / 100;
        const caseInvAmount = Math.round((caseTaxable + caseGst) * 100) / 100;

        c.invoice_no = invoice_no;
        c.invoice_date = invoice_date;
        c.branch_id = branch.id || null;
        c.bulk_invoice_id = bulkData ? bulkData.id : null;
        c.billing_status = 'Billed';
        c.invoice_fee = caseFee;
        c.invoice_expense = caseTa;
        c.invoice_gst_rate = gst_rate;
        c.invoice_gst_amount = caseGst;
        c.invoice_amount = caseInvAmount;

        return supabaseClient
          .from('cases')
          .update({
            invoice_no,
            invoice_date,
            branch_id: branch.id || null,
            bulk_invoice_id: bulkData ? bulkData.id : null,
            billing_status: 'Billed',
            invoice_fee: caseFee,
            invoice_expense: caseTa,
            invoice_gst_rate: gst_rate,
            invoice_gst_amount: caseGst,
            invoice_amount: caseInvAmount
          })
          .eq('doc_code', c.doc_code);
      });

      await Promise.allSettled(caseUpdates);

      if (typeof showToast === 'function') {
        showToast(`Bulk Tax Invoice ${invoice_no} generated and saved to Supabase!`);
      }

      if (typeof closeModal === 'function') closeModal('cr-bulk-invoice-modal');

      // 4. Trigger PDF Preview of Master Invoice + Annexure
      const html = generateBulkInvoiceHTML(bulkPayload, selectedCases, branch);
      const filename = `Bulk_Tax_Invoice_${company_name.replace(/[^a-zA-Z0-9]/g, '_')}_${invoice_no.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

      if (typeof openPDFPreview === 'function') {
        openPDFPreview(html, filename, { orientation: 'portrait' });
      }

      // 5. Re-render UI
      if (typeof renderCompanyRecoveryHub === 'function') renderCompanyRecoveryHub();
      if (typeof renderCasesTable === 'function') renderCasesTable();

    } catch (err) {
      console.error('[GST] Error saving bulk invoice:', err);
      if (typeof showToast === 'function') showToast('Failed to save bulk invoice: ' + err.message, true);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }
  window.saveAndGenerateBulkInvoice = saveAndGenerateBulkInvoice;

  // ========================================================================
  // 7. INITIALIZE ON DOM READY
  // ========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      loadCompanyBranchesFromDB();
    }, 400);
  });

})();
