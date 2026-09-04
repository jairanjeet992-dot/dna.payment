const fs = require('fs');
let code = fs.readFileSync('db_scripts/master_setup.sql', 'utf8');

code = code.replace(
  /COALESCE\(c\.inv1_status,''\) = 'Paid'/g,
  "TRIM(COALESCE(c.inv1_status,'')) = 'Paid'"
).replace(
  /COALESCE\(c\.inv2_status,''\) = 'Paid'/g,
  "TRIM(COALESCE(c.inv2_status,'')) = 'Paid'"
);

fs.writeFileSync('db_scripts/master_setup.sql', code);
