const puppeteer = require('puppeteer');

(async () => {
  try {
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      
      await page.setViewport({ width: 375, height: 667 }); // mobile view
      
      await page.goto('http://localhost:3000');
      await new Promise(r => setTimeout(r, 2000));
      
      // Navigate to Inv360 layout logic
      await page.evaluate(() => {
         const html = `
           <div class="inv360-sheet" style="background:#fff; color:#172033; padding:40px; max-width:1000px;">
              <h1>Test Inv360</h1>
              <div class="inv360-detail-grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0;">A</div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0;">B</div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0;">C</div>
              </div>
           </div>
         `;
         const wrapper = document.createElement('div');
         wrapper.innerHTML = html;
         const clone = wrapper.firstElementChild;
         clone.style.height = 'auto';
         clone.style.overflow = 'visible';
         
         const opt = {
            margin: 10,
            filename: 'test2.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, onclone: window.sanitizeHtml2Canvas, windowWidth: 1024 },
            pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
         };
         return window.html2pdf().from(clone).set(opt).output('blob')
           .then(() => console.log('SUCCESS_HTML2PDF_INV360'))
           .catch(e => console.error(e));
      });
      await new Promise(r => setTimeout(r, 1000));
      await browser.close();
  } catch (err) {
      console.error(err);
  }
})();
