const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Filter Logic
const filterSearch = `
  rows = rows.filter(c => {
    const role = c.inv1===name ? 1 : 2;
    const st = role===1 ? c.inv1_status : c.inv2_status;
    return statusFilter==='all' ? true : st !== 'Paid';
  });
`;
const filterReplace = `
  rows = rows.filter(c => {
    if (statusFilter === 'all') return true;
    if (c.inv1 === name && c.inv2 === name) {
        return (c.inv1_status || '').trim() !== 'Paid' || (c.inv2_status || '').trim() !== 'Paid';
    }
    const role = c.inv1===name ? 1 : 2;
    const st = role===1 ? c.inv1_status : c.inv2_status;
    return st !== 'Paid';
  });
`;
code = code.replace(filterSearch, filterReplace);

// 2. Rendering Logic
const renderSearch = `
      const existingFee = role===1 ? c.fee1 : c.fee2;
      const existingTa = role===1 ? c.ta1 : c.ta2;
      const existingStatus = role===1 ? c.inv1_status : c.inv2_status;
`;
const renderReplace = `
      let existingFee, existingTa, existingStatus;
      if (otherIsSameName) {
         existingFee = (c.fee1 || 0) + (c.fee2 || 0);
         existingFee = existingFee === 0 ? '' : existingFee;
         existingTa = (c.ta1 || 0) + (c.ta2 || 0);
         existingTa = existingTa === 0 ? '' : existingTa;
         existingStatus = ((c.inv1_status || '').trim() === 'Paid' && (c.inv2_status || '').trim() === 'Paid') ? 'Paid' : 'Pending';
      } else {
         existingFee = role===1 ? c.fee1 : c.fee2;
         existingTa = role===1 ? c.ta1 : c.ta2;
         existingStatus = role===1 ? c.inv1_status : c.inv2_status;
      }
`;
code = code.replace(renderSearch, renderReplace);

// 3. Save Logic
const saveSearch = `
    let fields = {};
    if (holdsBothSlots) {
        fields = {
            fee1: fee, ta1: ta, inv1_status: paid ? 'Paid' : 'Pending',
            fee2: fee, ta2: ta, inv2_status: paid ? 'Paid' : 'Pending'
        };
    } else if (role === 1) {
`;
const saveReplace = `
    let fields = {};
    if (holdsBothSlots) {
        fields = {
            fee1: fee, ta1: ta, inv1_status: paid ? 'Paid' : 'Pending',
            fee2: 0, ta2: 0, inv2_status: paid ? 'Paid' : 'Pending'
        };
    } else if (role === 1) {
`;
code = code.replace(saveSearch, saveReplace);

fs.writeFileSync('app.js', code);
