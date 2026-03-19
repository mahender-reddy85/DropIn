import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  public_id: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  deleteAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  }
});

const transferSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  files: [fileSchema],
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: true }, // 24 hours
  password: { type: String },
  maxDownloads: { type: Number, default: 10 },
  downloadsCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// TTL index for automatic deletion after expiry
transferSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// TTL index for individual file deletion after 7 days
fileSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Transfer', transferSchema);
