import Transfer from '../models/Transfer.js';
import cloudinary from '../config/cloudinary.js';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { Readable } from 'stream';
import bcrypt from 'bcryptjs';
import https from 'https';
import archiver from 'archiver';
import path from 'path';

// Clean up temporary local files after uploading or on error
const cleanupLocalFiles = (files) => {
  if (!files) return;
  files.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  });
};

export const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];
    
    // Upload each to cloudinary with consistent public access
    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'auto',
        folder: 'dropin',
        use_filename: true,
        original_filename: file.originalname,
        access_mode: 'public',
        overwrite: false
      });

      uploadedFiles.push({
        filename: file.filename, // our local naming
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: result.secure_url,
        public_id: result.public_id
      });
    }
    
    // Cleanup local uploads
    cleanupLocalFiles(req.files);

    const code = nanoid(8); // Updated to 8 characters max
    // Link expiration config
    let hours = 1;
    if (req.body.expiration && !isNaN(req.body.expiration)) {
      hours = parseInt(req.body.expiration); 
    }
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    let hashedPassword = undefined;
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(req.body.password, salt);
    }

    const transfer = new Transfer({
      code,
      files: uploadedFiles,
      expiresAt,
      password: hashedPassword
    });

    await transfer.save();

    res.status(201).json({ code: transfer.code, expiresAt: transfer.expiresAt });
  } catch (error) {
    cleanupLocalFiles(req.files);
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Server error during upload' });
  }
};

export const getFilesInfo = async (req, res) => {
  try {
    const { code } = req.params;
    const transfer = await Transfer.findOne({ code });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found or expired' });
    }

    // Optional password protection check
    if (transfer.password) {
      // Must provide current query param password or POST body password
      const pw = req.query.password || req.body.password;
      if (!pw) {
        return res.status(401).json({ error: 'Password required' });
      }
      const isMatch = await bcrypt.compare(pw, transfer.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    }

    res.json({
      code: transfer.code,
      expiresAt: transfer.expiresAt,
      requiresPassword: !!transfer.password,
      downloadsCount: transfer.downloadsCount,
      files: transfer.files.map(f => ({
        filename: f.filename,
        originalname: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
        url: f.url
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files info' });
  }
};

export const downloadFile = async (req, res) => {
  try {
    console.log('Download request received:', req.params);
    const { code, filename } = req.params;
    
    const transfer = await Transfer.findOne({ code });
    console.log('Transfer found:', transfer ? 'Yes' : 'No');
    
    if (!transfer) {
      console.log('Transfer not found for code:', code);
      return res.status(404).json({ error: 'Transfer not found or expired' });
    }
    
    // Check download limit
    if (transfer.downloadsCount >= transfer.maxDownloads) {
      console.log('Max downloads reached');
      return res.status(403).json({ error: 'Max downloads reached' });
    }

    const file = transfer.files.find(f => f.filename === filename);
    console.log('File found:', file ? `Yes (${file.originalname})` : 'No');
    
    if (!file) {
      console.log('File not found:', filename);
      console.log('Available files:', transfer.files.map(f => f.filename));
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Increment download count
    transfer.downloadsCount += 1;
    await transfer.save();
    console.log('Download count incremented to:', transfer.downloadsCount);
    
    // Redirect to original Cloudinary URL
    console.log('Redirecting to URL:', file.url);
    
    // Set headers before redirect
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.redirect(302, file.url);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed', details: error.message });
  }
};

export const downloadAllFiles = async (req, res) => {
  try {
    console.log('Bulk download request received:', req.params);
    const { code } = req.params;
    
    const transfer = await Transfer.findOne({ code });
    console.log('Transfer found:', transfer ? 'Yes' : 'No');
    
    if (!transfer) {
      console.log('Transfer not found for code:', code);
      return res.status(404).json({ error: 'Transfer not found or expired' });
    }
    
    // Optional password protection check
    if (transfer.password) {
      const pw = req.query.password || req.body.password;
      if (!pw) {
        return res.status(401).json({ error: 'Password required' });
      }
      const isMatch = await bcrypt.compare(pw, transfer.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    }
    
    // Check download limit
    if (transfer.downloadsCount >= transfer.maxDownloads) {
      console.log('Max downloads reached');
      return res.status(403).json({ error: 'Max downloads reached' });
    }

    if (!transfer.files || transfer.files.length === 0) {
      return res.status(404).json({ error: 'No files to download' });
    }

    // Increment download count for bulk download
    transfer.downloadsCount += 1;
    await transfer.save();
    console.log('Download count incremented to:', transfer.downloadsCount);

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Set response headers for ZIP download
    const zipFilename = `dropin_${transfer.downloadsCount}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Pipe archive to response
    archive.pipe(res);

    // Add each file to the archive
    for (const file of transfer.files) {
      try {
        console.log(`Adding file to ZIP: ${file.originalname}`);
        
        let downloadUrl = file.url;
        
        // For PDFs, generate fresh URL to avoid access issues
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
          try {
            downloadUrl = cloudinary.url(file.public_id, {
              resource_type: 'raw',
              format: 'pdf',
              secure: true,
              type: 'upload'
            });
            console.log(`Using fresh PDF URL: ${downloadUrl}`);
          } catch (urlError) {
            console.error(`URL generation failed for ${file.originalname}, using original:`, urlError);
            downloadUrl = file.url;
          }
        }
        
        // Download file from Cloudinary and add to ZIP
        const fileStream = await new Promise((resolve, reject) => {
          https.get(downloadUrl, { headers: { 'User-Agent': 'DropIn-App/1.0' } }, (cloudRes) => {
            if (cloudRes.statusCode >= 400) {
              reject(new Error(`Failed to fetch ${file.originalname}: ${cloudRes.statusCode}`));
              return;
            }
            resolve(cloudRes);
          }).on('error', reject);
        });

        // Add file to archive with original name
        archive.append(fileStream, { name: file.originalname });
        
      } catch (fileError) {
        console.error(`Error adding file ${file.originalname}:`, fileError);
        // Continue with other files even if one fails
      }
    }

    // Finalize the archive
    archive.finalize();

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create ZIP archive' });
      }
    });

  } catch (error) {
    console.error('Bulk download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Bulk download failed', details: error.message });
    }
  }
};

export const deleteTransfer = async (req, res) => {
  try {
    const { code } = req.params;
    const transfer = await Transfer.findOne({ code });
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }
    
    // Verify password if provided on deletion or just allow deletion if they know the code?
    // User requested "allow user to: delete files, extend expiry". Without user auth, they need the password or we just trust the person who knows the code. 
    
    // Delete files from Cloudinary
    if (transfer.files && transfer.files.length > 0) {
      for (const file of transfer.files) {
        if (file.public_id) {
          await cloudinary.uploader.destroy(file.public_id);
        }
      }
    }
    
    await Transfer.deleteOne({ _id: transfer._id });
    res.json({ success: true, message: 'Transfer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete transfer' });
  }
};

export const extendExpiry = async (req, res) => {
  try {
    const { code } = req.params;
    const transfer = await Transfer.findOne({ code });
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }
    // Extend by 24 hours
    const nextDate = new Date(transfer.expiresAt.getTime() + 24 * 60 * 60 * 1000);
    transfer.expiresAt = nextDate;
    await transfer.save();
    res.json({ success: true, expiresAt: transfer.expiresAt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extend transfer expiry' });
  }
};
