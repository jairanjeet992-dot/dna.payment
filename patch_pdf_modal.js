const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const regex = /<div id="pdf-preview-modal".*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/s;
const replacement = `<div id="pdf-preview-modal" class="modal-overlay" style="display:none; z-index: 10000; background: rgba(4,13,26,0.95); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); position: fixed; top: 0; left: 0; width: 100%; height: 100%; align-items: center; justify-content: center;">
    <div class="print-preview-shell" style="width: 95%; max-width: 1000px; height: 95vh; display: flex; flex-direction: column; overflow: hidden; padding: 0; border: 1px solid var(--cmd-glass-border, rgba(0,229,255,0.15)); border-radius: 20px; box-shadow: 0 12px 48px rgba(0,229,255,0.1); background: var(--cmd-navy-panel, rgba(10,25,47,0.65));">
      
      <div class="pdf-toolbar" style="padding: 16px 24px; background: rgba(4,13,26,0.9); border-bottom: 1px solid var(--cmd-glass-border, rgba(0,229,255,0.15)); display: flex; justify-content: space-between; align-items: center; z-index: 2;">
        <div>
          <div class="pdf-toolbar-title" style="color: var(--cmd-cyan, #00E5FF); font-weight: 700; font-size: 15px; letter-spacing: 1px; text-transform: uppercase;">DOCUMENT PREVIEW</div>
          <div id="pdf-preview-filename" class="pdf-toolbar-meta" style="color: var(--cmd-text-sub, #8892B0); font-size: 12px; margin-top: 4px;">preview.pdf</div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <button class="btn btn-gold btn-sm" id="pdf-download-btn" style="background: var(--cmd-gold); color: #000; box-shadow: 0 0 15px var(--cmd-gold-dim); font-weight: 600; padding: 8px 16px;">💾 Download PDF</button>
          <button class="btn btn-ghost btn-sm" onclick="closePDFPreview()" style="font-size: 20px; color: var(--cmd-text-sub); background: transparent; border: none; padding: 4px 8px; cursor: pointer;">✕</button>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; padding: 40px 20px; background: #2a2a2a; display: flex; justify-content: center; position: relative;">
        <!-- Subtle shadow under the paper -->
        <div id="pdf-preview-content" class="print-preview-paper" style="width: 100%; max-width: 800px; background: #fff; color: #000; padding: 0; box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1); min-height: 1000px; position: relative; z-index: 1;">
          <!-- Content injected here -->
        </div>
      </div>
    </div>
  </div>`;

if (html.match(regex)) {
  html = html.replace(regex, replacement);
  fs.writeFileSync('public/index.html', html, 'utf8');
  console.log('Patched modal successfully');
} else {
  console.log('Regex did not match');
}
