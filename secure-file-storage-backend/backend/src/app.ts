import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import fileRoutes from "./routes/file.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

// Trust proxy for production environments
app.set("trust proxy", 1);

// Debug logging for startup configuration
console.log('[Server] Starting with CORS configuration:');
console.log('[Server] CLIENT_ORIGIN:', env.CLIENT_ORIGIN);
console.log('[Server] NODE_ENV:', env.NODE_ENV);

// Security middleware configuration
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

// CORS configuration with dynamic origin validation
app.use(
  cors({
    origin: (origin, callback) => {
      // Log incoming origin for debugging purposes
      console.log('[CORS] Incoming request origin:', origin);
      console.log('[CORS] Allowed origin from env:', env.CLIENT_ORIGIN);

      // Allow requests with no origin (server-to-server, mobile apps, curl)
      if (!origin) {
        console.log('[CORS] No origin provided, allowing');
        return callback(null, true);
      }

      // Handle wildcard or undefined client origin
      if (!env.CLIENT_ORIGIN || env.CLIENT_ORIGIN === '*') {
        console.log('[CORS] Wildcard origin allowed');
        return callback(null, true);
      }

      // Parse comma-separated origins for multiple environments
      const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim());
      console.log('[CORS] Allowed origins list:', allowedOrigins);

      // Validate origin against allowed list
      if (allowedOrigins.includes(origin)) {
        console.log('[CORS] Origin allowed:', origin);
        callback(null, true);
      } else {
        console.log('[CORS] Origin blocked:', origin);
        callback(new Error(`CORS policy: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Allow-Origin',
    ],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400, // Cache preflight requests for 24 hours
  })
);

// Compression middleware for response optimization
app.use(compression());

// Request logging middleware
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Cookie parsing middleware
app.use(cookieParser());

// JSON body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global rate limiting to prevent abuse
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  limit: 300, // 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cors: {
      origin: env.CLIENT_ORIGIN,
      allowed: true,
    },
  });
});

// Test endpoint to verify API is reachable
app.get('/api/test', (_req, res) => {
  res.status(200).json({
    message: 'Backend API is reachable',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: env.NODE_ENV,
      clientOrigin: env.CLIENT_ORIGIN,
      databaseConfigured: !!env.DATABASE_URL,
      jwtConfigured: !!env.JWT_ACCESS_SECRET && !!env.JWT_REFRESH_SECRET,
    },
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Error handling middleware (must be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
