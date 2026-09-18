const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const name of ['index.html', 'style.css', 'mobile.css', 'app.js', 'cloud.js', 'validation.mjs', '_headers', 'logoPng.png']) fs.copyFileSync(path.join(root, name), path.join(root, 'dist', name));
console.log('Built static site in dist/');
