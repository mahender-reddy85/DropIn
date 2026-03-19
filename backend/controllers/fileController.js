import Transfer from '../models/Transfer.js';
import cloudinary from '../config/cloudinary.js';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { Readable } from 'stream';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import archiver from 'archiver';

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
      // Extract folder path from originalname if present (from webkitdirectory)
      const folderPath = file.originalname.includes('/') ? 
        file.originalname.substring(0, file.originalname.lastIndexOf('/')) : '';
      const fileName = file.originalname.includes('/') ? 
        file.originalname.substring(file.originalname.lastIndexOf('/') + 1) : 
        file.originalname;

      // Create Cloudinary folder structure
      const cloudinaryFolder = folderPath ? `dropin/${folderPath}` : 'dropin';
      
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'auto',
        folder: cloudinaryFolder,
        use_filename: true,
        original_filename: fileName,
        type: 'upload', // 🔥 THIS IS KEY - ensures public delivery
        overwrite: false,
        flags: 'attachment'
      });

      uploadedFiles.push({
        filename: result.public_id,
        originalname: file.originalname, // Keep full path for display
        mimetype: file.mimetype,
        size: file.size,
        url: result.secure_url,
        public_id: result.public_id,
        uploadedAt: new Date(),
        deleteAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
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

    // Redirect to original Cloudinary URL
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
    const { code } = req.params;

    const transfer = await Transfer.findOne({ code });

    if (!transfer) {
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
      return res.status(403).json({ error: 'Max downloads reached' });
    }

    if (!transfer.files || transfer.files.length === 0) {
      return res.status(404).json({ error: 'No files to download' });
    }

    // Increment download count for bulk download
    transfer.downloadsCount += 1;
    await transfer.save();

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

    // Add each file to archive
    let processedFiles = 0;
    let skippedFiles = 0;
    
    for (const file of transfer.files) {
      try {
        console.log(`Processing file: ${file.originalname}, mimetype: ${file.mimetype}`);
        
        let resourceType = "auto";

        // 🔥 Force correct type for PDFs
        if (
          file.mimetype === "application/pdf" ||
          file.originalname.toLowerCase().endsWith(".pdf")
        ) {
          resourceType = "raw";
          console.log(`PDF detected, using resource_type: raw`);
        }

        const downloadUrl = cloudinary.url(file.public_id, {
          type: "upload",
          secure: true,
          flags: "attachment"
        });

        console.log("Downloading:", downloadUrl);

        const response = await axios({
          url: downloadUrl,
          method: "GET",
          responseType: "stream",
          maxRedirects: 5,
          timeout: 30000 // 30 second timeout
        });

        console.log(`Response status: ${response.status} for ${file.originalname}`);

        archive.append(response.data, { name: file.originalname });
        processedFiles++;
        console.log(`Successfully added: ${file.originalname}`);

      } catch (err) {
        skippedFiles++;
        console.error(`Error with ${file.originalname}:`, err.message);
        if (err.response) {
          console.error(`HTTP Status: ${err.response.status}`);
          console.error(`Response headers:`, err.response.headers);
        }
        console.error(`Full error:`, err);
      }
    }
    
    console.log(`Archive summary: ${processedFiles} files processed, ${skippedFiles} files skipped`);

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

export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the transfer containing this file
    const transfer = await Transfer.findOne({ 'files._id': id });
    
    if (!transfer) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Find the specific file
    const file = transfer.files.id(id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(file.public_id, {
        resource_type: 'auto',
        type: 'upload'
      });
    } catch (cloudinaryError) {
      console.error('Cloudinary deletion error:', cloudinaryError);
      // Continue with database deletion even if Cloudinary fails
    }
    
    // Remove file from transfer
    transfer.files.pull(id);
    
    // If no files left, delete the entire transfer
    if (transfer.files.length === 0) {
      await Transfer.deleteOne({ _id: transfer._id });
      return res.json({ 
        success: true, 
        message: 'File deleted and transfer removed (no files remaining)' 
      });
    }
    
    await transfer.save();
    
    res.json({ 
      success: true, 
      message: 'File deleted successfully',
      remainingFiles: transfer.files.length 
    });
    
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file', details: error.message });
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
