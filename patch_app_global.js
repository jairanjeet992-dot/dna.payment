const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

if (!appJs.includes('window.markStatementPaid = markStatementPaid;')) {
  appJs += '\nwindow.markStatementPaid = markStatementPaid;\n';
  fs.writeFileSync('app.js', appJs);
  console.log('Exposed markStatementPaid to window globally.');
} else {
  console.log('markStatementPaid is already exposed.');
}
