const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace(
  `function closeModal(id) { document.getElementById(id).classList.remove('open'); }`,
  `function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (window.__pendingRealtimeRender && typeof window.renderAll === 'function' && !document.querySelector('.modal.open')) {
    window.__pendingRealtimeRender = false;
    window.renderAll();
  }
}`
);

fs.writeFileSync('app.js', app);
