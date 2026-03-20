import multer from 'multer';
import path from 'path';
import fs from 'fs';

// No file type restrictions as requested

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

const TOTAL_SIZE_LIMIT = 500 * 1024 * 1024; // 500MB Total limit per transfer

const multerUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per individual file
  fileFilter: (req, file, cb) => cb(null, true) // Allow all files
});

// Middleware to check total size before processing
const upload = (req, res, next) => {
  // Early check of Content-Length header to prevent massive requests
  const contentLength = parseInt(req.headers['content-length'] || 0);
  if (contentLength > TOTAL_SIZE_LIMIT) {
    return res.status(413).json({ error: `Total upload size exceeds the limit of ${TOTAL_SIZE_LIMIT / (1024 * 1024)}MB` });
  }

  multerUpload.array('files', 100)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Individual file size too large (max 100MB)' });
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'File upload failed' });
    }

    // Secondary deep check after files are on disk (more accurate)
    if (req.files) {
      const totalSize = req.files.reduce((acc, file) => acc + file.size, 0);
      if (totalSize > TOTAL_SIZE_LIMIT) {
        // Cleanup local files if they exceed total limit
        req.files.forEach(f => {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
        return res.status(413).json({ error: `Total transfer size exceeds the limit of ${TOTAL_SIZE_LIMIT / (1024 * 1024)}MB` });
      }
    }

    next();
  });
};

export default upload;
