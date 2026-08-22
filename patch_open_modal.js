const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Replace openModal('bulkdoc-modal') with document.getElementById('bulkdoc-modal').classList.add('open')
// since openModal is not a defined helper, but closeModal is defined as:
// function closeModal(id) { document.getElementById(id).classList.remove('open'); }

code = code.replace(/openModal\('bulkdoc-modal'\);/g, "document.getElementById('bulkdoc-modal').classList.add('open');");

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('Fixed openModal reference error');
