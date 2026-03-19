import Transfer from '../models/Transfer.js';
import cloudinary from '../config/cloudinary.js';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { Readable } from 'stream';
import bcrypt from 'bcryptjs';
import https from 'https';

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
    const { code, filename } = req.params;
    const transfer = await Transfer.findOne({ code });
    
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found or expired' });
    }
    
    // Check download limit
    if (transfer.downloadsCount >= transfer.maxDownloads) {
      return res.status(403).json({ error: 'Max downloads reached' });
    }

    const file = transfer.files.find(f => f.filename === filename);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Increment download count
    transfer.downloadsCount += 1;
    await transfer.save();
    
    // Generate fresh URLs for all file types to ensure access
    try {
      let resourceType = 'auto';
      let format = null;
      
      // Determine resource type and format based on mimetype
      if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
        resourceType = 'raw';
        format = 'pdf';
      } else if (file.mimetype.startsWith('image/')) {
        resourceType = 'image';
        // Extract format from mimetype (e.g., 'image/jpeg' -> 'jpeg')
        if (file.mimetype.includes('/')) {
          format = file.mimetype.split('/')[1];
        }
      } else if (file.mimetype.startsWith('video/')) {
        resourceType = 'video';
        if (file.mimetype.includes('/')) {
          format = file.mimetype.split('/')[1];
        }
      } else if (file.mimetype.startsWith('audio/')) {
        resourceType = 'video'; // Cloudinary treats audio as video resource type
        if (file.mimetype.includes('/')) {
          format = file.mimetype.split('/')[1];
        }
      } else {
        resourceType = 'raw'; // For documents and other files
      }
      
      // Generate fresh public URL
      const urlOptions = {
        resource_type: resourceType,
        secure: true,
        type: 'upload'
      };
      
      if (format) {
        urlOptions.format = format;
      }
      
      const freshUrl = cloudinary.url(file.public_id, urlOptions);
      
      console.log(`Generated fresh URL for ${file.mimetype}: ${freshUrl}`);
      res.redirect(302, freshUrl);
      return;
      
    } catch (urlError) {
      console.error('URL generation failed:', urlError);
    }
    
    // Fallback to original URL
    console.log(`Fallback to original URL: ${file.url}`);
    res.redirect(302, file.url);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
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
