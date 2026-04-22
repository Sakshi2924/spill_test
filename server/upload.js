'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_MB = parseInt(process.env.MAX_UPLOAD_MB, 10) || 5;

// Magic-byte signatures for whitelisted image types.
// Checked in addition to MIME to defeat spoofed extensions.
const SIGS = {
  'image/png':  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF....WEBP
  'image/gif':  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
};
const ALLOWED_MIME = new Set(Object.keys(SIGS));
const EXT_OF = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

function matchesSig(buf, mime) {
  const sigs = SIGS[mime];
  if (!sigs) return false;
  return sigs.some(sig => sig.every((b, i) => buf[i] === b));
}

function sanitizeBasename(name) {
  return String(name || 'upload')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'upload';
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_MB * 1024 * 1024,
    files: 1,
    fields: 5,
    fieldSize: 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(Object.assign(new Error('Unsupported file type'), { status: 415 }));
    }
    cb(null, true);
  },
});

async function persistUpload(file) {
  if (!file) throw Object.assign(new Error('No file'), { status: 400 });
  if (!matchesSig(file.buffer, file.mimetype)) {
    throw Object.assign(new Error('File content does not match declared type'), { status: 415 });
  }
  const ext = EXT_OF[file.mimetype];
  const base = sanitizeBasename(path.basename(file.originalname, path.extname(file.originalname)));
  const token = crypto.randomBytes(6).toString('hex');
  const filename = `${Date.now()}-${base}-${token}${ext}`;
  const full = path.join(UPLOAD_DIR, filename);
  await fs.promises.writeFile(full, file.buffer, { mode: 0o644 });
  return { filename, url: `/uploads/${filename}`, size: file.size, mime: file.mimetype };
}

module.exports = { upload, persistUpload, MAX_MB };
