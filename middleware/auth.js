const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

/**
 * Authentication middleware
 * 
 * Extracts JWT token from the Authorization header,
 * verifies it, and attaches the user data to the request.
 * 
 * @param {Array} roles - Array of allowed roles for this route
 */
const auth = (roles = []) => {
  // Convert string to array if only one role is provided
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    try {
      // Get token from Authorization header
      const authHeader = req.header('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. No token provided'
        });
      }

      // Extract token (remove 'Bearer ' prefix)
      const token = authHeader.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user role is authorized for this route
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to access this resource'
        });
      }

      // Attach user info to request object
      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false, 
          message: 'Token expired'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false, 
          message: 'Invalid token'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Authentication error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Verifies JWT token without role checking
 * Use this for routes that only require authentication, not specific role
 */
const verifyToken = auth();

/**
 * Middleware for customer-only routes
 */
const isCustomer = auth('customer');

/**
 * Middleware for retailer-only routes
 */
const isRetailer = auth('retailer');

/**
 * Middleware for admin-only routes
 */
const isAdmin = auth('admin');

/**
 * Rate limiting middleware for API protection
 * Default: 100 requests per 15 minutes
 * 
 * @param {Number} max - Maximum number of requests allowed within window
 * @param {Number} windowMs - Time window in milliseconds
 * @param {String} message - Custom message for rate limit exceeded
 */
const apiRateLimit = (max = 100, windowMs = 15 * 60 * 1000, message = 'Too many requests, please try again later') => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
    message: {
      success: false,
      message
    }
  });
};

module.exports = {
  auth,
  verifyToken,
  isCustomer,
  isRetailer,
  isAdmin,
  apiRateLimit
};
