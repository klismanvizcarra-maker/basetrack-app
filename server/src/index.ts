import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database/db.js';
import { seed } from './database/seed.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup to allow Angular frontend and local network devices
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl or server-to-server)
    if (!origin) return callback(null, true);
    
    // Allow localhost, 127.0.0.1, local private network IPs (192.168.x, 10.x, 172.x) and Vercel domains
    const isLocalOrNetwork = /^(http:\/\/localhost(:\d+)?|http:\/\/127\.0\.0\.1(:\d+)?|http:\/\/192\.168\.\d+\.\d+(:\d+)?|http:\/\/10\.\d+\.\d+\.\d+(:\d+)?|https:\/\/.*\.vercel\.app)$/.test(origin);
    if (isLocalOrNetwork || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('CORS no permitido para este origen'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser with 15MB limit for maintenance inspection photos
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Initialize database schema and verify seed
initDatabase();
seed();

// Register API Routes
app.use('/api', apiRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    app: 'BASETRACK Industrial Monitoring Platform',
    version: '1.0.0',
    status: 'ACTIVE',
    endpoints: '/api/dashboard/metrics, /api/auth, /api/pumps, /api/cyclones, /api/tailings, /api/shift-handover, /api/maintenance, /api/admin'
  });
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  BASETRACK BACKEND API SERVER RUNNING ON PORT ${PORT} `);
  console.log(`  Health: http://localhost:${PORT}/api/health          `);
  console.log(`  Metrics: http://localhost:${PORT}/api/dashboard/metrics`);
  console.log(`=======================================================`);
});
