const fs = require('fs');
let css = fs.readFileSync('dna-command-center.css', 'utf8');

// The sidebar logic is in:
// @media(min-width:1025px){.tabs{position:fixed!important;top:76px!important;bottom:0;left:0;width:224px;padding:18px 12px!important;...
// .view{max-width:1600px!important;margin-left:224px!important;...

// We will change width:224px to width:165px
// We will change padding:18px 12px to padding:18px 8px
// We will change padding:11px 13px (on .tab) to padding:10px 10px
// We will change margin-left:224px to margin-left:165px

css = css.replace(/width:224px;/g, "width:165px;");
css = css.replace(/margin-left:224px!important;/g, "margin-left:165px!important;");
css = css.replace(/padding:18px 12px!important;/g, "padding:18px 6px!important;");
css = css.replace(/padding:11px 13px!important;/g, "padding:10px 8px!important;");

fs.writeFileSync('dna-command-center.css', css);
