const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

appJs = appJs.replace(
  "const expensesToUpdate = window.investigatorExpenses.filter(e => {",
  "const expensesToUpdate = (window.investigatorExpenses || []).filter(e => {"
);

fs.writeFileSync('app.js', appJs);
console.log('Fixed window.investigatorExpenses check.');
