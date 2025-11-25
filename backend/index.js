const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Apply CORS correctly at the top
app.use(cors({
  origin: '*', // Later replace with your frontend domain like 'https://drop-in-lmr.vercel.app/'
}));

app.use(express.json());

// Serve static files from uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Create uploads folder if not exists
const storageDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir);
}

// ✅ Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ✅ Upload endpoint
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    const code = uuidv4().slice(0, 5).toUpperCase();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    for (const file of req.files) {
      await db.execute(
        'INSERT INTO files (code, filename, originalname, mimetype, size, path, expiry) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [code, file.filename, file.originalname, file.mimetype, file.size, file.path, expiry]
      );
    }

    res.json({ code });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ✅ Metadata endpoint
app.get('/api/info/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    // Check if code exists
    const [existsRows] = await db.execute('SELECT COUNT(*) as count FROM files WHERE code = ?', [code]);
    if (existsRows[0].count === 0) {
      return res.status(404).json({ error: 'Code not found' });
    }

    // Get active files
    const [rows] = await db.execute(
      'SELECT filename, originalname, size, mimetype FROM files WHERE code = ? AND expiry > NOW()',
      [code]
    );

    if (rows.length === 0) {
      // All expired, delete the group
      await db.execute('DELETE FROM files WHERE code = ?', [code]);
      return res.status(410).json({ error: 'Files expired' });
    }

    res.json({
      files: rows
    });
  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// ✅ Download endpoint for individual files
app.get('/api/download/:code/:filename', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const filename = req.params.filename;

    // Check if code exists and not expired
    const [existsRows] = await db.execute(
      'SELECT COUNT(*) as count FROM files WHERE code = ? AND filename = ? AND expiry > NOW()',
      [code, filename]
    );

    if (existsRows[0].count === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file details
    const [rows] = await db.execute(
      'SELECT path, originalname FROM files WHERE code = ? AND filename = ? AND expiry > NOW()',
      [code, filename]
    );

    const file = rows[0];
    res.download(file.path, file.originalname);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// ✅ Download endpoint for all files in a group (metadata)
app.get('/api/download/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    // Check if code exists
    const [existsRows] = await db.execute('SELECT COUNT(*) as count FROM files WHERE code = ?', [code]);
    if (existsRows[0].count === 0) {
      return res.status(404).json({ error: 'Code not found' });
    }

    const [rows] = await db.execute(
      'SELECT * FROM files WHERE code = ? AND expiry > NOW()',
      [code]
    );

    if (rows.length === 0) {
      await db.execute('DELETE FROM files WHERE code = ?', [code]);
      return res.status(410).json({ error: 'Files expired' });
    }

    res.json({ files: rows });
  } catch (error) {
    console.error('Download info error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// ✅ Cleanup expired files every hour
setInterval(async () => {
  try {
    const [result] = await db.execute('DELETE FROM files WHERE expiry < NOW()');
    if (result.affectedRows > 0) {
      console.log(`Cleaned up ${result.affectedRows} expired files`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}, 60 * 60 * 1000);

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('✅ DropIn backend is running');
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`✅ DropIn backend is running on port ${PORT}`);
});
