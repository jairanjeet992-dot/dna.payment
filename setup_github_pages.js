const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Update server.js
let serverJs = fs.readFileSync('server.js', 'utf8');
serverJs = serverJs.replace(
  "app.use(express.static(path.join(__dirname, 'public')));",
  "app.use(express.static(__dirname));"
);
fs.writeFileSync('server.js', serverJs);
console.log("Updated server.js");

// 2. Move files from public to root
// Actually it's easier to use shell commands for moving
