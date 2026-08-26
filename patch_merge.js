const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<input type="text" id="merge-source-name" readonly>', '<select id="merge-source-name" onchange="updateMergeTargets()"></select>');
fs.writeFileSync('index.html', html);

let js = fs.readFileSync('app.js', 'utf8');
const oldMergeCode = `function openMergeInvestigator(name) {
  document.getElementById('merge-source-name').value = name;
  const targetSel = document.getElementById('merge-target-name');
  targetSel.innerHTML = getAllInvestigators().filter(n => n !== name).map(n => \`<option>\${n}</option>\`).join('');
  document.getElementById('merge-modal').classList.add('open');
}`;

const newMergeCode = `function updateMergeTargets() {
  const sourceName = document.getElementById('merge-source-name').value;
  const targetSel = document.getElementById('merge-target-name');
  targetSel.innerHTML = getAllInvestigators().filter(n => n !== sourceName).map(n => \`<option value="\${n}">\${n}</option>\`).join('');
}

function openMergeInvestigator(name) {
  const allInvs = getAllInvestigators();
  const sourceSel = document.getElementById('merge-source-name');
  sourceSel.innerHTML = allInvs.map(n => \`<option value="\${n}">\${n}</option>\`).join('');
  
  if (name && typeof name === 'string') {
    sourceSel.value = name;
  } else if (allInvs.length > 0) {
    sourceSel.selectedIndex = 0;
  }
  
  updateMergeTargets();
  document.getElementById('merge-modal').classList.add('open');
}`;

if (js.includes(oldMergeCode)) {
  js = js.replace(oldMergeCode, newMergeCode);
  fs.writeFileSync('app.js', js);
  console.log('Merge code patched successfully.');
} else {
  console.log('Failed to find old merge code in app.js');
}
