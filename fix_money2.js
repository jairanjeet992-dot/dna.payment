const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const missingFunction = `
function money(val) {
  if (val == null || val === '') return '0';
  const num = Number(val);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
`;

if (!code.includes('function money(val)')) {
  // inject it at the top of the finance logic block
  const target = "// FINANCE & TDS LEDGER";
  const idx = code.indexOf(target);
  if (idx !== -1) {
    code = code.substring(0, idx) + missingFunction + '\n' + code.substring(idx);
    fs.writeFileSync('app.js', code);
    console.log('Fixed money function in Finance block');
  } else {
    // just append it
    code += '\n' + missingFunction;
    fs.writeFileSync('app.js', code);
    console.log('Appended money function');
  }
}
