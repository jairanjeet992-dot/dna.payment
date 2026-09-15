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
  const numericFields = ['fee1','fee2','ta1','ta2','received','tds_deducted'];
  if (numericFields.includes(field) && (newVal === '' || newVal === null)) {
    showToast('Enter a value for the amount field.', true); return;
  }
  if (newVal === '') { showToast('Enter a value to apply.', true); return; }
  const docCodes = Array.from(selectedDocCodes);
  if (!confirm(`Apply "${field}" = "${newVal}" to ${docCodes.length} selected case(s)?`)) return;
  
  const typedVal = numericFields.includes(field) ? parseFloat(newVal) : newVal;
  if (numericFields.includes(field) && Number.isNaN(typedVal)) { showToast('Invalid number value.', true); return; }
  
  const applyBtn = document.querySelector('#bulkedit-modal .modal-foot .btn-navy');
  if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = 'Applying…'; }
  try {
    const isFinancial = numericFields.includes(field);
    const updates = docCodes.map(docCode => {
      const fields = { [field]: typedVal };
      if (isFinancial) {
        const c = (window.cases || []).find(x => x.doc_code === docCode) || cases.find(x => x.doc_code === docCode);
        if (c) {
          const calcData = { ...c, [field]: typedVal };
          const calc = typeof calculateCasePayableAndProfit === 'function' ? calculateCasePayableAndProfit({
            ...calcData,
            fee1: Number(calcData.fee1) || 0,
            fee2: Number(calcData.fee2) || 0,
            ta1: Number(calcData.ta1) || 0,
            ta2: Number(calcData.ta2) || 0,
            received: Number(calcData.received) || 0,
            tds_deducted: Number(calcData.tds_deducted) || 0
          }) : { payable: 0, profit: 0 };
          
          if (calc) {
              fields.total_payable = calc.payable;
              fields.profit = calc.profit;
          }
        }
      }
      return { doc_code: docCode, fields };
    });

    if (typeof executeAtomicBatchUpdate === 'function') {
       await executeAtomicBatchUpdate(updates, {
         actionTitle: `Bulk Edit: Set ${field} to ${typedVal}`,
         updatedFields: [field, 'total_payable', 'profit']
       });
    } else {
       // Fallback 
       for (const u of updates) {
           await supabaseClient.from('cases').update(u.fields).eq('doc_code', u.doc_code);
       }
    }
    
    bulkEditConfig = { field };
    closeModal('bulkedit-modal');
    if (typeof loadCasesFromDB === 'function') await loadCasesFromDB();
    if (typeof renderAll === 'function') renderAll();
    showToast(`Updated ${docCodes.length} case(s).`);
  } catch (err) {
    showToast('Bulk edit failed: ' + err.message, true);
  } finally {
    if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Apply to All Selected'; }
  }
}
