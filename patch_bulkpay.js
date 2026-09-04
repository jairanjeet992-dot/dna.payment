const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// The saveBulkPayment function needs to check the actual case data to see 
// if the investigator holds BOTH slots, and if so, update BOTH slots.
const searchStr = `
    const fields = role===1
      ? { fee1: fee, ta1: ta, inv1_status: paid ? 'Paid' : 'Pending' }
      : { fee2: fee, ta2: ta, inv2_status: paid ? 'Paid' : 'Pending' };
`;

const replaceStr = `
    const cData = cases.find(x => x.doc_code === docCode);
    const holdsBothSlots = cData && cData.inv1 === name && cData.inv2 === name;
    
    let fields = {};
    if (holdsBothSlots) {
        fields = {
            fee1: fee, ta1: ta, inv1_status: paid ? 'Paid' : 'Pending',
            fee2: fee, ta2: ta, inv2_status: paid ? 'Paid' : 'Pending'
        };
    } else if (role === 1) {
        fields = { fee1: fee, ta1: ta, inv1_status: paid ? 'Paid' : 'Pending' };
    } else {
        fields = { fee2: fee, ta2: ta, inv2_status: paid ? 'Paid' : 'Pending' };
    }
`;

code = code.replace(searchStr, replaceStr);

fs.writeFileSync('app.js', code);
