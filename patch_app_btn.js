const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');
js = js.replace(/window\.markStatementPaid = markStatementPaid;/g, '');
js += '\nwindow.markStatementPaid = markStatementPaid;\n';
fs.writeFileSync('app.js', js);
