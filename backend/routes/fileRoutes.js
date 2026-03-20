import express from 'express';
import { uploadFiles, getFilesInfo, downloadFile, downloadAllFiles, deleteFile, deleteTransfer, extendExpiry } from '../controllers/fileController.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.post('/upload', upload.array('files'), uploadFiles);
router.get('/info/:code', getFilesInfo);
router.get('/download/:code/:filename', downloadFile);
router.get('/download/:code', downloadAllFiles);
router.delete('/file/:id', deleteFile);
router.delete('/transfers/:code', deleteTransfer);
router.put('/transfers/:code/extend', extendExpiry);

export default router;
