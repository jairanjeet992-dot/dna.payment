const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. In saveCase
const saveSearch = "const caseFields = {";
const saveReplace = `
  // Auto-sync INV2 status if INV1 and INV2 are the same person
  let finalInv2Status = document.getElementById('f-inv2status').value;
  let finalHc2Status = document.getElementById('f-hardcopy2status').value;
  
  if (inv1 && inv1 !== 'NA' && inv1 === document.getElementById('f-inv2').value) {
    finalInv2Status = document.getElementById('f-inv1status').value;
    finalHc2Status = document.getElementById('f-hardcopy1status').value;
  }

  const caseFields = {`;

code = code.replace(saveSearch, saveReplace);
code = code.replace(
  "inv2_status: document.getElementById('f-inv2status').value,",
  "inv2_status: finalInv2Status,"
);
code = code.replace(
  "hardcopy2_status: document.getElementById('f-hardcopy2status').value,",
  "hardcopy2_status: finalHc2Status,"
);


// 2. In commitImportPreview
const importSearch = "const inv1 = resolveName(r.inv1), inv2 = resolveName(r.inv2);";
const importReplace = `const inv1 = resolveName(r.inv1), inv2 = resolveName(r.inv2);
      
      let finalInv2Status = r.inv2_status;
      if (inv1 && inv1 !== 'NA' && inv1 === inv2) {
         finalInv2Status = r.inv1_status;
      }
`;

code = code.replace(importSearch, importReplace);
code = code.replace(
  "inv1_status: r.inv1_status, inv2_status: r.inv2_status, remarks: r.remarks,",
  "inv1_status: r.inv1_status, inv2_status: finalInv2Status, remarks: r.remarks,"
);

fs.writeFileSync('app.js', code);
