// Import required dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

// Load environment variables
dotenv.config();

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(`${err.name}: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet()); // Set security headers

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});

// Apply rate limiting to all routes
app.use(limiter);

// Configure CORS options
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://nearmart.com'] 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Configure Express middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// API version prefix
const API_PREFIX = '/api/v1';

// Swagger documentation setup
const swaggerSpec = require('./docs/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'NearMart API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
  }
}));

// Expose swagger.json endpoint for external documentation tools
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

console.log(`API Documentation available at http://localhost:${process.env.PORT || 3000}/api-docs`);

// Define health check routes
app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: 'NearMart API is running',
    version: '1.0.0',
    timestamp: new Date(),
    environment: process.env.NODE_ENV
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'OK',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      api: 'available'
    },
    uptime: Math.floor(process.uptime()) + ' seconds'
  });
});

// Configure MongoDB connection
const connectDB = async (retryCount = 0, maxRetries = 5) => {
  try {
    console.log('Attempting to connect to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: true, // Build indexes
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    });
    
    console.log('Connected to MongoDB successfully');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    
    if (retryCount < maxRetries) {
      console.log(`Retrying connection (${retryCount + 1}/${maxRetries})...`);
      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(1000 * 2 ** retryCount, 10000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return connectDB(retryCount + 1, maxRetries);
    } else {
      console.error('Maximum connection retries reached. Could not connect to MongoDB.');
      return false;
    }
  }
};

// Connect to MongoDB and start server only if connection is successful
// This is an IIFE (Immediately Invoked Function Expression)
(async () => {
  // Try to connect to MongoDB
  const connected = await connectDB();
  
  // Only start the server if MongoDB connection is successful
  if (connected) {
    console.log('Attempting to start the server...');
    
    // Set up model indexes to fix any database issues
    try {
      console.log('Setting up database indexes...');
      // Import models and run index setup
      const Retailer = require('./models/Retailer');
      await Retailer.setupIndexes();
    } catch (error) {
      console.error('Error setting up database indexes:', error);
      // Continue anyway - the application might still work
    }
    
    // Continue with server setup
  } else {
    console.error('MongoDB connection failed, server will not start.');
    // Do not exit process - this allows for development environments to continue
    // In a production environment, you would typically want this to exit or restart
  }
})();

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// Gracefully close the MongoDB connection when the app is terminated
// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} signal received: closing HTTP server and MongoDB connection`);
  
  try {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) { // 1 = connected
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
    
    // Close HTTP server
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
    
    // Force close if it takes too long
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Import routes
const retailerRoutes = require('./routes/retailer');
const customerRoutes = require('./routes/customer');

// Use routes with API prefix
app.use(`${API_PREFIX}/retailer`, retailerRoutes);
app.use(`${API_PREFIX}/customer`, customerRoutes);

// Centralized error handling middleware
app.use((err, req, res, next) => {
  // Log error
  console.error(`[ERROR] ${new Date().toISOString()}: ${err.stack}`);
  
  // Custom error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  if (err.code === 11000) {
    // MongoDB duplicate key error
    return res.status(400).json({
      success: false,
      message: 'Duplicate field value entered',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Handle 404 errors for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Configure port and start server
const PORT = process.env.PORT || 3000;
console.log('Attempting to start the server...');
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}/`);
  console.log(`API available at http://localhost:${PORT}${API_PREFIX}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(`${err.name}: ${err.message}`);
  console.error(err.stack);
  // Gracefully close server before exiting
  server.close(() => {
    process.exit(1);
  });
});

// Export app for testing purposes
module.exports = app;

