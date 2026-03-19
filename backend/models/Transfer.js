import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  mimetype: String,
  size: Number,
  url: String,        // Cloudinary url
  public_id: String   // Cloudinary public_id
});

const transferSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  files: [fileSchema],
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '0s' } // TTL expiry: document is automatically deleted
  },
  password: {
    type: String,
    required: false
  },
  downloadsCount: {
    type: Number,
    default: 0
  },
  maxDownloads: {
    type: Number,
    default: 100 // Set an upper limit on downloads to prevent abuse
  }
}, { timestamps: true });

export default mongoose.model('Transfer', transferSchema);
