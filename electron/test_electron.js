const e = require('electron');
console.log('electron type:', typeof e);
if (typeof e === 'object' && e !== null) {
  console.log('has app:', 'app' in e);
  console.log('keys:', Object.keys(e).join(', '));
} else {
  console.log('got string/non-object:', e);
}
process.exit(0);
