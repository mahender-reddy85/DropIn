const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Apply CORS correctly at the top
app.use(cors({
  origin: '*', // Later replace with your frontend domain like 'https://drop-in-lmr.vercel.app/'
}));

app.use(express.json());

// Serve static files from uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads folder if not exists
const storageDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Create metadata folder if not exists
const metadataDir = path.join(__dirname, 'metadata');
if (!fs.existsSync(metadataDir)) {
  fs.mkdirSync(metadataDir, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Upload endpoint
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const code = uuidv4().slice(0, 5).toUpperCase();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const metadataFile = path.join(metadataDir, `${code}.json`);

    const filesData = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }));

    const metadata = {
      expiry: expiry.toISOString(),
      files: filesData
    };

    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

    res.json({ code });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Metadata endpoint
app.get('/api/info/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const metadataFile = path.join(metadataDir, `${code}.json`);

    if (!fs.existsSync(metadataFile)) {
      return res.status(404).json({ error: 'Code not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    const expiryDate = new Date(metadata.expiry);

    if (expiryDate < new Date()) {
      // Expired, delete metadata and files
      fs.unlinkSync(metadataFile);
      metadata.files.forEach(file => {
        const filePath = path.join(storageDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      return res.status(410).json({ error: 'Files expired' });
    }

    res.json({
      files: metadata.files
    });
  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Download endpoint for individual files
app.get('/api/download/:code/:filename', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const filename = req.params.filename;
    const metadataFile = path.join(metadataDir, `${code}.json`);

    if (!fs.existsSync(metadataFile)) {
      return res.status(404).json({ error: 'Code not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    const expiryDate = new Date(metadata.expiry);

    if (expiryDate < new Date()) {
      // Expired, cleanup
      fs.unlinkSync(metadataFile);
      metadata.files.forEach(file => {
        const filePath = path.join(storageDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      return res.status(410).json({ error: 'Files expired' });
    }

    const fileData = metadata.files.find(f => f.filename === filename);
    if (!fileData) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(storageDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, fileData.originalname);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Download endpoint for all files in a group (metadata)
app.get('/api/download/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const metadataFile = path.join(metadataDir, `${code}.json`);

    if (!fs.existsSync(metadataFile)) {
      return res.status(404).json({ error: 'Code not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    const expiryDate = new Date(metadata.expiry);

    if (expiryDate < new Date()) {
      // Expired, cleanup
      fs.unlinkSync(metadataFile);
      metadata.files.forEach(file => {
        const filePath = path.join(storageDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      return res.status(410).json({ error: 'Files expired' });
    }

    res.json({ files: metadata.files });
  } catch (error) {
    console.error('Download info error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Cleanup expired files every hour
setInterval(() => {
  try {
    const now = new Date();
    fs.readdirSync(metadataDir).forEach(file => {
      if (file.endsWith('.json')) {
        const metadataFile = path.join(metadataDir, file);
        const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        const expiryDate = new Date(metadata.expiry);

        if (expiryDate < now) {
          fs.unlinkSync(metadataFile);
          metadata.files.forEach(f => {
            const filePath = path.join(storageDir, f.filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          });
          console.log(`Cleaned up expired code: ${file}`);
        }
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}, 60 * 60 * 1000);

// Health check route
app.get('/', (req, res) => {
  res.send('✅ DropIn backend is running');
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ DropIn backend is running on port ${PORT}`);
});
