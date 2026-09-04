const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Revert auto-sync logic
const searchStr = `
  // Auto-sync INV2 status if INV1 and INV2 are the same person
  let finalInv2Status = document.getElementById('f-inv2status').value;
  let finalHc2Status = document.getElementById('f-hardcopy2status').value;
  
  if (inv1 && inv1 === document.getElementById('f-inv2').value) {
    finalInv2Status = inv1_status;
    finalHc2Status = hardcopy1_status;
  }

  const caseFields = {`;
const replacementStr = "const caseFields = {";

code = code.replace(searchStr, replacementStr);

code = code.replace(
  "inv2_status: finalInv2Status,",
  "inv2_status: document.getElementById('f-inv2status').value,"
);
code = code.replace(
  "hardcopy2_status: finalHc2Status,",
  "hardcopy2_status: document.getElementById('f-hardcopy2status').value,"
);

fs.writeFileSync('app.js', code);
