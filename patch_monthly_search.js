const fs = require('fs');

// --- 1. Modify index.html ---
let html = fs.readFileSync('index.html', 'utf8');

const searchHtml = `
        <span class="panel-title" id="monthly-title">Monthly Report</span>
        <div style="position:relative; flex:1; max-width:280px; margin-left:16px;">
          <input type="text" id="monthly-smart-search" placeholder="Smart Search... (Ctrl+/)" 
                 class="fin" 
                 style="width:100%; border-radius:24px; padding:7px 14px 7px 34px; border:1px solid #ccc; background:#f9fafb; font-size:12px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.04); transition:all 0.2s;"
                 onkeyup="filterMonthlyInvestigators()"
                 onfocus="this.style.background='#fff'; this.style.borderColor='#B8862E'; this.style.boxShadow='0 0 0 3px rgba(184, 134, 46, 0.15)';"
                 onblur="this.style.background='#f9fafb'; this.style.borderColor='#ccc'; this.style.boxShadow='inset 0 1px 3px rgba(0,0,0,0.04)';">
          <span style="position:absolute; left:12px; top:8px; font-size:13px; opacity:0.6;">🔍</span>
        </div>
`;

html = html.replace(
  '<span class="panel-title" id="monthly-title">Monthly Report</span>',
  searchHtml
);

fs.writeFileSync('index.html', html);

// --- 2. Modify app.js ---
let js = fs.readFileSync('app.js', 'utf8');

const searchJs = `
// ============================================================
// SMART SEARCH: Monthly Tab
// ============================================================
window.filterMonthlyInvestigators = function() {
  const input = document.getElementById('monthly-smart-search');
  if (!input) return;
  const query = input.value.toLowerCase().trim();
  const rows = document.querySelectorAll('#monthly-tbody tr');
  
  rows.forEach(row => {
    // Don't filter empty state row
    if (row.querySelector('.empty-state')) return;
    
    // Check investigator name in the first column
    const name = row.cells[0] ? row.cells[0].textContent.toLowerCase() : '';
    if (name.includes(query) || !query) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
};

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
    const searchBox = document.getElementById('monthly-smart-search');
    // only focus if it's visible on screen (meaning we are on the monthly tab)
    if (searchBox && searchBox.offsetParent !== null) {
      e.preventDefault();
      searchBox.focus();
    }
  }
});
`;

if (!js.includes('filterMonthlyInvestigators')) {
    js += '\n' + searchJs;
    fs.writeFileSync('app.js', js);
}

