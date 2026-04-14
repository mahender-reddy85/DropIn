import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import mongoose from "mongoose";

const PORT = process.env.PORT || 3001;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

// Configure Mongoose
mongoose.set('bufferCommands', false);

const startServer = async () => {
  try {
    if (!mongoUri) {
      throw new Error("MONGO_URI or MONGODB_URI is not defined in environment variables! Please check your Render environment settings.");
    }

    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`🚀 DropIn backend is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    if (err.message.includes('whitelist')) {
      console.error("👉 Tip: Make sure your IP is whitelisted in MongoDB Atlas (try 0.0.0.0/0 for testing).");
    }
    // Exit process so Render knows the service failed to start
    process.exit(1);
  }
};

startServer();
