const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// The problematic snippet
const badSnippet = `  updateBulkDocSelectionCount();
  const tab = typeof currentDocTab !== 'undefined' ? currentDocTab : (this.id && this.id.includes('dispatch') ? 'dispatch' : 'receive');
  if (document.getElementById('bulkdoc-'+tab+'-paste') && document.getElementById('bulkdoc-'+tab+'-paste').value.trim() && !window.isAutoSelecting) {
    window.isAutoSelecting = true;
    autoSelectDocs(tab);
    window.isAutoSelecting = false;
  }
}`;

const originalSnippet = `  updateBulkDocSelectionCount();
}`;

// Replace all occurrences back to original
code = code.split(badSnippet).join(originalSnippet);

// Now apply it specifically to renderBulkDocReceive and renderBulkDocDispatch
const newSnippetReceive = `  updateBulkDocSelectionCount();
  if (document.getElementById('bulkdoc-receive-paste') && document.getElementById('bulkdoc-receive-paste').value.trim() && !window.isAutoSelecting) {
    window.isAutoSelecting = true;
    autoSelectDocs('receive');
    window.isAutoSelecting = false;
  }
}`;

const newSnippetDispatch = `  updateBulkDocSelectionCount();
  if (document.getElementById('bulkdoc-dispatch-paste') && document.getElementById('bulkdoc-dispatch-paste').value.trim() && !window.isAutoSelecting) {
    window.isAutoSelecting = true;
    autoSelectDocs('dispatch');
    window.isAutoSelecting = false;
  }
}`;

// find renderBulkDocReceive bounds
function patchFunc(funcName, patchSnippet) {
    const idx = code.indexOf('function ' + funcName);
    if (idx !== -1) {
        // find the end of the function.
        // It ends with updateBulkDocSelectionCount();\n}
        const endIdx = code.indexOf('updateBulkDocSelectionCount();\n}', idx);
        if (endIdx !== -1) {
            code = code.substring(0, endIdx) + patchSnippet + code.substring(endIdx + originalSnippet.length);
        }
    }
}

patchFunc('renderBulkDocReceive', newSnippetReceive);
patchFunc('renderBulkDocDispatch', newSnippetDispatch);

fs.writeFileSync('app.js', code);
console.log('Fixed syntax error');
