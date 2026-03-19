import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import mongoose from "mongoose";

const PORT = process.env.PORT || 3001;

// Start server
app.listen(PORT, () => {
  console.log(`✅ DropIn backend is running on port ${PORT}`);
});

// Use exact pattern for DB requested
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));
