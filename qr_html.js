const fs = require('fs');
const idx = fs.readFileSync('index.html', 'utf8');

const matches = [...idx.matchAll(/<div id="qr-tab-bulk"[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/g)];
// we'll just grep the quick receive tab bulk section
