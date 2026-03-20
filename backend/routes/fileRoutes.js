import express from 'express';
import { uploadFiles, getFilesInfo, downloadAllFiles, deleteTransfer, extendExpiry } from '../controllers/fileController.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.post('/upload', upload.array('files'), uploadFiles);
router.get('/info/:code', getFilesInfo);
router.get('/download/:code', downloadAllFiles);
router.delete('/transfers/:code', deleteTransfer);
router.put('/transfers/:code/extend', extendExpiry);

export default router;
