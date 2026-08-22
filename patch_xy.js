const fs = require('fs');
const p = 'public/app.js';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "scrollY: 0, scrollX: 0",
  "scrollY: 0, scrollX: 0, x: 0, y: 0"
);
c = c.replace(
  "scrollY: 0, scrollX: 0",
  "scrollY: 0, scrollX: 0, x: 0, y: 0"
);

fs.writeFileSync(p, c);
console.log('Patched x/y in app.js');

const p2 = 'public/frontend/investigator-360/investigator-360.js';
let c2 = fs.readFileSync(p2, 'utf8');

c2 = c2.replace(
  "scrollY: 0, scrollX: 0",
  "scrollY: 0, scrollX: 0, x: 0, y: 0"
);
c2 = c2.replace(
  "scrollY: 0, scrollX: 0",
  "scrollY: 0, scrollX: 0, x: 0, y: 0"
);

fs.writeFileSync(p2, c2);
console.log('Patched x/y in inv360');
