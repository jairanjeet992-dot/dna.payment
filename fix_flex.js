const fs = require('fs');
let app = fs.readFileSync('public/app.js', 'utf8');
app = app.replace(
  /if \(fg\) fg\.style\.display = 'block';/g,
  "if (fg) fg.style.display = 'flex';"
);
fs.writeFileSync('public/app.js', app, 'utf8');
