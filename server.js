// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
// const morgan = require('morgan');
// const swaggerUi = require('swagger-ui-express');


// dotenv.config();

// process.on('uncaughtException', (err) => {
//   console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
//   console.error(`${err.name}: ${err.message}`);
//   console.error(err.stack);
//   process.exit(1);
// });


// const app = express();


// app.use(helmet()); 


// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, 
//   max: 100, 
//   message: {
//     success: false,
//     message: 'Too many requests from this IP, please try again after 15 minutes'
//   }
// });

// app.use(limiter);

// const corsOptions = {
//   origin: process.env.NODE_ENV === 'production' 
//     ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://nearmart.com'] 
//     : '*',
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true,
//   maxAge: 86400 
// };

// app.use(cors(corsOptions));
// app.use(express.json({ limit: '1mb' }));
// app.use(express.urlencoded({ extended: true }));

// app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));


// const API_PREFIX = '/api/v1';


// const swaggerSpec = require('./docs/swagger');
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
//   explorer: true,
//   customCss: '.swagger-ui .topbar { display: none }',
//   customSiteTitle: 'NearMart API Documentation',
//   swaggerOptions: {
//     persistAuthorization: true,
//   }
// }));

// app.get('/api-docs.json', (req, res) => {
//   res.setHeader('Content-Type', 'application/json');
//   res.send(swaggerSpec);
// });

// console.log(`API Documentation available at http://localhost:${process.env.PORT || 3000}/api-docs`);

// app.get('/', (req, res) => {
//   res.status(200).json({ 
//     success: true,
//     message: 'NearMart API is running',
//     version: '1.0.0',
//     timestamp: new Date(),
//     environment: process.env.NODE_ENV
//   });
// });

// app.get('/api/health', (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: 'OK',
//     services: {
//       database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
//       api: 'available'
//     },
//     uptime: Math.floor(process.uptime()) + ' seconds'
//   });
// });
// const connectDB = async (retryCount = 0, maxRetries = 5) => {
//   try {
//     console.log('Attempting to connect to MongoDB...');
    
//     await mongoose.connect(process.env.MONGODB_URI, {
//       autoIndex: true,
//       maxPoolSize: 10, 
//       serverSelectionTimeoutMS: 5000,
//       socketTimeoutMS: 45000, 
//       family: 4
//     });
    
//     console.log('Connected to MongoDB successfully');
//     return true;
//   } catch (error) {
//     console.error('MongoDB connection error:', error.message);
    
//     if (retryCount < maxRetries) {
//       console.log(`Retrying connection (${retryCount + 1}/${maxRetries})...`);
    
//       const waitTime = Math.min(1000 * 2 ** retryCount, 10000);
//       await new Promise(resolve => setTimeout(resolve, waitTime));
//       return connectDB(retryCount + 1, maxRetries);
//     } else {
//       console.error('Maximum connection retries reached. Could not connect to MongoDB.');
//       return false;
//     }
//   }
// };

// (async () => {

//   const connected = await connectDB();
  
//   if (connected) {
//     console.log('Attempting to start the server...');
    
//     try {
//       console.log('Setting up database indexes...');
 
//       const Retailer = require('./models/Retailer');
//       await Retailer.setupIndexes();
//     } catch (error) {
//       console.error('Error setting up database indexes:', error);

//     }
    

//   } else {
//     console.error('MongoDB connection failed, server will not start.');

//   }
// })();

// mongoose.connection.on('connected', () => {
//   console.log('Mongoose connected to MongoDB');
// });

// mongoose.connection.on('error', (err) => {
//   console.error('Mongoose connection error:', err.message);
// });

// mongoose.connection.on('disconnected', () => {
//   console.log('Mongoose disconnected from MongoDB');
// });

// const gracefulShutdown = async (signal) => {
//   console.log(`${signal} signal received: closing HTTP server and MongoDB connection`);
  
//   try {
 
//     if (mongoose.connection.readyState === 1) {
//       await mongoose.connection.close();
//       console.log('MongoDB connection closed');
//     }
    
//     server.close(() => {
//       console.log('HTTP server closed');
//       process.exit(0);
//     });
    
//     setTimeout(() => {
//       console.error('Could not close connections in time, forcefully shutting down');
//       process.exit(1);
//     }, 10000);
    
