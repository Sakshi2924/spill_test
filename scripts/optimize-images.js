#!/usr/bin/env node
'use strict';

// Optional: generate WebP variants of everything in "main images/" and public/uploads/.
// Requires `sharp` — install separately if you want to run this:
//     npm install --save-dev sharp
//
// Non-destructive: originals stay put. WebPs land next to them with a .webp extension.

const fs = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); }
catch {
  console.error('sharp is not installed. Run `npm install --save-dev sharp` then re-run this script.');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const dirs = [path.join(ROOT, 'main images'), path.join(ROOT, 'public', 'uploads')];

async function processOne(file) {
  const ext = path.extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;
  const out = file.slice(0, -ext.length) + '.webp';
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(file).mtimeMs) return;
  try {
    await sharp(file).webp({ quality: 82 }).toFile(out);
    console.log('✓', path.relative(ROOT, out));
  } catch (e) {
    console.error('✗', path.relative(ROOT, file), e.message);
  }
}

(async () => {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      await processOne(path.join(dir, name));
    }
  }
})();
