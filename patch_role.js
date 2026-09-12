const fs = require('fs');
let content = fs.readFileSync('role-permissions.js', 'utf8');

content = content.replace(
  `const key=String(c.company).trim().toUpperCase()+'|'+String(c.claim_no).trim();if(claims.has(key))throw new Error(\`Duplicate company + claim in backup: \${c.company} / \${c.claim_no}\`);claims.add(key)`,
  ``
);

fs.writeFileSync('role-permissions.js', content);
console.log('Patched role-permissions.js');
