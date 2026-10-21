import fs from 'node:fs';
fs.mkdirSync('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js', 'engine.js', 'killer.js', 'favicon.svg']) {
  fs.copyFileSync(file, `dist/${file}`);
}
console.log('Static game built in dist/');
