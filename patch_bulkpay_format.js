const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const searchHeader = `<th>Doc Code</th><th>Date</th><th>Claim No</th><th>Insured</th><th>Role</th><th>Fee (₹)</th><th>TA (₹)</th><th>Mark Paid</th>`;
const replaceHeader = `<th>Company</th><th>Date</th><th>Claim No</th><th>Insured</th><th>Role</th><th>Fee (₹)</th><th>TA (₹)</th><th>Mark Paid</th>`;
code = code.replace(searchHeader, replaceHeader);

const searchRow = `      html += \`<tr data-doccode="\${c.doc_code||''}" data-role="\${role}" data-salary="\${isActuallySalary}">
        <td class="mono">\${c.doc_code||''}</td>
        <td>\${c.date||''}</td>
        <td class="mono">\${c.claim_no||''}</td>
        <td>\${c.insured_name||''}</td>`;

const replaceRow = `      html += \`<tr data-doccode="\${c.doc_code||''}" data-role="\${role}" data-salary="\${isActuallySalary}">
        <td>\${c.company||''}</td>
        <td>\${c.date||''}</td>
        <td class="mono">\${c.claim_no||''}</td>
        <td>\${c.insured_name||''}</td>`;

code = code.replace(searchRow, replaceRow);

fs.writeFileSync('app.js', code);
