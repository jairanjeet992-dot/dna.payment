const fs = require('fs');

// Patch index.html
let html = fs.readFileSync('index.html', 'utf8');
const searchHtml = `<th>Doc Code</th><th>Date</th><th>Company</th><th>Claim No</th><th>Insured</th><th>Investigator(s)</th><th>Hard Copy</th>`;
const replaceHtml = `<th>Doc Code</th><th>Date</th><th>Company</th><th>Claim Type</th><th>Claim No</th><th>Insured</th><th>Investigator(s)</th><th>Hard Copy</th>`;
html = html.replace(searchHtml, replaceHtml);
fs.writeFileSync('index.html', html);

// Patch app.js
let app = fs.readFileSync('app.js', 'utf8');
const searchJs = `<td>\${c.date||''}</td><td>\${c.company||''}</td><td class="mono">\${c.claim_no||''}</td><td>\${c.insured_name||''}</td>`;
const replaceJs = `<td>\${c.date||''}</td><td>\${c.company||''}</td><td>\${c.case_type||''}</td><td class="mono">\${c.claim_no||''}</td><td>\${c.insured_name||''}</td>`;
app = app.replace(searchJs, replaceJs);

// Also patch colspan="7" to colspan="8" in that exact row
const searchColspan = `</tr>\`).join('') || '<tr><td colspan="7"><div class="empty-state">No documents yet</div></td></tr>';`;
const replaceColspan = `</tr>\`).join('') || '<tr><td colspan="8"><div class="empty-state">No documents yet</div></td></tr>';`;
app = app.replace(searchColspan, replaceColspan);

fs.writeFileSync('app.js', app);
