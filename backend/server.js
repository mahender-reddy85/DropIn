import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 3001;

// Connect to Database, then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ DropIn backend is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to database', err);
});
