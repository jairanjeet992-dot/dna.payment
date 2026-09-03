const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

const oldWhatsApp = `  const stats = computeInvStats(name, monthCases);

  const message = \`Hello \${name},\\n\\nYour payment slip for *\${mo.label}* from \${settings.agencyName}:\\n\\n\` +
    \`Total Cases: \${stats.totalCases}\\n\` +
    \`Total Payable: Rs \${fmt(stats.totalPayable)}\\n\` +
    \`Already Paid: Rs \${fmt(stats.paidAmt)}\\n\` +
    \`*Net Payable Now: Rs \${fmt(stats.pendingAmt)}*\\n\\n\` +
    \`Detailed PDF slip has been generated separately — I'll attach it here.\\n\\nThank you.\`;`;

const newWhatsApp = `  const stats = computeInvStats(name, monthCases);
  const monthExpenses = (window.investigatorExpenses || []).filter(e => {
    if (e.investigator_name !== name || !e.date) return false;
    const d = new Date(e.date);
    return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y;
  });
  const expTotal = monthExpenses.reduce((s, e) => s + (Number(e.amount)||0), 0);
  const expPaid = monthExpenses.filter(e => e.status === 'Paid').reduce((s, e) => s + (Number(e.amount)||0), 0);
  const expPending = monthExpenses.filter(e => e.status !== 'Paid').reduce((s, e) => s + (Number(e.amount)||0), 0);
  
  stats.totalPayable += expTotal;
  stats.paidAmt += expPaid;
  stats.pendingAmt += expPending;

  let expText = '';
  if (expTotal > 0) expText = \`Vouchers/Expenses: Rs \${fmt(expTotal)}\\n\`;

  const message = \`Hello \${name},\\n\\nYour payment slip for *\${mo.label}* from \${settings.agencyName}:\\n\\n\` +
    \`Total Cases: \${stats.totalCases}\\n\` +
    \`Cases Payable: Rs \${fmt(stats.totalPayable - expTotal)}\\n\` +
    expText +
    \`Total Payable: Rs \${fmt(stats.totalPayable)}\\n\` +
    \`Already Paid: Rs \${fmt(stats.paidAmt)}\\n\` +
    \`*Net Payable Now: Rs \${fmt(stats.pendingAmt)}*\\n\\n\` +
    \`Detailed PDF slip has been generated separately — I'll attach it here.\\n\\nThank you.\`;`;

if (appJs.includes(oldWhatsApp)) {
  appJs = appJs.replace(oldWhatsApp, newWhatsApp);
  console.log('Patched WhatsApp in app.js');
}

const oldGenSlip = `  const stats = computeInvStats(name, monthCases);
  const html = slipTemplatePremium(name, mo, monthCases, stats);`;

const newGenSlip = `  const stats = computeInvStats(name, monthCases);
  const monthExpenses = (window.investigatorExpenses || []).filter(e => {
    if (e.investigator_name !== name || !e.date) return false;
    const d = new Date(e.date);
    return (d.getMonth()+1)===mo.m && d.getFullYear()===mo.y;
  });
  const expTotal = monthExpenses.reduce((s, e) => s + (Number(e.amount)||0), 0);
  const expPaid = monthExpenses.filter(e => e.status === 'Paid').reduce((s, e) => s + (Number(e.amount)||0), 0);
  const expPending = monthExpenses.filter(e => e.status !== 'Paid').reduce((s, e) => s + (Number(e.amount)||0), 0);
  
  stats.totalPayable += expTotal;
  stats.paidAmt += expPaid;
  stats.pendingAmt += expPending;

  const html = typeof window.slipTemplatePremium === 'function' 
    ? window.slipTemplatePremium(name, mo, monthCases, stats, monthExpenses)
    : slipTemplatePremium(name, mo, monthCases, stats);`;

if (appJs.includes(oldGenSlip)) {
  appJs = appJs.replace(oldGenSlip, newGenSlip);
  console.log('Patched generateSlip in app.js');
}

fs.writeFileSync('app.js', appJs);

