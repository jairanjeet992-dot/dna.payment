const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// The helper is called `escAttr` or `String(n)`, but I used `esc(n)` which doesn't exist.
// Let's replace `esc(n)` and `esc(c)` with just `escAttr()` since it does the same HTML escaping.
code = code.replace(/\$\{esc\(n\)\}/g, '${escAttr(n)}');
code = code.replace(/\$\{esc\(c\)\}/g, '${escAttr(c)}');

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('Fixed esc() reference error');
