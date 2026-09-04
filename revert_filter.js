const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const searchRender = `
  rows = rows.filter(c => {
    if (statusFilter === 'all') return true;
    
    // Unpaid/Pending filter logic
    if (c.inv1 === name && c.inv2 === name) {
        // If holding both slots, consider it unpaid if EITHER slot is not Paid
        return (c.inv1_status || '').trim() !== 'Paid' || (c.inv2_status || '').trim() !== 'Paid';
    } else if (c.inv1 === name) {
        return (c.inv1_status || '').trim() !== 'Paid';
    } else {
        return (c.inv2_status || '').trim() !== 'Paid';
    }
  });
`;

const replaceRender = `
  rows = rows.filter(c => {
    const role = c.inv1===name ? 1 : 2;
    const st = role===1 ? c.inv1_status : c.inv2_status;
    return statusFilter==='all' ? true : st !== 'Paid';
  });
`;

code = code.replace(searchRender, replaceRender);

fs.writeFileSync('app.js', code);
