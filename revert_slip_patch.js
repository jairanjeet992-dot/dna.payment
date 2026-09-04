const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const searchStr = `
function invAmountOnCase(c, name) {
  let fee=0, ta=0, statuses=[], hardcopies=[];
  
  if (c.inv1===name && c.inv2===name) {
    // If it's a full case (name is in both slots), don't duplicate the status string.
    fee = (c.fee1||0) + (c.fee2||0);
    ta = (c.ta1||0) + (c.ta2||0);
    
    // Check if BOTH slots are paid for the entire case to be considered "Paid"
    const isPaid = (c.inv1_status||'').trim() === 'Paid' && (c.inv2_status||'').trim() === 'Paid';
    statuses.push(isPaid ? 'Paid' : 'Pending');
    
    // Hardcopy
    const hc1 = c.hardcopy1_status||'Not Received';
    const hc2 = c.hardcopy2_status||'Not Received';
    hardcopies.push(hc1.toLowerCase() === 'received' && hc2.toLowerCase() === 'received' ? 'Received' : 'Not Received');
    
  } else {
    // Normal single-slot logic
    if (c.inv1===name) { 
        fee+=c.fee1||0; 
        ta+=c.ta1||0; 
        statuses.push((c.inv1_status||'').trim() || 'Pending'); 
        hardcopies.push(c.hardcopy1_status||'Not Received');
    }
    if (c.inv2===name) { 
        fee+=c.fee2||0; 
        ta+=c.ta2||0; 
        statuses.push((c.inv2_status||'').trim() || 'Pending'); 
        hardcopies.push(c.hardcopy2_status||'Not Received');
    }
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

const replaceStr = `
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

code = code.replace(searchStr, replaceStr);
fs.writeFileSync('app.js', code);
