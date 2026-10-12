import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './database/db.js';
import { seed } from './database/seed.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { initWebSocketServer } from './websocket/ws.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup to allow Angular frontend, mobile PWAs and local network devices
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Security Headers Middleware (OWASP Defense in Depth)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
});

// In-memory rate limiter for authentication to protect against brute-force attacks
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const loginRateLimits = new Map<string, RateLimitRecord>();

const authRateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxAttempts = 20; // 20 attempts per 5 minutes

  const record = loginRateLimits.get(ip);
  if (!record || now > record.resetAt) {
    loginRateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  record.count++;
  if (record.count > maxAttempts) {
    const waitSec = Math.ceil((record.resetAt - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `Demasiados intentos de autenticación. Por motivos de seguridad, espere ${waitSec} segundos antes de reintentar.`
    });
  }

  next();
};

app.use('/api/auth/login', authRateLimiter);

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

// In production or Docker: serve compiled Angular SPA if dist directory is present
const clientDistCandidates = [
  process.env.CLIENT_DIST_PATH,
  path.resolve(__dirname, '../../dist/frontend-temp/browser'),
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, './public')
].filter(Boolean) as string[];

const activeDistPath = clientDistCandidates.find(p => fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html')));

if (activeDistPath) {
  console.log(`[Static] Serving Angular frontend from: ${activeDistPath}`);
  app.use(express.static(activeDistPath));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(activeDistPath, 'index.html'));
  });
} else {
  // Root route fallback when backend runs independently
  app.get('/', (req, res) => {
    res.json({
      app: 'BASETRACK Industrial Monitoring Platform',
      version: '1.0.0',
      status: 'ACTIVE',
      endpoints: '/api/dashboard/metrics, /api/auth, /api/pumps, /api/cyclones, /api/tailings, /api/shift-handover, /api/maintenance, /api/admin'
    });
  });
}

// Error handling middleware
app.use(errorHandler);

const server = http.createServer(app);
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  BASETRACK BACKEND API SERVER RUNNING ON PORT ${PORT} `);
  console.log(`  Health: http://localhost:${PORT}/api/health          `);
  console.log(`  Metrics: http://localhost:${PORT}/api/dashboard/metrics`);
  console.log(`  WebSocket: ws://localhost:${PORT}/ws                 `);
  console.log(`=======================================================`);
});
