const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Replace buildReportHTML
let newReportHtml = `function buildReportHTML(title, summaryLines, rows) {
  const s = settings;
  return \`
    <div style="font-family:'Segoe UI',Arial,sans-serif;padding:50px;background:#fff;color:#1B2530;line-height:1.5;">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #0F2942;padding-bottom:20px;margin-bottom:30px;">
        <div style="display:flex;align-items:center;gap:20px;">
          \${s.logo ? \`<img src="\${s.logo}" style="height:70px;">\` : ''}
          <div>
            <div style="font-size:24px;font-weight:800;color:#0F2942;letter-spacing:0.5px;">\${s.agencyName}</div>
            <div style="font-size:12px;color:#657486;margin-top:4px;">\${s.agencyAddress||''}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#657486;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Report Statement</div>
          <div style="font-size:13px;font-weight:600;color:#0F2942;margin-top:6px;">\${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
      </div>
      
      <div style="margin-bottom:24px;">
        <h2 style="color:#0F2942;font-size:18px;margin:0 0 8px 0;font-weight:700;letter-spacing:0.3px;">\${title}</h2>
        <div style="font-size:13px;color:#555;font-weight:500;">\${summaryLines.join(' <span style="color:#ccc;margin:0 8px;">|</span> ')}</div>
      </div>
      
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#0F2942;color:#fff;border-radius:4px;">
            <th style="padding:10px;text-align:left;font-weight:600;border-top-left-radius:6px;">Doc Code</th>
            <th style="padding:10px;text-align:left;font-weight:600;">Date</th>
            <th style="padding:10px;text-align:left;font-weight:600;">Claim No</th>
            <th style="padding:10px;text-align:left;font-weight:600;">Insured</th>
            <th style="padding:10px;text-align:left;font-weight:600;">INV1</th>
            <th style="padding:10px;text-align:left;font-weight:600;">INV2</th>
            <th style="padding:10px;text-align:right;font-weight:600;">Payable</th>
            <th style="padding:10px;text-align:right;font-weight:600;border-top-right-radius:6px;">Received</th>
          </tr>
        </thead>
        <tbody>
          \${rows.map((c, i) => \`<tr style="border-bottom:1px solid #eee;background:\${i%2===0?'#fff':'#fcfcfc'};">
            <td style="padding:10px;color:#657486;font-family:monospace;font-size:10px;">\${c.doc_code||''}</td>
            <td style="padding:10px;font-weight:500;">\${c.date||''}</td>
            <td style="padding:10px;">\${c.claim_no||''}</td>
            <td style="padding:10px;">\${c.insured_name||''}</td>
            <td style="padding:10px;">\${c.inv1||''}</td>
            <td style="padding:10px;">\${c.inv2||''}</td>
            <td style="padding:10px;text-align:right;color:#0F2942;font-weight:600;">\${fmt(c.total_payable)}</td>
            <td style="padding:10px;text-align:right;color:#1F7A4D;font-weight:600;">\${fmt(c.received)}</td>
          </tr>\`).join('')}
        </tbody>
      </table>
      <div style="margin-top:40px;border-top:1px dashed #ccc;padding-top:16px;font-size:10px;color:#888;text-align:center;">
        Generated securely via DNA Payments Dashboard &bull; \${new Date().toLocaleString()}
      </div>
    </div>\`;
}`;

