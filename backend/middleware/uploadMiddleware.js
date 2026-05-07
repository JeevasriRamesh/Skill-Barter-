const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsRoot = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsRoot);
  },
  filename: (req, file, cb) => {
    const safeOriginal = String(file.originalname || 'file').replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safeOriginal}`);
  }
});

const allowedMime = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'image/webp'
]);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP and PDF files are allowed'));
    }
    return cb(null, true);
  }
});

module.exports = upload;
