const fs = require('fs');
const p = 'public/frontend/investigator-360/investigator-360.js';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "clone.style.webkitBackdropFilter = 'none';",
  "clone.style.webkitBackdropFilter = 'none';\n  clone.style.height = 'auto';\n  clone.style.overflow = 'visible';"
);

fs.writeFileSync(p, c);
console.log('Patched inv360 height/overflow');
