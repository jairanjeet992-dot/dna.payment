const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(
  /c\.inv1_status==='Paid'/g,
  "(c.inv1_status || '').trim() === 'Paid'"
).replace(
  /c\.inv2_status==='Paid'/g,
  "(c.inv2_status || '').trim() === 'Paid'"
).replace(
  /c\.inv1_status === 'Paid'/g,
  "(c.inv1_status || '').trim() === 'Paid'"
).replace(
  /c\.inv2_status === 'Paid'/g,
  "(c.inv2_status || '').trim() === 'Paid'"
);

fs.writeFileSync('app.js', code);
