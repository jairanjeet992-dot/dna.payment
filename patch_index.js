const fs = require('fs');
const path = require('path');
const p = path.resolve('public', 'index.html');
let content = fs.readFileSync(p, 'utf8');

const patch = `
<script>
// Prevent html2canvas oklab/oklch crashes globally
(function() {
  window.applyHtml2CanvasPatch = function(win) {
    if (!win) return;
    try {
      if (!win.__h2c_patched && win.getComputedStyle) {
        win.__h2c_patched = true;
        const origGetComputedStyle = win.getComputedStyle;
        win.getComputedStyle = function(elt, pseudo) {
          const css = origGetComputedStyle.call(win, elt, pseudo);
          return new Proxy(css, {
            get: function(target, prop) {
              const val = target[prop];
              if (typeof val === 'string' && (val.includes('oklab') || val.includes('oklch') || val.includes('color('))) {
                return 'rgba(0,0,0,0)';
              }
              if (typeof val === 'function') {
                return val.bind(target);
              }
              return val;
            }
          });
        };
      }
      if (win.CSSStyleDeclaration && win.CSSStyleDeclaration.prototype && !win.CSSStyleDeclaration.prototype.__h2c_patched) {
        win.CSSStyleDeclaration.prototype.__h2c_patched = true;
        const origGetPropertyValue = win.CSSStyleDeclaration.prototype.getPropertyValue;
        win.CSSStyleDeclaration.prototype.getPropertyValue = function(prop) {
          let val = origGetPropertyValue.call(this, prop);
          if (val && typeof val === 'string' && (val.includes('oklab') || val.includes('oklch') || val.includes('color('))) {
            return 'rgba(0,0,0,0)';
          }
          return val;
        };
      }
    } catch(e) {}
  };
  window.applyHtml2CanvasPatch(window);
})();
</script>
`;

content = content.replace('</script><meta name="theme-color"', '</script>' + patch + '<meta name="theme-color"');
fs.writeFileSync(p, content);
