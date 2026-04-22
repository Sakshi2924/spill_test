'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const storage = require('./storage');

const router = express.Router();

router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

router.get('/flavors', (req, res) => {
  const c = storage.read();
  res.json(c.flavors.filter(f => f.published));
});

router.get('/flavours/:slug', (req, res) => {
  const f = storage.getFlavor(req.params.slug);
  if (!f || !f.published) return res.status(404).json({ error: 'Not found' });
  res.json(f);
});

router.get('/pages/:id', (req, res) => {
  const c = storage.read();
  const page = c.pages[req.params.id];
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});

module.exports = router;
