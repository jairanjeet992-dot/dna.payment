const fs = require('fs');
let content = fs.readFileSync('realtime-sync.js', 'utf8');

content = content.replace(
  `        window.__realtimeRenderDebounceTimer = setTimeout(() => {
          const activeModal = document.querySelector('.modal.open');
          const isTyping = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA');
          if (activeModal || isTyping) {
            return;
          }
          if (typeof window.renderAll === 'function') {
            window.renderAll();
          }
        }, 300);`,
  `        window.__realtimeRenderDebounceTimer = setTimeout(() => {
          const activeModal = document.querySelector('.modal.open');
          const isTyping = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA');
          if (activeModal || isTyping) {
            window.__pendingRealtimeRender = true;
            return;
          }
          if (typeof window.renderAll === 'function') {
            window.renderAll();
          }
        }, 300);`
);

fs.writeFileSync('realtime-sync.js', content);
