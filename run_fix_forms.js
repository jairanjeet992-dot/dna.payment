const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Fix Login Form
html = html.replace(
  '<div class="login-body">',
  '<div class="login-body"><form onsubmit="doLogin(); return false;" style="margin:0; display:flex; flex-direction:column; gap:16px;">'
);
// In login body, there's no gap on login-body, it's just block elements. 
// Let's replace the whole block carefully.
html = html.replace(
  '<div class="login-body">\n      <div class="login-error" id="login-error"></div>\n      <div class="login-field"><label>Email</label><input type="email" id="login-email" placeholder="you@agency.com" autocomplete="username"></div>\n      <div class="login-field"><label>Password</label><input type="password" id="login-pass" placeholder="Enter password" autocomplete="current-password" onkeydown="if(event.key===\'Enter\') doLogin()"></div>\n      <button class="login-btn" id="login-btn" onclick="doLogin()">Sign In</button>\n      <div class="login-hint" id="login-hint">Don\'t have an account yet? Ask your admin to create one for you.</div>\n    </div>',
  `<div class="login-body">
      <form onsubmit="doLogin(); return false;" style="margin:0;">
        <div class="login-error" id="login-error"></div>
        <div class="login-field"><label>Email</label><input type="email" id="login-email" placeholder="you@agency.com" autocomplete="username"></div>
        <div class="login-field"><label>Password</label><input type="password" id="login-pass" placeholder="Enter password" autocomplete="current-password"></div>
        <button type="submit" class="login-btn" id="login-btn">Sign In</button>
        <div class="login-hint" id="login-hint">Don't have an account yet? Ask your admin to create one for you.</div>
      </form>
    </div>`
);


// 2. Fix Case Modal Form
// <div class="modal-body" style="max-height:70vh;overflow-y:auto;"> -> add <form> around it.
html = html.replace(
  '<div class="modal-body" style="max-height:70vh;overflow-y:auto;">',
  '<form id="case-form" onsubmit="saveCase(); return false;" style="margin:0; display:flex; flex-direction:column; max-height:85vh;">\n    <div class="modal-body" style="max-height:70vh;overflow-y:auto;">'
);
html = html.replace(
  '<button class="btn btn-navy" onclick="saveCase()">Save Case</button>',
  '<button type="submit" class="btn btn-navy" id="case-save-btn">Save Case</button>'
);
// Close form after modal-foot
html = html.replace(
  '<button type="submit" class="btn btn-navy" id="case-save-btn">Save Case</button>\n    </div>\n  </div>\n</div>\n\n<!-- CASE DISPATCH MODAL',
  '<button type="submit" class="btn btn-navy" id="case-save-btn">Save Case</button>\n    </div>\n    </form>\n  </div>\n</div>\n\n<!-- CASE DISPATCH MODAL'
);


// 3. Fix Add Investigator Modal Form
html = html.replace(
  '<div class="modal-body" style="padding:20px;">\n      <div class="fg" style="margin-bottom:12px;"><label>Investigator Name *</label><input type="text" id="new-inv-name" placeholder="e.g. AMIT KUMAR"></div>',
  '<form onsubmit="saveNewInvestigator(); return false;" style="margin:0;">\n    <div class="modal-body" style="padding:20px;">\n      <div class="fg" style="margin-bottom:12px;"><label>Investigator Name *</label><input type="text" id="new-inv-name" placeholder="e.g. AMIT KUMAR"></div>'
);
html = html.replace(
  '<button class="btn btn-navy" onclick="saveNewInvestigator()">Add Investigator</button>',
  '<button type="submit" class="btn btn-navy">Add Investigator</button>'
);
html = html.replace(
  '<button type="submit" class="btn btn-navy">Add Investigator</button></div>\n  </div>\n</div>\n\n<!-- BULK PAYMENT MODAL',
  '<button type="submit" class="btn btn-navy">Add Investigator</button></div>\n    </form>\n  </div>\n</div>\n\n<!-- BULK PAYMENT MODAL'
);

fs.writeFileSync('public/index.html', html);
console.log("Forms patched.");
