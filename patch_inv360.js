const fs = require('fs');

let js = fs.readFileSync('frontend/investigator-360/investigator-360.js', 'utf8');
const oldButtonHtml = `\${admin()?\`<button class="btn btn-gold" style="height:38px;padding:0 16px;white-space:nowrap;font-weight:750" onclick="window.openAddInvestigator()">+ Add Investigator</button>\`:''}`;
const newButtonHtml = `\${admin()?\`<button class="btn btn-navy" style="height:38px;padding:0 16px;white-space:nowrap;font-weight:750" onclick="window.openScorecard()">📊 Scorecard</button><button class="btn btn-danger" style="height:38px;padding:0 16px;white-space:nowrap;font-weight:750" onclick="window.openMergeInvestigator()">🔗 Merge</button><button class="btn btn-gold" style="height:38px;padding:0 16px;white-space:nowrap;font-weight:750" onclick="window.openAddInvestigator()">+ Add</button>\`:''}`;

if (js.includes(oldButtonHtml)) {
  js = js.replace(oldButtonHtml, newButtonHtml);
  fs.writeFileSync('frontend/investigator-360/investigator-360.js', js);
  console.log('investigator-360.js patched successfully.');
} else {
  console.log('Failed to find old button HTML in investigator-360.js');
}

let html = fs.readFileSync('index.html', 'utf8');
const htmlToRemoveRegex = /<div class="panel-head" style="background:#fff;border-radius:4px;margin-bottom:12px;box-shadow:0 1px 3px rgba\(0,0,0,0\.06\);">[\s\S]*?<div class="inv-grid" id="inv-grid"><\/div>/m;
if (html.match(htmlToRemoveRegex)) {
  html = html.replace(htmlToRemoveRegex, '');
  fs.writeFileSync('index.html', html);
  console.log('index.html legacy UI removed successfully.');
} else {
  console.log('Failed to find legacy UI in index.html');
}

let appJs = fs.readFileSync('app.js', 'utf8');
const executeFilterInvestigatorsFunc = /function executeFilterInvestigators\(\) \{[\s\S]*?\}\n/m;
if (appJs.match(executeFilterInvestigatorsFunc)) {
  appJs = appJs.replace(executeFilterInvestigatorsFunc, `function executeFilterInvestigators() { 
  // Function logic removed, handled by new investigator 360 UI. 
  // Empty stub to prevent errors from other parts of the code.
}\n`);
  fs.writeFileSync('app.js', appJs);
  console.log('app.js executeFilterInvestigators stubbed.');
} else {
    console.log('Could not find executeFilterInvestigators in app.js');
}

