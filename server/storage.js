'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');

const DEFAULT_CONTENT = {
  meta: {
    brand: 'Spill',
    tagline: 'Tea That Hits Different',
    email: 'hello@spillnow.in',
  },
  flavors: [
    {
      slug: 'masala-mayhem',
      name: 'Masala Mayhem',
      tagline: 'Spiced chaos in every sip',
      price: 449,
      theme: '#d42518',
      published: true,
      images: ['/main%20images/1.png', '/main%20images/2.png', '/main%20images/3.png', '/main%20images/4.png'],
      short: 'Cardamom, clove, black pepper and ginger, layered over bold Assam base.',
    },
    {
      slug: 'mint-riot',
      name: 'Mint Riot',
      tagline: 'Cool, crisp, unhinged',
      price: 399,
      theme: '#9abc04',
      published: true,
      images: ['/main%20images/5.png', '/main%20images/6.png', '/main%20images/7.png', '/main%20images/8.png'],
      short: 'Himalayan green tea pressed with fresh peppermint and spearmint.',
    },
    {
      slug: 'ginger-snap',
      name: 'Ginger Snap',
      tagline: 'Burns so good',
      price: 429,
      theme: '#f86015',
      published: true,
      images: ['/main%20images/9.png', '/main%20images/10.png', '/main%20images/11.png', '/main%20images/12.png'],
      short: 'Bold black tea with dried ginger root, lemongrass and lemon peel.',
    },
    {
      slug: 'berry-burst',
      name: 'Berry Burst',
      tagline: 'Fruity and absolutely feral',
      price: 419,
      theme: '#d42518',
      published: true,
      images: ['/main%20images/13.png', '/main%20images/14.png', '/main%20images/15.png', '/main%20images/16.png'],
      short: 'Hibiscus, rosehip, dried blueberry and strawberry bits.',
    },
    {
      slug: 'classic-chaos',
      name: 'Classic Chaos',
      tagline: 'The OG, reimagined',
      price: 389,
      theme: '#19532b',
      published: true,
      images: ['/main%20images/17.png', '/main%20images/18.png', '/main%20images/19.png', '/main%20images/20.png'],
      short: '100% single-origin Assam, whole leaf, full-bodied.',
    },
  ],
  pages: {
    contact: {
      title: 'Contact',
      body: "Got a question, idea, or just want to talk tea? We're all ears.",
    },
    'privacy-policy': {
      title: 'Privacy Policy',
      body: 'We collect only what we need to fulfill orders. Full policy on the privacy page.',
    },
    'shipping-returns': {
      title: 'Shipping & Returns',
      body: 'We ship across India. 5–7 day delivery. Returns within 7 days.',
    },
    'refund-policy': {
      title: 'Refund Policy',
      body: 'Refunds for unopened items within 7 days. Processed in 5–7 business days.',
    },
  },
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONTENT_FILE)) {
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(DEFAULT_CONTENT, null, 2), { mode: 0o644 });
  }
}

function read() {
  ensure();
  return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
}

function writeAtomic(content) {
  ensure();
  const tmp = CONTENT_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(content, null, 2));
  fs.renameSync(tmp, CONTENT_FILE);
}

function getFlavor(slug) {
  const c = read();
  return c.flavors.find(f => f.slug === slug) || null;
}

function updateFlavor(slug, patch) {
  const c = read();
  const idx = c.flavors.findIndex(f => f.slug === slug);
  if (idx === -1) throw new Error('Flavor not found');
  c.flavors[idx] = { ...c.flavors[idx], ...patch, slug: c.flavors[idx].slug };
  writeAtomic(c);
  return c.flavors[idx];
}

function updatePage(id, patch) {
  const c = read();
  if (!c.pages[id]) throw new Error('Page not found');
  c.pages[id] = { ...c.pages[id], ...patch };
  writeAtomic(c);
  return c.pages[id];
}

module.exports = { read, writeAtomic, getFlavor, updateFlavor, updatePage, CONTENT_FILE };
