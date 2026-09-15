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
    fields.tds_deducted = 0;
    fields.invoice_no = 'REJECTED';
    fields.profit = 0 - (c.total_payable || 0);
  } else if (type === 'Withdrawn') {
    fields.received = 0;
    fields.tds_deducted = 0;
    fields.fee1 = 0;
    fields.fee2 = 0;
    fields.ta1 = 0;
    fields.ta2 = 0;
    fields.total_payable = 0;
    fields.profit = 0;
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
