const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// Ensure the print-preview-paper container is strictly 794px wide (A4 size) 
// and the parent handles scrolling, so html2pdf ALWAYS captures desktop proportions.
const regex = /<div id="pdf-preview-content" class="print-preview-paper" style="[^"]*">/s;
const replacement = `<div id="pdf-preview-content" class="print-preview-paper" style="width: 794px; min-width: 794px; background: #fff; color: #000; padding: 0; box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1); min-height: 1123px; position: relative; z-index: 1; margin: 0 auto; box-sizing: border-box;">`;

if (html.match(regex)) {
  html = html.replace(regex, replacement);
  fs.writeFileSync('public/index.html', html, 'utf8');
  console.log('Fixed PDF container size');
} else {
  console.log('Regex did not match');
}
