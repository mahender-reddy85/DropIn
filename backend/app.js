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

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // limit each IP to 50 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

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
