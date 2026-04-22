#!/usr/bin/env node
'use strict';

// Rebuilds sitemap.xml from the on-disk HTML pages and flavor list.
// Run after adding a new page: `node scripts/generate-sitemap.js`

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = process.env.PUBLIC_ORIGIN || 'https://spilltea.com';

const staticPages = [
  { loc: '/',                            priority: 1.0, changefreq: 'weekly'  },
  { loc: '/contact.html',                priority: 0.5, changefreq: 'yearly'  },
  { loc: '/privacy-policy.html',         priority: 0.3, changefreq: 'yearly'  },
  { loc: '/shipping-returns.html',       priority: 0.3, changefreq: 'yearly'  },
  { loc: '/refund-policy.html',          priority: 0.3, changefreq: 'yearly'  },
  { loc: '/terms.html',                  priority: 0.3, changefreq: 'yearly'  },
];

const flavorsDir = path.join(ROOT, 'flavors');
const flavorPages = fs.readdirSync(flavorsDir)
  .filter(f => f.endsWith('.html'))
  .map(f => ({ loc: `/flavors/${f}`, priority: 0.9, changefreq: 'monthly' }));

const all = [...staticPages, ...flavorPages];

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  all.map(p => (
    '  <url>\n' +
    `    <loc>${ORIGIN}${encodeURI(p.loc)}</loc>\n` +
    `    <changefreq>${p.changefreq}</changefreq>\n` +
    `    <priority>${p.priority.toFixed(1)}</priority>\n` +
    '  </url>'
  )).join('\n') +
  '\n</urlset>\n';

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log(`Wrote sitemap.xml with ${all.length} URLs.`);
