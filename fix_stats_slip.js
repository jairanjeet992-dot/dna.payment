const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Fix KPI Logic (computeInvStats)
const kpiSearch = `
    if (!isActuallySalary) {
      if (both && (c.inv1_status || '').trim() === 'Paid' && (c.inv2_status || '').trim() === 'Paid') paidCases += 1;
      else if (onlyAsInv1 && (c.inv1_status || '').trim() === 'Paid') paidCases += 0.5;
      else if (onlyAsInv2 && (c.inv2_status || '').trim() === 'Paid') paidCases += 0.5;

      if (c.inv1===name) { totalPayable += (c.fee1||0)+(c.ta1||0); if ((c.inv1_status || '').trim() === 'Paid') paidAmt += (c.fee1||0)+(c.ta1||0); }
      if (c.inv2===name) { totalPayable += (c.fee2||0)+(c.ta2||0); if ((c.inv2_status || '').trim() === 'Paid') paidAmt += (c.fee2||0)+(c.ta2||0); }
    }
`;

const kpiReplace = `
    if (!isActuallySalary) {
      const s1Paid = (c.inv1_status || '').trim().toLowerCase() === 'paid';
      const s2Paid = (c.inv2_status || '').trim().toLowerCase() === 'paid';
      const s1Pending = (c.inv1_status || '').trim().toLowerCase() === 'pending';
      const s2Pending = (c.inv2_status || '').trim().toLowerCase() === 'pending';

      if (c.inv1===name) totalPayable += (c.fee1||0)+(c.ta1||0);
      if (c.inv2===name) totalPayable += (c.fee2||0)+(c.ta2||0);

      if (both) {
         const bothPaid = (s1Paid || s2Paid) && !s1Pending && !s2Pending;
         if (bothPaid) {
            paidCases += 1;
            paidAmt += (c.fee1||0)+(c.ta1||0) + (c.fee2||0)+(c.ta2||0);
         } else {
            if (s1Paid) paidAmt += (c.fee1||0)+(c.ta1||0);
            if (s2Paid) paidAmt += (c.fee2||0)+(c.ta2||0);
         }
      } else {
         if (onlyAsInv1 && s1Paid) { paidCases += 0.5; paidAmt += (c.fee1||0)+(c.ta1||0); }
         if (onlyAsInv2 && s2Paid) { paidCases += 0.5; paidAmt += (c.fee2||0)+(c.ta2||0); }
      }
    }
`;

code = code.replace(kpiSearch.trim(), kpiReplace.trim());

// 2. Fix Slip Logic (invAmountOnCase)
const slipSearch = `
function invAmountOnCase(c, name) {
  let fee=0, ta=0, statuses=[], hardcopies=[];
  if (c.inv1===name) { 
    fee+=c.fee1||0; 
    ta+=c.ta1||0; 
    statuses.push(c.inv1_status||'—'); 
    hardcopies.push(c.hardcopy1_status||'Not Received');
  }
  if (c.inv2===name) { 
    fee+=c.fee2||0; 
    ta+=c.ta2||0; 
    statuses.push(c.inv2_status||'—'); 
    hardcopies.push(c.hardcopy2_status||'Not Received');
  }
  const isHcReceived = hardcopies.length > 0 && hardcopies.every(h => (h||'').toLowerCase() === 'received');
  return {
    fee, 
    ta, 
    total: fee+ta, 
    status: statuses.join(' / '), 
    hardcopy: isHcReceived ? 'Received' : 'Not Received'
  };
}
`;

const slipReplace = `
function invAmountOnCase(c, name) {
  let fee=0, ta=0, statuses=[], hardcopies=[];
  
  if (c.inv1===name && c.inv2===name) {
    fee = (c.fee1||0) + (c.fee2||0);
    ta = (c.ta1||0) + (c.ta2||0);
    const s1Paid = (c.inv1_status||'').trim().toLowerCase() === 'paid';
    const s2Paid = (c.inv2_status||'').trim().toLowerCase() === 'paid';
    const s1Pending = (c.inv1_status||'').trim().toLowerCase() === 'pending';
    const s2Pending = (c.inv2_status||'').trim().toLowerCase() === 'pending';
    
    // Exact same logic used in KPI
    const isPaid = (s1Paid || s2Paid) && !s1Pending && !s2Pending;
    statuses.push(isPaid ? 'Paid' : 'Pending');
    
    const hc1 = c.hardcopy1_status||'Not Received';
    const hc2 = c.hardcopy2_status||'Not Received';
    hardcopies.push(hc1.toLowerCase() === 'received' && hc2.toLowerCase() === 'received' ? 'Received' : 'Not Received');
  } else {
    if (c.inv1===name) { 
        fee+=c.fee1||0; ta+=c.ta1||0; 
        statuses.push((c.inv1_status||'').trim() || 'Pending'); 
        hardcopies.push(c.hardcopy1_status||'Not Received');
    }
    if (c.inv2===name) { 
        fee+=c.fee2||0; ta+=c.ta2||0; 
        statuses.push((c.inv2_status||'').trim() || 'Pending'); 
        hardcopies.push(c.hardcopy2_status||'Not Received');
    }
  }

  const isHcReceived = hardcopies.length > 0 && hardcopies.every(h => (h||'').toLowerCase() === 'received');
  return {
    fee, ta, total: fee+ta, 
    status: statuses.join(' / '), 
    hardcopy: isHcReceived ? 'Received' : 'Not Received'
  };
}
`;

code = code.replace(slipSearch.trim(), slipReplace.trim());

fs.writeFileSync('app.js', code);
