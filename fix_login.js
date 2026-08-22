const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

html = html.replace(
  '<div class="login-body"><form onsubmit="doLogin(); return false;" style="margin:0; display:flex; flex-direction:column; gap:16px;">\n      <div class="login-error" id="login-error"></div>\n      <div class="login-field"><label>Email</label><input type="email" id="login-email" placeholder="you@agency.com" autocomplete="username"></div>\n      <div class="login-field"><label>Password</label><input type="password" id="login-pass" placeholder="Enter password" autocomplete="current-password" onkeydown="if(event.key===\'Enter\') doLogin()"></div>\n      <button class="login-btn" id="login-btn" onclick="doLogin()">Sign In</button>\n      <div class="login-hint" id="login-hint">Don\'t have an account yet? Ask your admin to create one for you.</div>\n    </div>',
  `<div class="login-body">
      <form onsubmit="doLogin(); return false;" style="margin:0; display:flex; flex-direction:column; gap:16px;">
        <div class="login-error" id="login-error"></div>
        <div class="login-field"><label>Email</label><input type="email" id="login-email" placeholder="you@agency.com" autocomplete="username"></div>
        <div class="login-field"><label>Password</label><input type="password" id="login-pass" placeholder="Enter password" autocomplete="current-password"></div>
        <button type="submit" class="login-btn" id="login-btn">Sign In</button>
        <div class="login-hint" id="login-hint">Don't have an account yet? Ask your admin to create one for you.</div>
      </form>
    </div>`
);

fs.writeFileSync('public/index.html', html);
console.log("Login form patched.");
