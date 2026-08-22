const puppeteer = require('puppeteer');

(async () => {
  try {
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      
      // Simulate scrolled desktop
      await page.setViewport({ width: 1440, height: 900 }); 
      await page.goto('http://localhost:3000');
      await new Promise(r => setTimeout(r, 2000));
      
      await page.evaluate(() => {
         window.scrollTo(0, 500); // Scrolled down
      });
      
      await page.evaluate(() => {
         const html = `
           <div style="font-family:sans-serif;padding:40px;width:100%;max-width:800px;margin:0 auto;box-sizing:border-box;color:#1B2530;background:#fff;">
              <div style="display:flex; justify-content:space-between;">
                <h1>DNA Payments</h1>
                <h2>Investigator Payment Slip</h2>
              </div>
              <p>This should not be clipped on the right, and no blank space on top.</p>
           </div>
         `;
         const opt = {
            margin: 10,
            filename: 'test.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
            pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
         };
         
         const div = document.createElement('div');
         div.innerHTML = html;
         // We must append to body for html2canvas to render correctly sometimes, but html2pdf handles strings well.
         // Let's test string first with scrollY: 0
         
         return window.html2pdf().from(html).set(opt).output('blob')
           .then(() => {
              console.log('SUCCESS_PERFECT_PDF');
           })
           .catch(e => console.error(e));
      });
      await new Promise(r => setTimeout(r, 1000));
      await browser.close();
  } catch (err) {
      console.error(err);
  }
})();
