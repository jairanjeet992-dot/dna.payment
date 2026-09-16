const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// The faulty line:
// const invAmt = Number(c.invoice_amount) || Number(c.total_payable) || 0;
// We need to change it to:
// const invAmt = Number(c.invoice_amount) || 0;

if (code.includes('const invAmt = Number(c.invoice_amount) || Number(c.total_payable) || 0;')) {
    code = code.replace(
        'const invAmt = Number(c.invoice_amount) || Number(c.total_payable) || 0;',
        'const invAmt = Number(c.invoice_amount) || 0;'
    );
    fs.writeFileSync('app.js', code);
    console.log('Fixed invAmt calculation');
} else {
    console.log('Could not find the exact line');
}
