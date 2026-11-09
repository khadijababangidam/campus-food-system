/**
 * Express app configuration — assembled here and imported by server.js
 * (and by tests, which can import the app without binding a port).
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);

// Security headers (NFR: Security)
// Bootstrap and its icon font are vendored locally under public/shared/vendor
// (see public/shared/vendor/), so everything loads from 'self' — no CDN hosts needed.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));

app.use(cors());

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing. `verify` stashes the raw bytes on req.rawBody alongside
// the parsed req.body — needed only by the Paystack webhook route, which
// must validate a signature computed over the raw, unparsed body. Every
// other route just uses the normal parsed req.body and ignores rawBody.
app.use(express.json({
  limit: '10kb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Rate limiting on the whole API — mitigates brute force / abuse (NFR: Security).
// Skipped outside production: local dev has multiple dashboards auto-polling
// every 15s plus manual testing, which burns through a small request budget
// in minutes and isn't the abuse scenario this guards against.
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});
app.use('/api', apiLimiter);

// Static frontend
app.use(express.static('public'));

// Redirect root URL to the shared login page instead of showing "Cannot GET /"
app.get('/', (req, res) => {
  res.redirect('/shared/login.html');
});

// API routes
app.use('/api/v1', routes);

// Health check — useful for deployment/monitoring
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// 404 for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Centralized error handling — must be last
app.use(errorHandler);

module.exports = app;
