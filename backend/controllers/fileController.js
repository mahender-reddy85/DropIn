import Transfer from '../models/Transfer.js';
import cloudinary from '../config/cloudinary.js';
import { nanoid } from 'nanoid';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import archiver from 'archiver';

// Clean up temporary local files after uploading or on error
const cleanupLocalFiles = (files) => {
  if (!files || !Array.isArray(files)) return;
  files.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error('Failed to delete local file:', file.path, err.message);
      }
    }
  });
};

// Helper to determine Cloudinary resource type for legacy records or before DB save
const getResourceType = (mimetype, originalname) => {
  const name = (originalname || '').toLowerCase();
  const mime = (mimetype || '').toLowerCase();
  if (mime.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.avi')) {
    return 'video';
  }
  if (mime.startsWith('audio/') || name.endsWith('.mp3') || name.endsWith('.wav')) {
    return 'video'; // Cloudinary treats audio as video resource type
  }
  if (mime.startsWith('image/')) {
    return 'image';
  }
  // PDFs, Zips, and others go as raw
  return 'raw';
};

export const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log('Processing upload request with files:', req.files.map(f => ({
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size
    })));

    // Test Cloudinary configuration
    try {
      console.log('Testing Cloudinary configuration...');
      const testResult = await cloudinary.api.ping();
      console.log('Cloudinary ping successful:', testResult);
    } catch (pingError) {
      console.error('Cloudinary configuration error:', pingError);
      return res.status(500).json({ error: 'Cloudinary configuration error', details: pingError.message });
    }

    // Validate expiration input
    let hours = 1;
    if (req.body.expiration) {
      const expHours = parseInt(req.body.expiration);
      if (isNaN(expHours) || expHours < 1 || expHours > 168) { // Max 7 days
        return res.status(400).json({ error: 'Expiration must be between 1 and 168 hours' });
      }
      hours = expHours;
    }

    const uploadedFiles = [];

    // Upload each to cloudinary with consistent public access
    for (const file of req.files) {
      let resourceType = 'auto'; // Declare here to be accessible in catch block
      
      try {
        // Check if file exists before uploading
        if (!fs.existsSync(file.path)) {
          console.error('File does not exist:', file.path);
          continue;
        }
        
        console.log('Attempting to upload file:', file.path);

        let result;
        try {
          // Try file path upload first
          result = await cloudinary.uploader.upload(file.path, {
            resource_type: 'auto'
          });
        } catch (pathError) {
          console.error('File path upload failed, trying buffer upload:', pathError.message);
          
          // Fallback to buffer upload
          const fileBuffer = fs.readFileSync(file.path);
          result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { resource_type: 'auto' },
              (error, uploadResult) => {
                if (error) reject(error);
                else resolve(uploadResult);
              }
            );
            uploadStream.end(fileBuffer);
          });
        }

        uploadedFiles.push({
          filename: result.public_id,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: result.secure_url,
          public_id: result.public_id,
          resourceType: result.resource_type,
          uploadedAt: new Date(),
          deleteAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        });
        console.log(`Successfully uploaded: ${file.originalname}`);
      } catch (uploadError) {
        console.error('Error uploading file:', file.originalname, uploadError);
        console.error('File details:', {
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          resourceType: resourceType
        });
        console.error('Cloudinary error details:', {
          message: uploadError.message,
          name: uploadError.name,
          http_code: uploadError.http_code
        });
        // Continue with other files instead of failing completely
        continue;
      }
    }

    // Cleanup local uploads
    cleanupLocalFiles(req.files);

    // Check if any files were successfully uploaded
    console.log(`Upload summary: ${uploadedFiles.length} successful, ${req.files.length - uploadedFiles.length} failed`);
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No files could be uploaded successfully' });
    }

    const code = nanoid(8); // 8 characters for easier sharing as requested
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
    console.error('Upload Error:', error.message);
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

    const resourceType = file.resourceType || getResourceType(file.mimetype, file.originalname);

    const downloadUrl = cloudinary.url(file.public_id, {
      resource_type: resourceType,
      type: 'upload',
      secure: true,
      flags: 'attachment'
    });

    // Redirect to proper Cloudinary URL
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.redirect(302, downloadUrl);

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
      let resourceType = 'raw'; // Declare before try block for catch scope
      try {
        resourceType = file.resourceType || getResourceType(file.mimetype, file.originalname);

        const downloadUrl = cloudinary.url(file.public_id, {
          resource_type: resourceType,
          type: "upload",
          secure: true,
          flags: "attachment"
        });

        const response = await axios({
          url: downloadUrl,
          method: "GET",
          responseType: "stream",
          maxRedirects: 5,
          timeout: 30000 // 30 second timeout
        });

        archive.append(response.data, { name: file.originalname });
        processedFiles++;

      } catch (err) {
        skippedFiles++;
        console.error(`Error with ${file.originalname} (type: ${file.mimetype}):`, err.message);
        console.error('File details:', {
          public_id: file.public_id,
          mimetype: file.mimetype,
          resourceTypeDetected: resourceType
        });
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
      const resourceType = getResourceType(file.mimetype, file.originalname);
      await cloudinary.uploader.destroy(file.public_id, {
        resource_type: resourceType,
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

      await Promise.allSettled(transfer.files.map(file => {
        if (file.public_id) {
          const resType = file.resourceType || getResourceType(file.mimetype, file.originalname);
          return cloudinary.uploader.destroy(file.public_id, { resource_type: resType });
        }
        return Promise.resolve();
      }));

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
