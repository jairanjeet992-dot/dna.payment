const fs = require('fs');

// 1. Remove Firebase scripts from index.html
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[\s\S]*?firebase-init\.js"><\/script>\n?/g, '');
// Clean up Drive scripts too as you requested text and google drive only via supabase?
// Wait, the user said: "mujhe sab data supabase me chaiye text or Google drive se fairebase ke trow"
// Actually user said: "Front-endme koi data save to nhi ho rha h mujhe sab data supabase me chaiye text or Google drive se fairebase ke trow"
// This means "Is any data saving in frontend? I want all data in Supabase (text) and Google Drive via Firebase?"
// Let me hold on this and read carefully.
