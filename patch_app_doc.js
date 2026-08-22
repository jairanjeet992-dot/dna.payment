const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// 1. In editCase
code = code.replace(
  /document\.getElementById\('f-remarks'\)\.value = c\.remarks \|\| '';/,
  `document.getElementById('f-remarks').value = c.remarks || '';
  document.getElementById('f-companyhardcopy').value = c.company_hardcopy_status || 'Pending';
  document.getElementById('f-companyawb').value = c.company_hardcopy_awb || '';`
);

code = code.replace(
  /document\.getElementById\('f-remarks'\)\.value = '';/,
  `document.getElementById('f-remarks').value = '';
  if (document.getElementById('f-companyhardcopy')) document.getElementById('f-companyhardcopy').value = 'Pending';
  if (document.getElementById('f-companyawb')) document.getElementById('f-companyawb').value = '';`
);

// 2. In saveCase
code = code.replace(
  /hardcopy2_status:\s*document\.getElementById\('f-hardcopy2status'\)\.value,/,
  `hardcopy2_status: document.getElementById('f-hardcopy2status').value,
    company_hardcopy_status: document.getElementById('f-companyhardcopy') ? document.getElementById('f-companyhardcopy').value : 'Pending',
    company_hardcopy_awb: document.getElementById('f-companyawb') ? document.getElementById('f-companyawb').value : '',`
);

