const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const focusListener = `
// Debounced realtime render on focus lost
document.addEventListener('focusout', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
    setTimeout(() => {
      const isTyping = document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
      const activeModal = document.querySelector('.modal.open');
      if (!isTyping && !activeModal && window.__pendingRealtimeRender && typeof window.renderAll === 'function') {
        window.__pendingRealtimeRender = false;
        window.renderAll();
      }
    }, 100);
  }
});
`;

app += focusListener;
fs.writeFileSync('app.js', app);
