try {
  new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  console.log("Date format OK");
} catch(e) {
  console.log(e.name, e.message);
}
