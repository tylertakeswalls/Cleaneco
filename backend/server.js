require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the reverse proxy (Render) so rate limiting uses the correct IP
app.set('trust proxy', 1);

// Middleware
// Set security HTTP headers
app.use(helmet({ 
  frameguard: false,
  contentSecurityPolicy: false
}));
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" })); // Allow images/resources to be served across origins if needed

// CORS Configuration
const allowedOrigins = [
  'https://cleaneco-kappa.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Generous limit for SPAs with real-time polling
  message: 'Too many requests from this IP, please try again after 15 minutes',
  skip: (req) => {
    // Prevent rate limiting from blocking local development or localhost polling
    const ip = req.ip || req.connection?.remoteAddress || '';
    return (
      process.env.NODE_ENV !== 'production' ||
      ip.includes('127.0.0.1') ||
      ip.includes('::1') ||
      ip.includes('localhost')
    );
  }
});
app.use('/api', limiter);

app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/payments/webhook') {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const ordersRoutes = require('./routes/orders');
const notificationsRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');
const usersRoutes = require('./routes/users');
const reportsRoutes = require('./routes/reports');
const paymentsRoutes = require('./routes/payments');
const contactRoutes = require('./routes/contact');
const unavailableDatesRoutes = require('./routes/unavailableDates');
const messagesRoutes = require('./routes/messages');

app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/unavailable-dates', unavailableDatesRoutes);
app.use('/api/messages', messagesRoutes);

// Error Handling Middleware (must be after all routes)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Cleaneco API is running' });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');

  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
