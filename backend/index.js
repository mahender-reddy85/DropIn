import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import mongoose from "mongoose";

const PORT = process.env.PORT || 3001;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("❌ MONGO_URI or MONGODB_URI is not defined in environment variables!");
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ DropIn backend is running on port ${PORT}`);
});

// Configure Mongoose to fail fast if no connection
mongoose.set('bufferCommands', false);

// Connect to MongoDB
mongoose.connect(mongoUri)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("Please check if your IP is whitelisted in MongoDB Atlas and the MONGO_URI is correct.");
  });
