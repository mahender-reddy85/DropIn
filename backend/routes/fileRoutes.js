import express from 'express';
import { uploadFiles, getFilesInfo, downloadFile, deleteTransfer, extendExpiry } from '../controllers/fileController.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.post('/upload', upload.array('files'), uploadFiles);
router.get('/info/:code', getFilesInfo);
router.post('/info/:code', getFilesInfo); // Allow POST for password body check
router.get('/download/:code/:filename', downloadFile);
router.delete('/transfers/:code', deleteTransfer);
router.put('/transfers/:code/extend', extendExpiry);

export default router;
