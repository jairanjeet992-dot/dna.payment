const puppeteer = require('puppeteer');

(async () => {
  try {
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      
      // We will set the viewport to mobile width to verify if the PDF still generates as desktop A4
      await page.setViewport({ width: 375, height: 667 });
      
      await page.goto('http://localhost:3000');
      await new Promise(r => setTimeout(r, 2000));
      
      // Let's invoke slip generation directly by injecting a script
      await page.evaluate(() => {
         const html = `
           <div style="font-family:'Segoe UI',Arial,sans-serif;padding:40px;max-width:760px;margin:0 auto;color:#1B2530;">
              <h1>Test Premium Slip</h1>
              <table style="width:100%; border-bottom:3px solid #B8862E; margin-bottom:22px; padding-bottom:18px;">
                <tr><td>Date: 12-08-2026</td></tr>
              </table>
              <table style="width:100%; border-collapse:separate; border-spacing:10px 0; margin-left:-10px; margin-right:-10px;">
                <tr>
                  <td style="width:25%; background:#F6F4EF; border-radius:6px; padding:12px; text-align:center;">Test Box 1</td>
                  <td style="width:25%; background:#E7F5EC; border-radius:6px; padding:12px; text-align:center;">Test Box 2</td>
                </tr>
              </table>
           </div>
         `;
         const opt = {
            margin: [10, 10],
            filename: 'test.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, onclone: window.sanitizeHtml2Canvas, windowWidth: 800 },
            pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
         };
         return window.html2pdf().from(html).set(opt).output('blob')
           .then(() => console.log('SUCCESS_HTML2PDF_SLIP'))
           .catch(e => console.error(e));
      });
      await new Promise(r => setTimeout(r, 1000));
      await browser.close();
  } catch (err) {
      console.error(err);
  }
})();
