const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const permPanel = `
      <div class="panel admin-only" style="padding:18px; margin-top:14px;">
        <div class="panel-title" style="margin-bottom:6px;">🛠️ Advanced Field Permissions</div>
        <p style="font-size:11.5px;color:var(--sub);margin-bottom:14px;line-height:1.5;">Control which user roles can Edit, Read, or are Hidden from specific case form fields. These rules apply instantly.</p>
        <div class="tbl-scroll" style="border: 1px solid var(--line); border-radius:4px; max-height:400px; overflow-y:auto;">
          <table class="data-table" id="permissions-matrix" style="width:100%; font-size:12px; margin:0;">
            <thead style="position:sticky; top:0; z-index:2;">
              <tr>
                <th style="background:#f8f9fa;">Field Group</th>
                <th style="background:#f8f9fa; text-align:center;">Senior</th>
                <th style="background:#f8f9fa; text-align:center;">Junior</th>
                <th style="background:#f8f9fa; text-align:center;">Accounts</th>
                <th style="background:#f8f9fa; text-align:center;">Company</th>
              </tr>
            </thead>
            <tbody>
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      </div>
`;

html = html.replace(
  /<div class="panel" style="padding:18px;">\s*<div class="panel-title" style="margin-bottom:14px;">☁️ Data & Sync<\/div>/,
  permPanel + '\n      <div class="panel" style="padding:18px;">\n        <div class="panel-title" style="margin-bottom:14px;">☁️ Data & Sync</div>'
);

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Patched Settings HTML');