// 3. Add Bulk Doc Manager functions at the end
const bulkDocLogic = `
// ============================================================
// BULK DOCUMENT & DISPATCH MANAGER
// ============================================================
let currentDocTab = 'receive';

function openBulkDocManager() {
  if (!window.isCurrentUserAdmin) {
    showToast('Only admins can bulk-manage documents', true);
    return;
  }
  
  // Populate Investigator Dropdown
  const invSelect = document.getElementById('bulkdoc-receive-inv');
  invSelect.innerHTML = '<option value="">-- Choose Investigator --</option>' + 
    INVESTIGATORS.map(n => \`<option value="\${escAttr(n)}">\${esc(n)}</option>\`).join('');
    
  // Populate Company Dropdown
  const coSelect = document.getElementById('bulkdoc-dispatch-co');
  coSelect.innerHTML = '<option value="">-- Choose Company --</option>' + 
    COMPANIES.map(c => \`<option value="\${escAttr(c)}">\${esc(c)}</option>\`).join('');

  document.getElementById('bulkdoc-receive-table').querySelector('tbody').innerHTML = '';
  document.getElementById('bulkdoc-dispatch-table').querySelector('tbody').innerHTML = '';
  document.getElementById('bulkdoc-dispatch-awb').value = '';
  
  switchDocTab('receive');
  openModal('bulkdoc-modal');
}

function switchDocTab(tab) {
  currentDocTab = tab;
  document.getElementById('doc-tab-receive').classList.toggle('active', tab === 'receive');
  document.getElementById('doc-tab-dispatch').classList.toggle('active', tab === 'dispatch');
  
  document.getElementById('doc-view-receive').style.display = (tab === 'receive') ? 'block' : 'none';
  document.getElementById('doc-view-dispatch').style.display = (tab === 'dispatch') ? 'block' : 'none';
}

function toggleAllDocCheckboxes(sourceEl, tab) {
  const tableId = tab === 'receive' ? 'bulkdoc-receive-table' : 'bulkdoc-dispatch-table';
  const checkboxes = document.querySelectorAll(\`#\${tableId} tbody input[type="checkbox"]\`);
  checkboxes.forEach(cb => cb.checked = sourceEl.checked);
}

function renderBulkDocReceive() {
  const name = document.getElementById('bulkdoc-receive-inv').value;
  const tbody = document.getElementById('bulkdoc-receive-table').querySelector('tbody');
  tbody.innerHTML = '';
  
  if (!name) return;
  
  // Find cases where this person is INV1 (and HC isn't Received) OR INV2 (and HC isn't Received)
  const pendingCases = cases.filter(c => {
    if (c.exception_type === 'Withdrawn') return false;
    const isInv1 = (c.inv1 === name && c.hardcopy1_status !== 'Received');
    const isInv2 = (c.inv2 === name && c.hardcopy2_status !== 'Received');
    return isInv1 || isInv2;
  });
  
  if (pendingCases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;">No pending hard copies for this investigator.</td></tr>';
    return;
  }
  
  tbody.innerHTML = pendingCases.map(c => {
    let roles = [];
    if (c.inv1 === name) roles.push('INV1');
    if (c.inv2 === name) roles.push('INV2');
    
    return \`<tr data-doccode="\${c.doc_code}" data-roles="\${roles.join(',')}">
      <td><input type="checkbox" checked></td>
      <td style="font-family:var(--mono);">\${c.doc_code}</td>
      <td>\${c.date||''}</td>
      <td>\${c.claim_no||''}</td>
      <td>\${c.insured_name||''}</td>
      <td>\${roles.join(' & ')}</td>
      <td><span style="color:var(--red);">Not Received</span></td>
    </tr>\`;
  }).join('');
}

function renderBulkDocDispatch() {
  const comp = document.getElementById('bulkdoc-dispatch-co').value;
  const tbody = document.getElementById('bulkdoc-dispatch-table').querySelector('tbody');
  tbody.innerHTML = '';
  
  if (!comp) return;
  
  // Find cases for this company that aren't Dispatched or Delivered
  const pendingCases = cases.filter(c => {
    if (c.exception_type === 'Withdrawn') return false;
    if (c.company !== comp) return false;
    return (c.company_hardcopy_status !== 'Dispatched' && c.company_hardcopy_status !== 'Delivered');
  });
  
  if (pendingCases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">No pending dispatches for this company.</td></tr>';
    return;
  }
  
  tbody.innerHTML = pendingCases.map(c => {
    return \`<tr data-doccode="\${c.doc_code}">
      <td><input type="checkbox" checked></td>
      <td style="font-family:var(--mono);">\${c.doc_code}</td>
      <td>\${c.date||''}</td>
      <td>\${c.claim_no||''}</td>
      <td>\${c.insured_name||''}</td>
      <td>\${c.inv1||'—'}</td>
    </tr>\`;
  }).join('');
}

async function processBulkDocs() {
  const btn = document.getElementById('bulkdoc-process-btn');
  btn.disabled = true;
  btn.textContent = 'Processing...';
  
  let updates = [];
  
  if (currentDocTab === 'receive') {
    const rows = document.querySelectorAll('#bulkdoc-receive-table tbody tr');
    rows.forEach(tr => {
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb && cb.checked) {
        const docCode = tr.getAttribute('data-doccode');
        const roles = tr.getAttribute('data-roles').split(',');
        const updateObj = { doc_code: docCode }; // Need doc_code to match later if not using bulk RPC easily
        
        const originalCase = cases.find(c => c.doc_code === docCode);
        if (!originalCase) return;
        
        let toUpdate = {};
        if (roles.includes('INV1')) toUpdate.hardcopy1_status = 'Received';
        if (roles.includes('INV2')) toUpdate.hardcopy2_status = 'Received';
        
        updates.push({ docCode, toUpdate });
      }
    });
  } else {
    const awb = document.getElementById('bulkdoc-dispatch-awb').value.trim();
    const rows = document.querySelectorAll('#bulkdoc-dispatch-table tbody tr');
    rows.forEach(tr => {
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb && cb.checked) {
        const docCode = tr.getAttribute('data-doccode');
        updates.push({ 
          docCode, 
          toUpdate: { 
            company_hardcopy_status: 'Dispatched', 
            company_hardcopy_awb: awb 
          } 
        });
      }
    });
  }
  
  if (updates.length === 0) {
    showToast('No cases selected', true);
    btn.disabled = false;
    btn.textContent = 'Apply Changes';
    return;
  }
  
  // Process sequentially to avoid blowing up limits, or if small enough, Promise.all
  try {
    let successCount = 0;
    for (let u of updates) {
      const { error } = await supabaseClient.from('cases').update(u.toUpdate).eq('doc_code', u.docCode);
      if (error) {
        console.error('Update failed for', u.docCode, error);
      } else {
        successCount++;
      }
    }
    
    showToast(\`Successfully updated \${successCount} cases!\`);
    await loadCasesFromDB(); // Reload local cache
    renderAll();
    closeModal('bulkdoc-modal');
  } catch (err) {
    console.error('Bulk Doc Error', err);
    showToast('An error occurred during update', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Changes';
  }
}
`;

code += '\n' + bulkDocLogic;

// 4. Update CSV Exporter
code = code.replace(
  /'INV1 Hard Copy': c.hardcopy1_status, 'INV2 Hard Copy': c.hardcopy2_status, 'Remarks': c.remarks/,
  `'INV1 Hard Copy': c.hardcopy1_status, 'INV2 Hard Copy': c.hardcopy2_status, 'Company Dispatch': c.company_hardcopy_status, 'AWB No': c.company_hardcopy_awb, 'Remarks': c.remarks`
);
code = code.replace(
  /'INV1 Status','INV2 Status','INV1 Hard Copy','INV2 Hard Copy','Remarks'/,
  `'INV1 Status','INV2 Status','INV1 Hard Copy','INV2 Hard Copy','Company Dispatch','AWB No','Remarks'`
);
code = code.replace(
  /c.hardcopy1_status,c.hardcopy2_status,c.remarks/,
  `c.hardcopy1_status,c.hardcopy2_status,c.company_hardcopy_status,c.company_hardcopy_awb,c.remarks`
);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('Patched app.js for Bulk Docs');
