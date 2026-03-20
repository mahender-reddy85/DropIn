import request from 'supertest';
import app from '../app.js';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import Transfer from '../models/Transfer.js';
import cloudinary from '../config/cloudinary.js';

describe('API Tests', () => {
  afterAll(() => {
    jest.clearAllMocks();
    mongoose.connection.close(); // just to be safe
  });

  test('1. Health check returns 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  test('2. Upload without files returns 400', async () => {
    const res = await request(app).post('/api/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No files uploaded');
  });

  test('3. Fetch info for non-existent code returns 404', async () => {
    jest.spyOn(Transfer, 'findOne').mockResolvedValueOnce(null);
    const res = await request(app).get('/api/info/INVALID123');
    expect(res.status).toBe(404);
  });

  test('4. Fetch info for valid code returns files list', async () => {
    jest.spyOn(Transfer, 'findOne').mockResolvedValueOnce({
      code: 'VALID123',
      expiresAt: new Date(),
      downloadsCount: 0,
      isDownloaded: false,
      files: []
    });
    const res = await request(app).get('/api/info/VALID123');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('VALID123');
    expect(res.body).toHaveProperty('isDownloaded');
  });

  test('5. Extend expiry works properly', async () => {
    const mockSave = jest.fn();
    jest.spyOn(Transfer, 'findOne').mockResolvedValueOnce({
      code: 'VALID123',
      expiresAt: new Date(),
      save: mockSave
    });
    const res = await request(app).put('/api/transfers/VALID123/extend');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });

  test('6. Bulk download for non-existent code returns 404', async () => {
    jest.spyOn(Transfer, 'findOne').mockResolvedValueOnce(null);
    const res = await request(app).get('/api/download/INVALID123');
    expect(res.status).toBe(404);
  });

  test('7. Bulk download for valid code returns ZIP', async () => {
    jest.spyOn(Transfer, 'findOne').mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(),
      code: 'VALID123',
      expiresAt: new Date(),
      downloadsCount: 0,
      files: [{
        filename: 'test.pdf',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        public_id: 'test_pdf'
      }]
    });
    jest.spyOn(Transfer, 'updateOne').mockResolvedValueOnce({ nModified: 1 });
    const res = await request(app).get('/api/download/VALID123');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
  });

  test('8. Delete transfer for valid code works', async () => {
    jest.spyOn(Transfer, 'findOne').mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(),
      code: 'VALID123',
      files: []
    });
    jest.spyOn(Transfer, 'deleteOne').mockResolvedValueOnce({ deletedCount: 1 });
    const res = await request(app).delete('/api/transfers/VALID123');
    expect(res.status).toBe(200);
  });
});
