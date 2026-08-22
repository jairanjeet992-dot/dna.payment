const fs = require('fs');
const p = 'public/app.js';
let c = fs.readFileSync(p, 'utf8');

// Replace the container style in slipTemplatePremium
c = c.replace(
  "    <div style=\"font-family:'Segoe UI',Arial,sans-serif;padding:40px;max-width:760px;margin:0 auto;color:#1B2530;\">",
  "    <div style=\"font-family:'Segoe UI',Arial,sans-serif;padding:40px;width:794px;margin:0;box-sizing:border-box;color:#1B2530;background:#fff;\">"
);

// We should also fix slipTemplateDetailed and slipTemplateCompact if they exist
c = c.replace(
  /padding:40px;max-width:760px;margin:0 auto;/g,
  "padding:40px;width:794px;margin:0;box-sizing:border-box;background:#fff;"
);
c = c.replace(
  /max-width:760px;margin:0 auto;/g,
  "width:794px;margin:0;box-sizing:border-box;background:#fff;"
);

fs.writeFileSync(p, c);
console.log('Patched app.js');

const p2 = 'public/frontend/investigator-360/investigator-360.js';
let c2 = fs.readFileSync(p2, 'utf8');

c2 = c2.replace(
  "clone.style.maxWidth = '1000px';",
  "clone.style.width = '1000px';\n  clone.style.maxWidth = 'none';"
);

fs.writeFileSync(p2, c2);
console.log('Patched inv360');
