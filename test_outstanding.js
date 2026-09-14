const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

function checkFunction(namePattern) {
    const fnRegex = new RegExp(`function\\s+${namePattern}\\s*\\([^{]*\\)\\s*\\{`, 'i');
    const match = appJs.match(fnRegex);
    if(match) {
        console.log(`Found function: ${match[0]}`);
    } else {
        console.log(`Function not found: ${namePattern}`);
    }
}
checkFunction('renderDashboard');
checkFunction('calculateCasePayableAndProfit');
checkFunction('updateCompanyRecoveryTable');
checkFunction('openCompanyRecoveryModal');
