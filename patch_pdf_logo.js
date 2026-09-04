const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const searchPDF1 = `  showToast('Generating PDF...');
  try {
    const worker = html2pdf().from(html).set(opt);
    await worker.save();
    showToast('PDF Downloaded');
  } catch (err) {`;

const replacePDF1 = `  showToast('Generating PDF...');
  try {
    // SMART FIX: Render to a hidden DOM element first so images decode instantly
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.innerHTML = html;
    document.body.appendChild(tempDiv);
    
    // Wait for the logo image to decode (which is instant for base64 but needs a tiny tick)
    const imgs = Array.from(tempDiv.querySelectorAll('img'));
    await Promise.all(imgs.map(img => new Promise(r => {
      if (img.complete) return r();
      img.onload = r;
      img.onerror = r;
    })));
    
    const worker = html2pdf().from(tempDiv).set(opt);
    await worker.save();
    document.body.removeChild(tempDiv);
    showToast('PDF Downloaded');
  } catch (err) {`;

code = code.replace(searchPDF1, replacePDF1);

const searchPDF2 = `    showToast('Downloading PDF...');
    try {
      await html2pdf().from(sanitizedHtml).set(opt).save();
      showToast('Downloaded successfully');
    } catch (err) {`;

const replacePDF2 = `    showToast('Downloading PDF...');
    try {
      // Use the already rendered DOM node (content) which has the logo fully loaded!
      // This is instant and 100% accurate.
      await html2pdf().from(content).set(opt).save();
      showToast('Downloaded successfully');
    } catch (err) {`;

code = code.replace(searchPDF2, replacePDF2);

fs.writeFileSync('app.js', code);
