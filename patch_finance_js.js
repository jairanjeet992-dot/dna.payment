const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const financeLogic = `
// ============================================================
// FINANCE & TDS LEDGER
// ============================================================

function getFinancialYear(dateString) {
  if (!dateString) return 'Unknown';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Unknown';
  const month = d.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
  const year = d.getFullYear();
  if (month >= 3) {
    return \`FY \${year}-\${(year + 1).toString().slice(2)}\`;
  } else {
    return \`FY \${year - 1}-\${year.toString().slice(2)}\`;
  }
}

window.renderFinanceLedger = function() {
  const tbody = document.getElementById('finance-tds-tbody');
  const fySelect = document.getElementById('finance-fy-filter');
  if (!tbody) return;

  const allCases = window.cases || cases || [];
  
  // Build a set of all FYs to populate dropdown
  const fYears = new Set();
  
  // Grouping logic
  const ledger = {}; // Key: "Company_FY", Value: { comp, fy, billed, rec, tds, loss }
  
  let totalInv = 0;
  let totalRec = 0;
  let totalTds = 0;
  
  allCases.forEach(c => {
    if (c.exception_type === 'Withdrawn' || c.exception_type === 'Rejected') return; // Skip non-billable
    
    const fy = getFinancialYear(c.date);
    if (fy !== 'Unknown') fYears.add(fy);
    
    const selectedFy = fySelect ? fySelect.value : 'ALL';
    if (selectedFy !== 'ALL' && selectedFy !== fy) return;
    
    const comp = c.company || 'Unknown';
    const key = comp + '_' + fy;
    
    if (!ledger[key]) {
      ledger[key] = { comp, fy, billed: 0, rec: 0, tds: 0, loss: 0 };
    }
    
    const invAmt = Number(c.invoice_amount) || Number(c.total_payable) || 0;
    const recAmt = Number(c.received) || 0;
    const tdsAmt = Number(c.tds_deducted) || 0;
    
    ledger[key].billed += invAmt;
    ledger[key].rec += recAmt;
    ledger[key].tds += tdsAmt;
    
    // Loss/Pending: Billed - (Received + TDS)
    ledger[key].loss += (invAmt - (recAmt + tdsAmt));
    
    totalInv += invAmt;
    totalRec += recAmt;
    totalTds += tdsAmt;
  });
  
  // Populate Dropdown if it's currently only "ALL"
  if (fySelect && fySelect.options.length <= 1 && fYears.size > 0) {
    const sortedFys = Array.from(fYears).sort().reverse();
    sortedFys.forEach(fy => {
      const opt = document.createElement('option');
      opt.value = fy;
      opt.textContent = fy;
      fySelect.appendChild(opt);
    });
  }
  
  // Render KPIs
  if (document.getElementById('fin-kpi-inv')) document.getElementById('fin-kpi-inv').textContent = 'Rs ' + money(totalInv);
  if (document.getElementById('fin-kpi-rec')) document.getElementById('fin-kpi-rec').textContent = 'Rs ' + money(totalRec);
  if (document.getElementById('fin-kpi-tds')) document.getElementById('fin-kpi-tds').textContent = 'Rs ' + money(totalTds);
  
  // Render Table
  const rows = Object.values(ledger).sort((a,b) => {
    if (a.comp < b.comp) return -1;
    if (a.comp > b.comp) return 1;
    return b.fy > a.fy ? 1 : -1;
  });
  
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--sub);">No financial records found.</td></tr>';
    return;
  }
  
  tbody.innerHTML = rows.map(r => \`
    <tr>
      <td style="font-weight:700; color:var(--navy);">\${escAttr(r.comp)}</td>
      <td><span class="badge" style="background:#eef2ff; color:#4f46e5;">\${r.fy}</span></td>
      <td style="text-align:right; font-family:var(--mono);">\${money(r.billed)}</td>
      <td style="text-align:right; font-family:var(--mono); color:var(--green); font-weight:600;">\${money(r.rec)}</td>
      <td style="text-align:right; font-family:var(--mono); color:var(--gold); font-weight:700;">\${money(r.tds)}</td>
      <td style="text-align:right; font-family:var(--mono); color:\${r.loss > 0 ? 'var(--red)' : 'var(--sub)'};">\${money(r.loss)}</td>
    </tr>
  \`).join('');
};

window.exportTDSExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Excel library not loaded. Please wait.', true);
    return;
  }
  
  const tbody = document.getElementById('finance-tds-tbody');
  if (!tbody || tbody.querySelectorAll('tr').length === 0 || tbody.textContent.includes('No financial records')) {
    showToast('No data to export', true);
    return;
  }
  
  const rows = [];
  tbody.querySelectorAll('tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length === 6) {
      rows.push({
        'Company Name': tds[0].textContent.trim(),
        'Financial Year': tds[1].textContent.trim(),
        'Total Billed': Number(tds[2].textContent.replace(/,/g, '')),
        'Total Received': Number(tds[3].textContent.replace(/,/g, '')),
        'TDS Deducted': Number(tds[4].textContent.replace(/,/g, '')),
        'Pending/Loss': Number(tds[5].textContent.replace(/,/g, ''))
      });
    }
  });
  
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TDS Ledger');
  XLSX.writeFile(wb, \`TDS_Ledger_\${new Date().toISOString().slice(0,10)}.xlsx\`);
  showToast('TDS Ledger Exported Successfully');
};
`;

// Insert the finance logic right before the closing of the app
if (!code.includes('function getFinancialYear')) {
  code += '\n' + financeLogic;
}

// Hook it into renderAll()
if (code.includes('function renderAll() {')) {
    code = code.replace(
        'function renderAll() {',
        'function renderAll() {\n  if (typeof renderFinanceLedger === \'function\') renderFinanceLedger();'
    );
}

fs.writeFileSync('app.js', code);
console.log('App.js patched for Finance & TDS');
