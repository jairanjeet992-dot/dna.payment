const fs = require('fs');
let code = fs.readFileSync('dna-bugfixes.js', 'utf8');

// The original logic inside app.js check for user role. We need to add logOwnershipTransfer back.
// Since it's in dna-bugfixes.js replacing injectStaffEdit, we'll patch it.

let targetStr = "window.injectStaffEdit=function(){if(role()==='senior'||role()==='junior')return original.apply(this,arguments)}}});})();";
if (code.includes(targetStr)) {
  console.log("Needs more manual patching");
}
