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
  // inject it early in the file, after function cleanNum
  const target = "function cleanNum(str) {";
  const idx = code.indexOf(target);
  if (idx !== -1) {
    code = code.substring(0, idx) + missingFunction + '\n' + code.substring(idx);
    fs.writeFileSync('app.js', code);
    console.log('Fixed money function');
  } else {
    console.log('Could not find cleanNum to inject money()');
  }
} else {
  console.log('money function already exists');
}
