const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('public/app.js', 'utf8');
let ast;
try {
  ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
} catch (e) {
  console.error("Parse error:", e);
  process.exit(1);
}

const globals = new Set([
  'window', 'document', 'console', 'sessionStorage', 'localStorage', 'setTimeout', 'clearTimeout', 
  'setInterval', 'clearInterval', 'alert', 'confirm', 'fetch', 'Date', 'Math', 'Promise', 'Object',
  'String', 'Number', 'Boolean', 'Array', 'Error', 'navigator', 'google', 'FormData', 'Blob', 'URL', 'Event',
  'location', 'btoa', 'atob', 'URLSearchParams', 'IntersectionObserver', 'MutationObserver', 'HTMLElement',
  'Intl', 'sessionStorage', 'process'
]);

// Actually writing a full scope analyzer in a tiny script is hard because of functions, blocks, etc.
// A simpler way: we just want to know if there's any obvious missing function.
console.log("Parsed successfully.");
