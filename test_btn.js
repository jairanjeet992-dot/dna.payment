const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<button class="btn" style="background:var\(--green\);color:#fff;" onclick="markStatementPaid\(\)">✅ Mark Statement as Paid<\/button>/, 
'<button class="btn" style="background:var(--green);color:#fff;" type="button" onclick="window.markStatementPaid()">✅ Mark Statement as Paid</button>');
fs.writeFileSync('index.html', html);