// Replace slipTemplatePremium
let newSlipHtml = `function slipTemplatePremium(name, mo, monthCases, stats) {
  const s = settings;
  const rows = monthCases.map((c, i) => {
    const a = invAmountOnCase(c, name);
    return \`<tr style="border-bottom:1px solid #eee;background:\${i%2===0?'#fff':'#fcfcfc'};">
      <td style="padding:10px 12px;font-family:monospace;font-size:10px;color:#657486;">\${c.doc_code||''}</td>
      <td style="padding:10px 12px;font-weight:500;">\${c.date||''}</td>
      <td style="padding:10px 12px;">\${c.claim_no||''}</td>
      <td style="padding:10px 12px;">\${c.insured_name||''}</td>
      <td style="padding:10px 12px;color:#657486;">\${c.company||''}</td>
      <td style="padding:10px 12px;text-align:right;">Rs \${fmt(a.fee)}</td>
      <td style="padding:10px 12px;text-align:right;">Rs \${fmt(a.ta)}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:#0F2942;">Rs \${fmt(a.total)}</td>
      <td style="padding:10px 12px;text-align:center;">
        <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;background:\${a.status.includes('Paid')&&!a.status.includes('Pending')?'#E7F5EC':'#FDF2E0'};color:\${a.status.includes('Paid')&&!a.status.includes('Pending')?'#1F7A4D':'#B87A1E'};">\${a.status||'—'}</span>
      </td>
    </tr>\`;
  }).join('');

  return \`
    <div style="font-family:'Segoe UI',Arial,sans-serif;padding:50px;background:#fff;color:#1B2530;line-height:1.5;">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #0F2942;padding-bottom:20px;margin-bottom:30px;">
        <div style="display:flex;align-items:center;gap:20px;">
          \${s.logo ? \`<img src="\${s.logo}" style="height:70px;">\` : ''}
          <div>
            <div style="font-size:24px;font-weight:800;color:#0F2942;letter-spacing:0.5px;">\${s.agencyName}</div>
            <div style="font-size:12px;color:#657486;margin-top:4px;">\${s.agencyAddress||''}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#657486;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Payment Statement</div>
          <div style="font-size:13px;font-weight:600;color:#0F2942;margin-top:6px;">\${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;">
        <div>
          <div style="font-size:10px;color:#657486;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:4px;">Investigator</div>
          <div style="font-size:22px;font-weight:800;color:#0F2942;">\${name}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#657486;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:4px;">Period</div>
          <div style="font-size:16px;font-weight:700;color:#0F2942;">\${mo.label}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:30px;">
        <div style="background:#f8f9fa;border:1px solid #eee;border-radius:8px;padding:16px;text-align:center;"><div style="font-size:10px;color:#657486;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Total Cases</div><div style="font-size:24px;font-weight:800;color:#0F2942;margin-top:8px;">\${stats.totalCases}</div></div>
        <div style="background:#F0FDF4;border:1px solid #DCFCE7;border-radius:8px;padding:16px;text-align:center;"><div style="font-size:10px;color:#166534;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Paid</div><div style="font-size:24px;font-weight:800;color:#15803D;margin-top:8px;">\${stats.paidCases}</div></div>
        <div style="background:#FEFCE8;border:1px solid #FEF08A;border-radius:8px;padding:16px;text-align:center;"><div style="font-size:10px;color:#854D0E;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Pending</div><div style="font-size:24px;font-weight:800;color:#A16207;margin-top:8px;">\${stats.pendingCases}</div></div>
        <div style="background:#0F2942;border-radius:8px;padding:16px;text-align:center;box-shadow:0 4px 12px rgba(15,41,66,0.2);"><div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Total Payable</div><div style="font-size:20px;font-weight:800;color:#fff;margin-top:8px;">Rs \${fmt(stats.totalPayable)}</div></div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#0F2942;color:#fff;">
            <th style="padding:12px;text-align:left;font-weight:600;border-top-left-radius:6px;">Doc Code</th>
            <th style="padding:12px;text-align:left;font-weight:600;">Date</th>
            <th style="padding:12px;text-align:left;font-weight:600;">Claim No</th>
            <th style="padding:12px;text-align:left;font-weight:600;">Insured</th>
            <th style="padding:12px;text-align:left;font-weight:600;">Company</th>
            <th style="padding:12px;text-align:right;font-weight:600;">Fee</th>
            <th style="padding:12px;text-align:right;font-weight:600;">TA</th>
            <th style="padding:12px;text-align:right;font-weight:600;">Total</th>
            <th style="padding:12px;text-align:center;font-weight:600;border-top-right-radius:6px;">Status</th>
          </tr>
        </thead>
        <tbody>
          \${rows}
        </tbody>
      </table>
      <div style="margin-top:40px;border-top:1px dashed #ccc;padding-top:16px;font-size:10px;color:#888;text-align:center;">
        Generated securely via DNA Payments Dashboard &bull; \${new Date().toLocaleString()}
      </div>
    </div>\`;
}`;

code = code.replace(/function buildReportHTML.*?^}/ms, newReportHtml);
code = code.replace(/function slipTemplatePremium.*?^}/ms, newSlipHtml);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('Successfully patched PDF templates in app.js');
