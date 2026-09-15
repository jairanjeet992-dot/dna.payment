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

