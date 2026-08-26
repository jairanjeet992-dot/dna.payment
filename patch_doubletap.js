const fs = require('fs');
let js = fs.readFileSync('ux-enhancements.js', 'utf8');

const oldCode = `    // 6. Double Click to Edit
    document.addEventListener('dblclick', (e) => {
        const tr = e.target.closest('tr[data-idx]');
        if (tr) {
            // Prevent if clicked on a button, input, or link inside the row
            if (['BUTTON', 'INPUT', 'SELECT', 'A', 'TEXTAREA'].includes(e.target.tagName)) return;
            
            const idx = tr.getAttribute('data-idx');
            if (idx && typeof editCase === 'function') {
                editCase(idx);
            }
        }
    });`;

const newCode = `    // 6. Double Click / Double Tap to Edit
    const handleCaseEdit = (e) => {
        const tr = e.target.closest('tr[data-idx]');
        if (tr) {
            // Prevent if clicked on a button, input, or link inside the row
            if (['BUTTON', 'INPUT', 'SELECT', 'A', 'TEXTAREA'].includes(e.target.tagName)) return;
            
            const idx = tr.getAttribute('data-idx');
            if (idx && typeof editCase === 'function') {
                editCase(idx);
                e.preventDefault();
            }
        }
    };

    document.addEventListener('dblclick', handleCaseEdit);

    let lastTapTime = 0;
    document.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength > 0 && tapLength < 350) {
            // Double tap detected
            handleCaseEdit(e);
        }
        lastTapTime = currentTime;
    });`;

if (js.includes('6. Double Click to Edit')) {
  js = js.replace(oldCode, newCode);
  fs.writeFileSync('ux-enhancements.js', js);
  console.log('Patched ux-enhancements.js with double tap logic.');
} else {
  console.log('Could not find double click logic to patch.');
}
