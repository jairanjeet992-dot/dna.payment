const puppeteer = require('puppeteer');

(async () => {
  try {
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      
      await page.setViewport({ width: 375, height: 667 }); 
      
      await page.goto('http://localhost:3000');
      await new Promise(r => setTimeout(r, 2000));
      
      await page.evaluate(() => {
         // Create a wrapper div that is absolutely positioned at 0,0
         const html = `
           <div style="font-family:'Segoe UI',Arial,sans-serif;padding:40px;width:794px;margin:0;box-sizing:border-box;color:#1B2530;background:#fff;">
              <h1>DNA Payments</h1>
              <p>This should not be clipped and should not be blank.</p>
           </div>
         `;
         const opt = {
            margin: [10, 10],
            filename: 'test.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, onclone: window.sanitizeHtml2Canvas, windowWidth: 1024 },
            pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
         };
         
         return window.html2pdf().from(html).set(opt).output('blob')
           .then(() => {
              console.log('SUCCESS_HTML2PDF_BLANK_FIX');
           })
           .catch(e => console.error(e));
      });
      await new Promise(r => setTimeout(r, 1000));
      await browser.close();
  } catch (err) {
      console.error(err);
  }
})();
