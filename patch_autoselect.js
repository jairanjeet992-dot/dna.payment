function autoSelectDocs(tab) {
  const pasteId = tab === 'receive' ? 'bulkdoc-receive-paste' : 'bulkdoc-dispatch-paste';
  const tableId = tab === 'receive' ? 'bulkdoc-receive-table' : 'bulkdoc-dispatch-table';
  
  const rawText = document.getElementById(pasteId).value;
  if (!rawText.trim()) return;

  const searchTerms = rawText.split(/[\n,\t\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  if (searchTerms.length === 0) return;

  let rows = document.querySelectorAll(`#${tableId} tbody tr`);
  let matchCount = 0;
  let mismatchedDocs = [];

  const allCases = window.cases || cases || [];
  const tbody = document.getElementById(tableId).querySelector('tbody');

  if (tab === 'receive') {
    const selectedInv = document.getElementById('bulkdoc-receive-inv').value;
    const matchedCases = allCases.filter(c => {
      if (!c || c.exception_type === 'Withdrawn') return false;
      const docCode = (c.doc_code || '').toUpperCase();
      const claimNo = (c.claim_no || '').toUpperCase();
      const polNo = (c.policy_no || '').toUpperCase();
      const matchesSearch = searchTerms.some(t => t === docCode || t === claimNo || t === polNo);
      
      if (matchesSearch) {
        if (selectedInv !== 'ALL') {
          if (c.inv1 !== selectedInv && c.inv2 !== selectedInv) {
            mismatchedDocs.push(c.doc_code || c.claim_no);
            return false;
          }
        }
        return true;
      }
      return false;
    });

    if (matchedCases.length > 0) {
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
    const selectedCo = document.getElementById('bulkdoc-dispatch-co').value;
    const matchedCases = allCases.filter(c => {
      if (!c || c.exception_type === 'Withdrawn') return false;
      const docCode = (c.doc_code || '').toUpperCase();
      const claimNo = (c.claim_no || '').toUpperCase();
      const polNo = (c.policy_no || '').toUpperCase();
      const matchesSearch = searchTerms.some(t => t === docCode || t === claimNo || t === polNo);
      
      if (matchesSearch) {
        if (selectedCo !== 'ALL') {
          if (c.company !== selectedCo) {
            mismatchedDocs.push(c.doc_code || c.claim_no);
            return false;
          }
        }
        return true;
      }
      return false;
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

  if (mismatchedDocs.length > 0) {
      mismatchedDocs = [...new Set(mismatchedDocs)];
      showToast(`⚠️ Skipped ${mismatchedDocs.length} case(s) not belonging to selected name.`, true);
  } else {
      showToast(`✓ ${matchCount} case(s) matched and selected!`);
  }
  updateBulkDocSelectionCount();
}
