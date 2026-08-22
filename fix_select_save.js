const fs = require('fs');
let app = fs.readFileSync('public/app.js', 'utf8');

app = app.replace(
  /<select class="perm-select" data-group="\$\{group\.id\}" data-role="\$\{role\}" style="padding:4px; font-size:11px; border-radius:3px; border:1px solid var\(--line\);">/g,
  '<select class="perm-select" data-group="${group.id}" data-role="${role}" style="padding:4px; font-size:11px; border-radius:3px; border:1px solid var(--line);" onchange="saveSettings()">'
);

fs.writeFileSync('public/app.js', app, 'utf8');
console.log("Added onchange event.");
