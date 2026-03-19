import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Restrict file types
const allowedTypes = [
  'image/', 'video/', 'audio/', 
  'application/pdf', 'application/zip', 'text/',
  'application/msword', 'application/vnd.openxmlformats-officedocument' // docs
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Sanitize filenames
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit per file backend enforcement
  fileFilter: (req, file, cb) => {
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed.`), false);
    }
  }
});

export default upload;
