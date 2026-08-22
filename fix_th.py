import re

with open("public/index.html", "r") as f:
    html = f.read()

# Add the dark mode th rule right after the th {...} rule
if "body.dark-mode th" not in html:
    html = html.replace(
        "th{background:var(--paper);color:var(--navy);border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;position:sticky;top:0;z-index:1;}",
        "th{background:var(--paper);color:var(--navy);border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;position:sticky;top:0;z-index:1;}\nbody.dark-mode th{background:var(--navy);color:#fff;border-bottom:none;}"
    )

with open("public/index.html", "w") as f:
    f.write(html)
