const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Find the saveCase function where we gather caseFields
// Add logic right before caseFields object creation
const searchStr = "const caseFields = {";
const replacementStr = `
  // Auto-sync INV2 status if INV1 and INV2 are the same person
  let finalInv2Status = document.getElementById('f-inv2status').value;
  let finalHc2Status = document.getElementById('f-hardcopy2status').value;
  
  if (inv1 && inv1 === document.getElementById('f-inv2').value) {
    finalInv2Status = inv1_status;
    finalHc2Status = hardcopy1_status;
  }

  const caseFields = {`;

code = code.replace(searchStr, replacementStr);

// Then replace the assignments in caseFields
code = code.replace(
  "inv2_status: document.getElementById('f-inv2status').value,",
  "inv2_status: finalInv2Status,"
);
code = code.replace(
  "hardcopy2_status: document.getElementById('f-hardcopy2status').value,",
  "hardcopy2_status: finalHc2Status,"
);

fs.writeFileSync('app.js', code);
