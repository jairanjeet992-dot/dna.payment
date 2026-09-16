const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Add Tab in Sidebar
const tabRegex = /<div class="tab" data-view="salary"/;
if (html.match(tabRegex)) {
  html = html.replace(tabRegex, `<div class="tab" data-view="finance" onclick="showView('finance',this)">Finance & TDS</div>\n    <div class="tab" data-view="salary"`);
}

// 2. Add View Container
const viewRegex = /<div id="view-salary" class="view">/;
const newView = `<div id="view-finance" class="view">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <h2 style="margin:0; font-family:Arial; font-weight:800; color:var(--navy);">TDS Receivable Ledger</h2>
      <select id="finance-fy-filter" class="fin" style="padding:6px 12px; border-radius:6px;" onchange="renderFinanceLedger()">
        <option value="ALL">All Financial Years</option>
      </select>
    </div>
    
    <div class="kpi-row" id="finance-kpi-row">
      <div class="kpi"><div class="kpi-label">Total Invoiced (Selected FY)</div><div class="kpi-value" id="fin-kpi-inv">Rs 0</div></div>
      <div class="kpi"><div class="kpi-label">Total Received</div><div class="kpi-value green" id="fin-kpi-rec">Rs 0</div></div>
      <div class="kpi"><div class="kpi-label">TDS Deducted (Receivable)</div><div class="kpi-value gold" id="fin-kpi-tds">Rs 0</div></div>
    </div>
    
    <div class="panel" style="margin-top:16px;">
      <div class="panel-head">
        <span class="panel-title">TDS Ledger by Company</span>
        <button class="btn btn-sm btn-ghost" onclick="exportTDSExcel()">📥 Export Excel</button>
      </div>
      <div class="tbl-scroll">
        <table class="data-table" style="width:100%;">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Financial Year</th>
              <th style="text-align:right;">Total Billed (Inv Amt)</th>
              <th style="text-align:right;">Total Received</th>
              <th style="text-align:right;">TDS Deducted</th>
              <th style="text-align:right;">Pending/Loss</th>
            </tr>
          </thead>
          <tbody id="finance-tds-tbody">
          </tbody>
        </table>
      </div>
    </div>
  </div>
  
  <div id="view-salary" class="view">`;

if (html.match(viewRegex)) {
  html = html.replace(viewRegex, newView);
}

fs.writeFileSync('index.html', html);
console.log('HTML patched for Finance & TDS');
