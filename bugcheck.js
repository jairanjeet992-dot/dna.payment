const fs = require('fs');

const appJs = fs.readFileSync('app.js', 'utf8');
const crJs = fs.readFileSync('company-recovery.js', 'utf8');

// Check Outstanding Logic
let hasNegativeTotalPayable = crJs.includes('Math.max(0,'); 
let outstandingFormula = crJs.match(/billed\s*-\s*\(?recv\s*\+\s*tds\)?/gi);

console.log("--- OUTSTANDING FORMULA ---");
console.log(outstandingFormula);

console.log("\n--- HARDCOPY LOGIC ---");
const hardcopyRenders = appJs.match(/hardcopy1_status.*?(?:{|`|')/g);
console.log(hardcopyRenders ? hardcopyRenders.length + " places rendering hardcopy status." : "0 places");

