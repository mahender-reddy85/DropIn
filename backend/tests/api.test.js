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
      files: []
    });
    const res = await request(app).get('/api/info/VALID123');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('VALID123');
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
});
