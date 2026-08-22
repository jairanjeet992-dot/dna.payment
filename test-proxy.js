const proxyCode = `
    const origGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function(elt, pseudoElt) {
      const style = origGetComputedStyle(elt, pseudoElt);
      return new Proxy(style, {
        get: function(target, prop) {
          const val = target[prop];
          if (typeof val === 'string' && (val.includes('oklab') || val.includes('oklch') || val.includes('color('))) {
            return 'rgba(0,0,0,0)';
          }
          if (typeof val === 'function') {
            return function(...args) {
                let res = val.apply(target, args);
                if (typeof res === 'string' && (res.includes('oklab') || res.includes('oklch') || res.includes('color('))) {
                    return 'rgba(0,0,0,0)';
                }
                return res;
            }
          }
          return val;
        }
      });
    };
`;
console.log(proxyCode);
