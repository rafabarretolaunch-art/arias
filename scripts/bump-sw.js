#!/usr/bin/env node
// Actualiza la versión del service worker en cada deploy de Netlify.
const fs = require('fs');
const path = require('path');

if (!process.env.NETLIFY) {
  console.log('sw.js bump skipped (solo en Netlify)');
  process.exit(0);
}

const swPath = path.join(__dirname, '..', 'sw.js');
let src = fs.readFileSync(swPath, 'utf8');

const buildId = process.env.NETLIFY_BUILD_ID || Date.now();
const version = `ari-${String(buildId).slice(0, 12)}`;

src = src.replace(/const VERSION = '[^']+';/, `const VERSION = '${version}';`);
fs.writeFileSync(swPath, src);
console.log(`sw.js → VERSION = '${version}'`);
