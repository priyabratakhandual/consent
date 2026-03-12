import express from 'express';
import config from './config/index.js';
import routes from './routes/index.js';
import {
  helmetMiddleware,
  corsMiddleware,
  rateLimiter,
  sanitizeMiddleware,
} from './middleware/security.js';
import requestLogger from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// Trust first proxy (e.g. nginx, load balancer) so X-Forwarded-For is used for rate limiting and req.ip
app.set('trust proxy', 1);

// Security & parsing
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(sanitizeMiddleware);
app.use(rateLimiter);

// Request logging
app.use(requestLogger);

// API routes
app.use('/api', routes);

// Root redirect to health
app.get('/', (req, res) => res.redirect('/api/health'));

// 404 and error handler (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
