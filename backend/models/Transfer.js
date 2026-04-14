import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  public_id: { type: String, required: true },
  resourceType: { type: String, default: 'raw' }, // Not required to support legacy records
  uploadedAt: { type: Date, default: Date.now },
  deleteAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  }
});

const transferSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  files: [fileSchema],
  expiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), 
    index: { expires: 0 } 
  }, // 24 hours
  password: { type: String },
  maxDownloads: { type: Number, default: 100 },
  downloadsCount: { type: Number, default: 0 },
  isDownloaded: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Transfer', transferSchema);
