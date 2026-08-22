const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Fix Login Form
html = html.replace(
  '<div class="login-body">',
  '<div class="login-body"><form onsubmit="doLogin(); return false;" style="margin:0;">'
);
html = html.replace(
  '<button class="login-btn" id="login-btn" onclick="doLogin()">Sign In</button>',
  '<button type="submit" class="login-btn" id="login-btn">Sign In</button>'
);
html = html.replace(
  'onkeydown="if(event.key===\'Enter\') doLogin()"',
  ''
);
html = html.replace(
  '<div class="login-hint" id="login-hint">Don\'t have an account yet? Ask your admin to create one for you.</div>\n    </div>',
  '<div class="login-hint" id="login-hint">Don\'t have an account yet? Ask your admin to create one for you.</div>\n    </form></div>'
);

// 2. Fix Case Modal Form
// We wrap from <div class="modal-body" ...> down to </div> before <div class="modal-foot">
// Wait, better to wrap modal-body and modal-foot together to include the submit button!
html = html.replace(
  '<div class="modal-body" style="max-height:70vh;overflow-y:auto;">',
  '<form id="case-form" onsubmit="saveCase(); return false;" style="margin:0; display:flex; flex-direction:column; max-height:100%;">\n    <div class="modal-body" style="max-height:70vh;overflow-y:auto;">'
);
html = html.replace(
  '<button class="btn btn-navy" onclick="saveCase()">Save Case</button>',
  '<button type="submit" class="btn btn-navy" id="case-save-btn">Save Case</button>'
);
// Now we need to close the form tag after modal-foot
html = html.replace(
  '<button type="submit" class="btn btn-navy" id="case-save-btn">Save Case</button>\n    </div>\n  </div>',
  '<button type="submit" class="btn btn-navy" id="case-save-btn">Save Case</button>\n    </div>\n    </form>\n  </div>'
);


// 3. Fix Add Investigator Form
html = html.replace(
  '<div class="modal-body" style="padding:20px;">',
  '<form onsubmit="saveNewInvestigator(); return false;" style="margin:0;">\n    <div class="modal-body" style="padding:20px;">'
);
html = html.replace(
  '<button class="btn btn-navy" onclick="saveNewInvestigator()">Add Investigator</button>',
  '<button type="submit" class="btn btn-navy">Add Investigator</button>'
);
html = html.replace(
  '<button type="submit" class="btn btn-navy">Add Investigator</button></div>\n  </div>',
  '<button type="submit" class="btn btn-navy">Add Investigator</button></div>\n    </form>\n  </div>'
);


// 4. Fix Dispatch Form
html = html.replace(
  '<div class="modal-body" style="padding:16px;">',
  '<form onsubmit="saveCaseDispatch(); return false;" style="margin:0;">\n    <div class="modal-body" style="padding:16px;">'
);
// Dispatch modal has save button? Let's check. 
// Wait, the dispatch modal might not have a generic save button, let's look at dispatch modal buttons.
