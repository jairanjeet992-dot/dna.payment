const puppeteer = require('puppeteer');

(async () => {
  try {
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      
      await page.setViewport({ width: 375, height: 667 }); 
      
      await page.goto('http://localhost:3000');
      await new Promise(r => setTimeout(r, 2000));
      
      // We will scroll the page down to simulate user scrolling
      await page.evaluate(() => {
         window.scrollTo(50, 200);
      });
      
      await page.evaluate(() => {
         const html = `
           <div style="font-family:'Segoe UI',Arial,sans-serif;padding:40px;width:794px;margin:0;box-sizing:border-box;color:#1B2530; background: #fff; height: 1000px;">
              <h1>Test Premium Slip Fix</h1>
           </div>
         `;
         const opt = {
            margin: [10, 10],
            filename: 'test.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 800, scrollY: 0, scrollX: 0 },
            pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
         };
         return window.html2pdf().from(html).set(opt).output('blob')
           .then(() => console.log('SUCCESS_FINAL_PDF_MOBILE'))
           .catch(e => console.error(e));
      });
      await new Promise(r => setTimeout(r, 1000));
      await browser.close();
  } catch (err) {
      console.error(err);
  }
})();
