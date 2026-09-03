const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const newFunc = `
async function markStatementPaid() {
  const name = document.getElementById('slip-inv').value;
  const monthCode = document.getElementById('slip-month').value;
  if (!name || !monthCode) {
    showToast('Please select investigator and month', true);
    return;
  }
  
  if (!confirm(\`Are you sure you want to mark all cases and vouchers for \${name} in \${monthCode} as PAID?\`)) {
    return;
  }

  const mo = MONTHS.find(m => m.code === monthCode);
  const btn = document.querySelector('button[onclick="markStatementPaid()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

  try {
    const casesToUpdate = cases.filter(c => {
      if (!c.date) return false;
      const d = new Date(c.date);
      const isMonth = (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y;
      if (!isMonth) return false;
      
      const asInv1 = (c.inv1 === name && c.inv1_status !== 'Paid');
      const asInv2 = (c.inv2 === name && c.inv2_status !== 'Paid');
      return asInv1 || asInv2;
    });

    const expensesToUpdate = window.investigatorExpenses.filter(e => {
      if (e.investigator_name !== name || !e.date || e.status === 'Paid') return false;
      const d = new Date(e.date);
      return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y;
    });

    if (casesToUpdate.length === 0 && expensesToUpdate.length === 0) {
      showToast('All cases and vouchers are already paid for this period.');
      if (btn) { btn.disabled = false; btn.textContent = '✅ Mark Statement as Paid'; }
      return;
    }

    // Update Cases
    if (casesToUpdate.length > 0) {
      for (const c of casesToUpdate) {
        let update = {};
        if (c.inv1 === name) { update.inv1_status = 'Paid'; c.inv1_status = 'Paid'; }
        if (c.inv2 === name) { update.inv2_status = 'Paid'; c.inv2_status = 'Paid'; }
        if (supabaseClient) {
          const { error } = await window.supabaseClient.from('cases').update(update).eq('id', c.id);
          if (error) throw error;
        }
      }
    }

    // Update Expenses
    if (expensesToUpdate.length > 0) {
      for (const e of expensesToUpdate) {
        e.status = 'Paid';
        if (supabaseClient) {
          const { error } = await window.supabaseClient.from('investigator_expenses').update({ status: 'Paid' }).eq('id', e.id);
          if (error) throw error;
        }
      }
      localStorage.setItem('DNA_INVESTIGATOR_EXPENSES', JSON.stringify(window.investigatorExpenses));
    }

    showToast(\`Successfully marked \${casesToUpdate.length} case(s) and \${expensesToUpdate.length} voucher(s) as Paid.\`);
    renderAll();
  } catch (err) {
    console.error('Mark Paid Error:', err);
    showToast('Error updating status: ' + err.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Mark Statement as Paid'; }
  }
}
`;

if (!appJs.includes('function markStatementPaid()')) {
  appJs = appJs.replace('function sendSlipWhatsApp()', newFunc + '\nfunction sendSlipWhatsApp()');
  fs.writeFileSync('app.js', appJs);
  console.log('Added markStatementPaid to app.js');
} else {
  console.log('markStatementPaid already exists.');
}