//   } catch (error) {
//     console.error('Error during graceful shutdown:', error);
//     process.exit(1);
//   }
// };

// process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// const retailerRoutes = require('./routes/retailer');
// const customerRoutes = require('./routes/customer');

// app.use(`${API_PREFIX}/retailer`, retailerRoutes);
// app.use(`${API_PREFIX}/customer`, customerRoutes);

// app.use((err, req, res, next) => {

//   console.error(`[ERROR] ${new Date().toISOString()}: ${err.stack}`);
  
//   if (err.name === 'ValidationError') {
  
//     return res.status(400).json({
//       success: false,
//       message: 'Validation Error',
//       errors: Object.values(err.errors).map(e => e.message),
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
  
//   if (err.code === 11000) {

//     return res.status(400).json({
//       success: false,
//       message: 'Duplicate field value entered',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
  
//   if (err.name === 'JsonWebTokenError') {
//     return res.status(401).json({
//       success: false,
//       message: 'Invalid token',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
  
//   if (err.name === 'TokenExpiredError') {
//     return res.status(401).json({
//       success: false,
//       message: 'Token expired',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
  

//   const statusCode = err.statusCode || 500;
//   res.status(statusCode).json({
//     success: false,
//     message: err.message || 'Internal Server Error',
//     error: process.env.NODE_ENV === 'development' ? err.stack : undefined
//   });
// });

// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: `Route not found: ${req.method} ${req.originalUrl}`
//   });
// });

// const PORT = process.env.PORT || 3000;
// console.log('Attempting to start the server...');
// const server = app.listen(PORT, () => {
//   console.log(`Server running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}/`);
//   console.log(`API available at http://localhost:${PORT}${API_PREFIX}`);
//   console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
// });

// process.on('unhandledRejection', (err) => {
//   console.error('UNHANDLED REJECTION! 💥 Shutting down...');
//   console.error(`${err.name}: ${err.message}`);
//   console.error(err.stack);

//   server.close(() => {
//     process.exit(1);
//   });
// });

// module.exports = app;

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

let server; // ✅ Declare server in global scope for use in gracefulShutdown()

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(`${err.name}: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

const app = express();

// Security headers
app.use(helmet());

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});
app.use(limiter);

// CORS settings
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://nearmart.com']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// API Prefix
const API_PREFIX = '/api/v1';

// Swagger setup
const swaggerSpec = require('./docs/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'NearMart API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
  }
}));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Root & health endpoints
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

// MongoDB connection logic
const connectDB = async (retryCount = 0, maxRetries = 5) => {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });
    console.log('Connected to MongoDB successfully');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    if (retryCount < maxRetries) {
      console.log(`Retrying connection (${retryCount + 1}/${maxRetries})...`);
      const waitTime = Math.min(1000 * 2 ** retryCount, 10000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return connectDB(retryCount + 1, maxRetries);
    } else {
      console.error('Maximum connection retries reached.');
      return false;
    }
  }
};

// Mongo events
mongoose.connection.on('connected', () => console.log('Mongoose connected to MongoDB'));
mongoose.connection.on('error', err => console.error('Mongoose connection error:', err.message));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} signal received: closing HTTP server and MongoDB connection`);
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// API routes
const retailerRoutes = require('./routes/retailer');
const customerRoutes = require('./routes/customer');
app.use(`${API_PREFIX}/retailer`, retailerRoutes);
app.use(`${API_PREFIX}/customer`, customerRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()}: ${err.stack}`);
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  if (err.code === 11000) {
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

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Start server after DB connection
(async () => {
  const connected = await connectDB();
  if (connected) {
  //   try {
  //     console.log('Setting up database indexes...');
  //     const Retailer = require('./models/Retailer');
  //     await Retailer.setupIndexes();
  //   } catch (error) {
  //     console.error('Error setting up database indexes:', error);
  //   }

    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}/`);
      console.log(`API available at http://localhost:${PORT}/api/health`);
      console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  } else {
    console.error('MongoDB connection failed, server will not start.');
  }
})();

// Unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(`${err.name}: ${err.message}`);
  console.error(err.stack);
  server?.close(() => process.exit(1));
});

module.exports = app;
