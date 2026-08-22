import re

with open("public/app.js", "r") as f:
    js = f.read()

# Fix the chart pushing payable instead of received
js = js.replace(
    "companyChartData.push({label: co, value: payable});",
    "companyChartData.push({label: co, value: received});"
)

with open("public/app.js", "w") as f:
    f.write(js)
