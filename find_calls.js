const fs = require('fs');
const code = fs.readFileSync('public/app.js', 'utf8');

const regex = /([a-zA-Z0-9_$]+)\s*\(/g;
let match;
const calls = new Set();
while ((match = regex.exec(code)) !== null) {
  calls.add(match[1]);
}

const defined = new Set();
const defRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(/g;
while ((match = defRegex.exec(code)) !== null) {
  defined.add(match[1]);
}

// Add standard ones
const std = ['console', 'document', 'window', 'Math', 'Date', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Promise', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'alert', 'confirm', 'btoa', 'atob', 'encodeURIComponent', 'parseFloat', 'parseInt', 'JSON', 'require', 'isNaN', 'require', 'map', 'forEach', 'filter', 'reduce', 'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'join', 'split', 'replace', 'trim', 'toLowerCase', 'toUpperCase', 'includes', 'indexOf', 'lastIndexOf', 'substring', 'substr', 'match', 'test', 'exec', 'add', 'remove', 'toggle', 'contains', 'getElementById', 'createElement', 'appendChild', 'removeChild', 'insertBefore', 'replaceChild', 'cloneNode', 'querySelector', 'querySelectorAll', 'addEventListener', 'removeEventListener', 'dispatchEvent', 'sort', 'find', 'findIndex', 'some', 'every', 'keys', 'values', 'entries', 'assign', 'charCodeAt', 'fromCharCode', 'then', 'catch', 'finally', 'resolve', 'reject', 'all', 'race'];

const missing = [];
for (const call of calls) {
  if (!defined.has(call) && !std.includes(call)) {
    missing.push(call);
  }
}
console.log(missing);
