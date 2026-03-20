import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xssParse from 'xss-clean';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import fileRoutes from './routes/fileRoutes.js';

const app = express();

// Enable trust proxy if behind a reverse proxy like Render or Vercel
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet());
app.use(cors({ origin: '*' }));

// General API limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: 'Too many general API requests, please try again in 15 minutes.' }
});
app.use('/api', limiter);

// Specific limiter for uploads (stricter)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 uploads per window
  message: { error: 'Upload limit reached (5 per 15 mins). Please wait.' }
});

// Specific limiter for info/downloads (to prevent brute forcing codes)
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: 'Download limit reached. Please try again later.' }
});

app.use('/api/upload', uploadLimiter);
app.use('/api/download', downloadLimiter);
app.use('/api/info', downloadLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xssParse());

// Logging
app.use(morgan('dev'));

// Routes
app.use('/api', fileRoutes);

app.get('/', (req, res) => {
  res.send('✅ DropIn API is running securely');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Server Error' });
});

export default app;
