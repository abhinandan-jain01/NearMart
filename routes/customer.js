const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const Customer = require('../models/Customer');
const Retailer = require('../models/Retailer');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

// Import middleware
const { isCustomer } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/customer/signup:
 *   post:
 *     summary: Register a new customer
 *     description: Creates a new customer account with the provided information
 *     tags: [Customer Authentication]
 *     security: []  # No security, this is a public endpoint
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - location
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *                 description: Customer's full name
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer's email address
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Customer's password
 *                 minLength: 6
 *                 example: securepassword
 *               phone:
 *                 type: string
 *                 description: Customer's phone number
 *                 example: "+1234567890"
 *               location:
 *                 $ref: '#/components/schemas/GeoJSONPoint'
 *               address:
 *                 $ref: '#/components/schemas/Address'
 *     responses:
 *       201:
 *         description: Customer registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Customer registered successfully
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 customer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60a1e2c7d32f1e2b3c4d5e6f
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *       400:
 *         description: Bad request - validation error or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingFields:
 *                 value:
 *                   success: false
 *                   message: Please provide all required fields
 *               invalidAddress:
 *                 value:
 *                   success: false
 *                   message: Please provide complete address information
 *               emailExists:
 *                 value:
 *                   success: false
 *                   message: Customer with this email already exists
 *               invalidLocation:
 *                 value:
 *                   success: false
 *                   message: Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   POST /api/customer/signup
// @desc    Register a new customer
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone, location, address } = req.body;

    // Basic validation
    if (!name || !email || !password || !location || !address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate address
    if (!address.street || !address.city || !address.state || !address.zipCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete address information'
      });
    }

    // Check if email already exists
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email already exists'
      });
    }

    // Validate location format
    if (!location.type || !location.coordinates || location.type !== 'Point' || 
        !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]'
      });
    }

    // Create new customer
    const customer = new Customer({
      name,
      email,
      password, // Will be hashed by pre-save hook
      phone,
      location,
      address
    });

    // Save customer to DB
    await customer.save();

    // Generate JWT token
    const token = customer.generateAuthToken();

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email
      }
    });
  } catch (error) {
    console.error('Customer signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/customer/orders:
 *   get:
 *     summary: Get customer order history
 *     description: Retrieves the authenticated customer's order history with pagination
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for pagination
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Number of orders per page
 *         default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, shipped, delivered, cancelled]
 *         description: Filter orders by status
 *     responses:
 *       200:
 *         description: Order history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of orders returned in this page
 *                   example: 2
 *                 totalOrders:
 *                   type: integer
 *                   description: Total number of orders
 *                   example: 5
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                   example: 3
 *                 currentPage:
 *                   type: integer
 *                   description: Current page number
 *                   example: 1
 *                 orders:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Order ID
 *                         example: 60a1e2c7d32f1e2b3c4d5e8h
 *                       orderNumber:
 *                         type: string
 *                         description: Readable order number
 *                         example: NM-202504-1001
 *                       status:
 *                         type: string
 *                         enum: [pending, processing, shipped, delivered, cancelled]
 *                         description: Order status
 *                         example: processing
 *                       total:
 *                         type: number
 *                         description: Order total
 *                         example: 35.98
 *                       itemCount:
 *                         type: integer
 *                         description: Number of items in order
 *                         example: 3
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Order creation date
 *                         example: 2023-05-15T10:30:00.000Z
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             productName:
 *                               type: string
 *                               example: Organic Apples
 *                             quantity:
 *                               type: integer
 *                               example: 2
 *                             price:
 *                               type: number
 *                               example: 2.99
 *                             retailerName:
 *                               type: string
 *                               example: Jane's Grocery
 *                       payment:
 *                         type: object
 *                         properties:
 *                           method:
 *                             type: string
 *                             enum: [credit_card, debit_card, paypal, cash_on_delivery]
 *                             example: credit_card
 *                           status:
 *                             type: string
 *                             enum: [pending, completed, failed, refunded]
 *                             example: completed
 *                       delivery:
 *                         type: object
 *                         properties:
 *                           address:
 *                             $ref: '#/components/schemas/Address'
 *                           expectedDeliveryDate:
 *                             type: string
 *                             format: date-time
 *                             example: 2023-05-18T17:00:00.000Z
 *                           actualDeliveryDate:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                             example: null
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   GET /api/customer/orders
// @desc    Get customer's order history
// @access  Private
router.get('/orders', isCustomer, async (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Find customer's orders
    const orders = await Order.find({ customer: req.user.id })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit);
    
    // Get total order count for pagination
    const totalOrders = await Order.countDocuments({ customer: req.user.id });
    
    res.json({
      success: true,
      count: orders.length,
      totalOrders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: page,
      orders: orders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        itemCount: order.itemCount,
        createdAt: order.createdAt,
        items: order.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          retailerName: item.retailerName
        })),
        payment: {
          method: order.payment.method,
          status: order.payment.status
        },
        delivery: {
          address: order.delivery.address,
          expectedDeliveryDate: order.delivery.expectedDeliveryDate,
          actualDeliveryDate: order.delivery.actualDeliveryDate
        }
      }))
    });
  } catch (error) {
    console.error('Get order history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/customer/profile:
 *   get:
 *     summary: Get customer profile
 *     description: Retrieves the authenticated customer's profile information
 *     tags: [Customer Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 customer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60a1e2c7d32f1e2b3c4d5e6f
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *                     phone:
 *                       type: string
 *                       example: "+1234567890"
 *                     address:
 *                       $ref: '#/components/schemas/Address'
 *                     location:
 *                       $ref: '#/components/schemas/GeoJSONPoint'
 *                     deliveryPreferences:
 *                       type: object
 *                       properties:
 *                         preferredTime:
 *                           type: string
 *                           enum: [morning, afternoon, evening, anytime]
 *                           example: evening
 *                         contactlessDelivery:
 *                           type: boolean
 *                           example: true
 *                         deliveryInstructions:
 *                           type: string
 *                           example: Leave at front door
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2023-05-15T10:30:00.000Z
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: No token, authorization denied
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Customer not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Server error
 */
// @route   GET /api/customer/profile
// @desc    Get customer profile
// @access  Private
router.get('/profile', isCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        location: customer.location,
        deliveryPreferences: customer.deliveryPreferences,
        createdAt: customer.createdAt
      }
    });
  } catch (error) {
    console.error('Get customer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/customer/profile:
 *   put:
 *     summary: Update customer profile
 *     description: Update the authenticated customer's profile information
 *     tags: [Customer Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Customer's full name
 *                 example: John Smith
 *               phone:
 *                 type: string
 *                 description: Customer's phone number
 *                 example: "+1987654321"
 *               address:
 *                 $ref: '#/components/schemas/Address'
 *               location:
 *                 $ref: '#/components/schemas/GeoJSONPoint'
 *               deliveryPreferences:
 *                 type: object
 *                 properties:
 *                   preferredTime:
 *                     type: string
 *                     enum: [morning, afternoon, evening, anytime]
 *                     description: Preferred delivery time of day
 *                     example: evening
 *                   contactlessDelivery:
 *                     type: boolean
 *                     description: Whether contactless delivery is preferred
 *                     example: true
 *                   deliveryInstructions:
 *                     type: string
 *                     description: Special delivery instructions
 *                     example: Call when arriving
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profile updated successfully
 *                 customer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60a1e2c7d32f1e2b3c4d5e6f
 *                     name:
 *                       type: string
 *                       example: John Smith
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *                     phone:
 *                       type: string
 *                       example: "+1987654321"
 *                     address:
 *                       $ref: '#/components/schemas/Address'
 *                     location:
 *                       $ref: '#/components/schemas/GeoJSONPoint'
 *                     deliveryPreferences:
 *                       type: object
 *                       properties:
 *                         preferredTime:
 *                           type: string
 *                           example: evening
 *                         contactlessDelivery:
 *                           type: boolean
 *                           example: true
 *                         deliveryInstructions:
 *                           type: string
 *                           example: Call when arriving
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidAddress:
 *                 value:
 *                   success: false
 *                   message: Please provide complete address information
 *               invalidLocation:
 *                 value:
 *                   success: false
 *                   message: Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]
 *               invalidPreferredTime:
 *                 value:
 *                   success: false
 *                   message: Invalid preferred time. Must be one of - morning, afternoon, evening, anytime
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: No token, authorization denied
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Customer not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Server error
 */
// @route   PUT /api/customer/profile
// @desc    Update customer profile
// @access  Private
router.put('/profile', isCustomer, async (req, res) => {
  try {
    const { name, phone, address, location, deliveryPreferences } = req.body;
    
    // Find customer
    const customer = await Customer.findById(req.user.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Update fields if provided
    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    
    // Update address if provided
    if (address) {
      // Validate address
      if (!address.street || !address.city || !address.state || !address.zipCode) {
        return res.status(400).json({
          success: false,
          message: 'Please provide complete address information'
        });
      }
      customer.address = address;
    }
    
    // Update location if provided
    if (location) {
      // Validate location format
      if (!location.type || !location.coordinates || location.type !== 'Point' || 
          !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]'
        });
      }
      customer.location = location;
    }
    
    // Update delivery preferences if provided
    if (deliveryPreferences) {
      if (deliveryPreferences.preferredTime) {
        if (!['morning', 'afternoon', 'evening', 'anytime'].includes(deliveryPreferences.preferredTime)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid preferred time. Must be one of: morning, afternoon, evening, anytime'
          });
        }
        customer.deliveryPreferences.preferredTime = deliveryPreferences.preferredTime;
      }
      
      if (deliveryPreferences.contactlessDelivery !== undefined) {
        customer.deliveryPreferences.contactlessDelivery = deliveryPreferences.contactlessDelivery;
      }
      
      if (deliveryPreferences.deliveryInstructions !== undefined) {
        customer.deliveryPreferences.deliveryInstructions = deliveryPreferences.deliveryInstructions;
      }
    }
    
    // Save updated customer
    await customer.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        location: customer.location,
        deliveryPreferences: customer.deliveryPreferences
      }
    });
  } catch (error) {
    console.error('Update customer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

/**
 * @swagger
 * /api/v1/customer/stores/{id}/products:
 *   get:
 *     summary: Get store products
 *     description: Get all products from a specific store/retailer with filtering and pagination
 *     tags: [Stores, Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Retailer/Store ID
 *         example: 60a1e2c7d32f1e2b3c4d5e6f
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for pagination
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *         default: 20
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter products by category
 *         example: Produce
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *         example: 5.99
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *         example: 19.99
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Text search query for product name/description
 *         example: organic apple
 *     responses:
 *       200:
 *         description: List of products from the store
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of products returned in this page
 *                   example: 10
 *                 totalProducts:
 *                   type: integer
 *                   description: Total number of products matching the filter
 *                   example: 45
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                   example: 3
 *                 currentPage:
 *                   type: integer
 *                   description: Current page number
 *                   example: 1
 *                 retailer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60a1e2c7d32f1e2b3c4d5e6f
 *                     name:
 *                       type: string
 *                       example: Jane's Grocery
 *                     description:
 *                       type: string
 *                       example: Fresh produce and groceries
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: 60a1e2c7d32f1e2b3c4d5e7f
 *                       name:
 *                         type: string
 *                         example: Organic Apples
 *                       description:
 *                         type: string
 *                         example: Fresh organic apples from local farms
 *                       price:
 *                         type: number
 *                         example: 2.99
 *                       images:
 *                         type: array
 *                         items:
 *                           type: string
 *                           format: uri
 *                           example: https://example.com/images/apple.jpg
 *                       category:
 *                         type: string
 *                         example: Produce
 *                       inStock:
 *                         type: boolean
 *                         example: true
 *                       stock:
 *                         type: integer
 *                         example: 50
 *       400:
 *         description: Bad request - invalid retailer ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Invalid retailer ID format
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Retailer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Retailer not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   GET /api/customer/stores/:id/products
// @desc    Get all products from a specific store/retailer
// @access  Private
router.get('/stores/:id/products', isCustomer, async (req, res) => {
  try {
    const retailerId = req.params.id;
    
    // Validate retailer ID
    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid retailer ID format'
      });
    }
    
    // Check if retailer exists
    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get query parameters for filtering
    const { category, minPrice, maxPrice, search } = req.query;
    
    // Build query object
    const query = { retailer: retailerId, isAvailable: true };
    
    // Add category filter if provided
    if (category) {
      query.category = category;
    }
    
    // Add price range filter if provided
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) {
        query.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice !== undefined) {
        query.price.$lte = parseFloat(maxPrice);
      }
    }
    
    // Add text search if provided
    let searchQuery = Product.find(query);
    if (search) {
      searchQuery = Product.find({
        $and: [
          query,
          { $text: { $search: search } }
        ]
      });
    }
    
    // Execute query with pagination
    const products = await searchQuery
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments(query);
    
    res.json({
      success: true,
      count: products.length,
      totalProducts,
      totalPages: Math.ceil(totalProducts / limit),
      currentPage: page,
      retailer: {
        id: retailer._id,
        name: retailer.storeName,
        description: retailer.storeDescription
      },
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        images: product.images,
        category: product.category,
        inStock: product.inStock,
        stock: product.stock
      }))
    });
  } catch (error) {
    console.error('Get store products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/customer/login:
 *   post:
 *     summary: Customer login
 *     description: Authenticates a customer and returns a JWT token
 *     tags: [Customer Authentication]
 *     security: []  # No security, this is a public endpoint
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer's email address
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Customer's password
 *                 example: securepassword
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 customer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60a1e2c7d32f1e2b3c4d5e6f
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *       400:
 *         description: Bad request - missing or invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingCredentials:
 *                 value:
 *                   success: false
 *                   message: Please provide email and password
 *               invalidCredentials:
 *                 value:
 *                   success: false
 *                   message: Invalid credentials
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   POST /api/customer/login
// @desc    Authenticate customer and get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find customer by email
    const customer = await Customer.findOne({ email }).select('+password');
    if (!customer) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await customer.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = customer.generateAuthToken();

    res.json({
      success: true,
      message: 'Login successful',
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/customer/stores:
 *   get:
 *     summary: Get nearby stores
 *     description: Returns a list of retailers/stores near the customer's location or specified coordinates
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude coordinate (optional if user profile has location)
 *         example: 40.848447
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitude coordinate (optional if user profile has location)
 *         example: -73.856077
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Search radius in kilometers
 *         default: 5
 *         example: 5
 *     responses:
 *       200:
 *         description: List of nearby stores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of stores found
 *                   example: 3
 *                 stores:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Store ID
 *                         example: 60a1e2c7d32f1e2b3c4d5e6f
 *                       name:
 *                         type: string
 *                         description: Store name
 *                         example: Jane's Grocery
 *                       description:
 *                         type: string
 *                         description: Store description
 *                         example: Fresh produce and groceries
 *                       location:
 *                         $ref: '#/components/schemas/GeoJSONPoint'
 *                       distance:
 *                         type: number
 *                         description: Relative distance from query point
 *                         example: 0.0023
 *                       phone:
 *                         type: string
 *                         description: Store phone number
 *                         example: "+1234567890"
 *       400:
 *         description: Bad request - missing location
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Location not found. Please provide lat and lng parameters or update your profile with location
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   GET /api/customer/stores
// @desc    Get nearby stores based on location
// @access  Private
router.get('/stores', isCustomer, async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query; // Default radius: 5km
    
    let coordinates;
    
    // If lat/lng provided in query, use those
    if (lat && lng) {
      coordinates = [parseFloat(lng), parseFloat(lat)];
    } else {
      // Otherwise use the customer's stored location
      const customer = await Customer.findById(req.user.id);
      if (!customer || !customer.location || !customer.location.coordinates) {
        return res.status(400).json({
          success: false,
          message: 'Location not found. Please provide lat and lng parameters or update your profile with location'
        });
      }
      coordinates = customer.location.coordinates;
    }
    
    // Validate coordinates
    if (!coordinates || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }
    
    // Find nearby stores using geospatial query
    const stores = await Retailer.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          $maxDistance: parseInt(radius) * 1000 // Convert km to meters
        }
      }
    }).select('name storeName storeDescription location phone');
    
    res.json({
      success: true,
      count: stores.length,
      stores: stores.map(store => ({
        id: store._id,
        name: store.storeName,
        description: store.storeDescription,
        location: store.location,
        distance: (store.location.coordinates[0] - coordinates[0])**2 + 
                 (store.location.coordinates[1] - coordinates[1])**2, // Simple distance calculation for sorting
        phone: store.phone
      })).sort((a, b) => a.distance - b.distance) // Sort by distance
    });
  } catch (error) {
    console.error('Get nearby stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/customer/cart:
 *   get:
 *     summary: Get customer's current cart
 *     description: Retrieves the authenticated customer's current shopping cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 cart:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Cart ID
 *                       example: 60a1e2c7d32f1e2b3c4d5e7g
 *                     items:
 *                       type: array
 *                       description: Array of cart items
 *                       items:
 *                         type: object
 *                         properties:
 *                           product:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: 60a1e2c7d32f1e2b3c4d5e7f
 *                               name:
 *                                 type: string
 *                                 example: Organic Apples
 *                               price:
 *                                 type: number
 *                                 example: 2.99
 *                               imageUrl:
 *                                 type: string
 *                                 example: https://example.com/images/apple.jpg
 *                               stock:
 *                                 type: integer
 *                                 example: 50
 *                               isAvailable:
 *                                 type: boolean
 *                                 example: true
 *                               retailer:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                     example: 60a1e2c7d32f1e2b3c4d5e6f
 *                                   storeName:
 *                                     type: string
 *                                     example: Jane's Grocery
 *                           quantity:
 *                             type: integer
 *                             description: Quantity of the product
 *                             example: 2
 *                           price:
 *                             type: number
 *                             description: Unit price of the product
 *                             example: 2.99
 *                           total:
 *                             type: number
 *                             description: Total price for this item (quantity * price)
 *                             example: 5.98
 *                     subtotal:
 *                       type: number
 *                       description: Subtotal cost before discounts or taxes
 *                       example: 12.98
 *                     total:
 *                       type: number
 *                       description: Total cart cost after discounts
 *                       example: 11.98
 *                     itemCount:
 *                       type: integer
 *                       description: Total number of items in cart
 *                       example: 4
 *                     discount:
 *                       type: number
 *                       description: Discount amount applied to cart
 *                       example: 1.00
 *                     couponCode:
 *                       type: string
 *                       description: Applied coupon code
 *                       example: SUMMER10
 *                       nullable: true
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   GET /api/customer/cart
// @desc    Get customer's current cart
// @access  Private
router.get('/cart', isCustomer, async (req, res) => {
  try {
    // Find customer's cart or create a new one if it doesn't exist
    let cart = await Cart.findOne({ customer: req.user.id })
      .populate({
        path: 'items.product',
        select: 'name price imageUrl stock isAvailable retailer',
        populate: {
          path: 'retailer',
          select: 'storeName'
        }
      });
    
    if (!cart) {
      cart = await Cart.create({ customer: req.user.id, items: [] });
    }
    
    res.json({
      success: true,
      cart: {
        id: cart._id,
        items: cart.items,
        subtotal: cart.subtotal,
        total: cart.total,
        itemCount: cart.itemCount,
        discount: cart.discount,
        couponCode: cart.couponCode
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/customer/cart/add:
 *   post:
 *     summary: Add item to cart
 *     description: Adds a product to the customer's shopping cart with specified quantity
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *                 description: ID of the product to add to cart
 *                 example: 60a1e2c7d32f1e2b3c4d5e7f
 *               quantity:
 *                 type: integer
 *                 description: Quantity of the product
 *                 default: 1
 *                 minimum: 1
 *                 example: 2
 *     responses:
 *       200:
 *         description: Item added to cart successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Item added to cart
 *                 cart:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Cart ID
 *                       example: 60a1e2c7d32f1e2b3c4d5e7g
 *                     items:
 *                       type: array
 *                       description: Array of cart items
 *                       items:
 *                         type: object
 *                         properties:
 *                           product:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: 60a1e2c7d32f1e2b3c4d5e7f
 *                               name:
 *                                 type: string
 *                                 example: Organic Apples
 *                               price:
 *                                 type: number
 *                                 example: 2.99
 *                           quantity:
 *                             type: integer
 *                             example: 2
 *                           total:
 *                             type: number
 *                             example: 5.98
 *                     subtotal:
 *                       type: number
 *                       description: Subtotal cost before discounts or taxes
 *                       example: 12.98
 *                     total:
 *                       type: number
 *                       description: Total cart cost after discounts
 *                       example: 12.98
 *                     itemCount:
 *                       type: integer
 *                       description: Total number of items in cart
 *                       example: 3
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingProductId:
 *                 value:
 *                   success: false
 *                   message: Product ID is required
 *               invalidQuantity:
 *                 value:
 *                   success: false
 *                   message: Quantity must be a positive integer
 *               outOfStock:
 *                 value:
 *                   success: false
 *                   message: Product is unavailable or insufficient stock
 *                   available: 3
 *                   isAvailable: true
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Product not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   POST /api/customer/cart/add
// @desc    Add item to cart
// @access  Private
router.post('/cart/add', isCustomer, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    // Validate input
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Validate quantity is a positive integer
    if (!Number.isInteger(parseInt(quantity)) || parseInt(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer'
      });
    }
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if product is available and in stock
    if (!product.isAvailable || product.stock < parseInt(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Product is unavailable or insufficient stock',
        available: product.stock,
        isAvailable: product.isAvailable
      });
    }
    
    // Find customer's cart or create a new one
    let cart = await Cart.findOne({ customer: req.user.id });
    if (!cart) {
      cart = new Cart({ customer: req.user.id, items: [] });
    }
    
    // Add item to cart
    await cart.addItem(productId, parseInt(quantity));
    
    // Fetch updated cart with populated items
    cart = await Cart.findById(cart._id).populate({
      path: 'items.product',
      select: 'name price imageUrl stock isAvailable retailer',
      populate: {
        path: 'retailer',
        select: 'storeName'
      }
    });
    
    res.json({
      success: true,
      message: 'Item added to cart',
      cart: {
        id: cart._id,
        items: cart.items,
        subtotal: cart.subtotal,
        total: cart.total,
        itemCount: cart.itemCount
      }
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/customer/cart/remove/{productId}:
 *   delete:
 *     summary: Remove item from cart
 *     description: Removes a product from the customer's shopping cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the product to remove from cart
 *         example: 60a1e2c7d32f1e2b3c4d5e7f
 *     responses:
 *       200:
 *         description: Item removed from cart successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Item removed from cart
 *                 cart:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Cart ID
 *                       example: 60a1e2c7d32f1e2b3c4d5e7g
 *                     items:
 *                       type: array
 *                       description: Array of cart items
 *                       items:
 *                         type: object
 *                         properties:
 *                           product:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: 60a1e2c7d32f1e2b3c4d5e8h
 *                               name:
 *                                 type: string
 *                                 example: Organic Bananas
 *                               price:
 *                                 type: number
 *                                 example: 1.99
 *                           quantity:
 *                             type: integer
 *                             example: 1
 *                           total:
 *                             type: number
 *                             example: 1.99
 *                     subtotal:
 *                       type: number
 *                       description: Subtotal cost before discounts or taxes
 *                       example: 7.00
 *                     total:
 *                       type: number
 *                       description: Total cart cost after discounts
 *                       example: 7.00
 *                     itemCount:
 *                       type: integer
 *                       description: Total number of items in cart
 *                       example: 2
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Cart or item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               cartNotFound:
 *                 value:
 *                   success: false
 *                   message: Cart not found
 *               itemNotFound:
 *                 value:
 *                   success: false
 *                   message: Item not found in cart
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   DELETE /api/customer/cart/remove/:productId
// @desc    Remove item from cart
// @access  Private
router.delete('/cart/remove/:productId', isCustomer, async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Validate input
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    
    // Find customer's cart
    let cart = await Cart.findOne({ customer: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    // Check if item exists in cart
    const itemExists = cart.items.some(item => item.product.toString() === productId);
    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }
    
    // Remove item from cart
    await cart.removeItem(productId);
    
    // Fetch updated cart with populated items
    cart = await Cart.findById(cart._id).populate({
      path: 'items.product',
      select: 'name price imageUrl stock isAvailable retailer',
      populate: {
        path: 'retailer',
        select: 'storeName'
      }
    });
    
    res.json({
      success: true,
      message: 'Item removed from cart',
      cart: {
        id: cart._id,
        items: cart.items,
        subtotal: cart.subtotal,
        total: cart.total,
        itemCount: cart.itemCount
      }
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/customer/order:
 *   post:
 *     summary: Create new order from cart
 *     description: Creates a new order from the customer's current cart with payment and delivery information
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [credit_card, debit_card, paypal, cash_on_delivery]
 *                 description: Payment method for the order
 *                 example: credit_card
 *               deliveryAddress:
 *                 $ref: '#/components/schemas/Address'
 *               deliveryPhone:
 *                 type: string
 *                 description: Phone number for delivery contact (optional, defaults to customer's phone)
 *                 example: "+1234567890"
 *               deliveryInstructions:
 *                 type: string
 *                 description: Special instructions for delivery
 *                 example: "Leave at the front door, no need to ring the bell"
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Order created successfully
 *                 order:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Order ID
 *                       example: 60a1e2c7d32f1e2b3c4d5e8h
 *                     orderNumber:
 *                       type: string
 *                       description: Readable order number
 *                       example: NM-202504-1001
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           product:
 *                             type: string
 *                             description: Product ID
 *                             example: 60a1e2c7d32f1e2b3c4d5e7f
 *                           productName:
 *                             type: string
 *                             example: Organic Apples
 *                           quantity:
 *                             type: integer
 *                             example: 2
 *                           price:
 *                             type: number
 *                             example: 2.99
 *                           total:
 *                             type: number
 *                             example: 5.98
 *                           retailer:
 *                             type: string
 *                             description: Retailer ID
 *                             example: 60a1e2c7d32f1e2b3c4d5e6f
 *                           retailerName:
 *                             type: string
 *                             example: Jane's Grocery
 *                     subtotal:
 *                       type: number
 *                       description: Subtotal before tax and delivery fee
 *                       example: 29.98
 *                     total:
 *                       type: number
 *                       description: Order total including tax and delivery fee
 *                       example: 35.98
 *                     tax:
 *                       type: number
 *                       description: Tax amount
 *                       example: 1.50
 *                     deliveryFee:
 *                       type: number
 *                       description: Delivery fee
 *                       example: 5.00
 *                     discount:
 *                       type: number
 *                       description: Discount amount
 *                       example: 0.50
 *                     status:
 *                       type: string
 *                       enum: [pending, processing, shipped, delivered, cancelled]
 *                       description: Order status
 *                       example: pending
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Order creation date
 *                       example: 2023-05-15T10:30:00.000Z
 *       400:
 *         description: Bad request - validation error or cart empty
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingPaymentMethod:
 *                 value:
 *                   success: false
 *                   message: Payment method is required
 *               emptyCart:
 *                 value:
 *                   success: false
 *                   message: Cart is empty
 *               unavailableItems:
 *                 value:
 *                   success: false
 *                   message: Some items are unavailable or out of stock
 *                   unavailableItems: [
 *                     {
 *                       productId: "60a1e2c7d32f1e2b3c4d5e7f",
 *                       name: "Organic Apples",
 *                       available: 1,
 *                       requested: 2
 *                     }
 *                   ]
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Cart or customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               customerNotFound:
 *                 value:
 *                   success: false
 *                   message: Customer not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   POST /api/customer/order
// @desc    Create new order from cart
// @access  Private
router.post('/order', isCustomer, async (req, res) => {
  try {
    const { paymentMethod, deliveryAddress, deliveryPhone, deliveryInstructions } = req.body;
    
    // Validate input
    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }
    
    // Find customer's cart
    const cart = await Cart.findOne({ customer: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }
    
    // Verify cart items are available and in stock
    const availability = await cart.verifyAvailability();
    if (!availability.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Some items are unavailable or out of stock',
        unavailableItems: availability.unavailableItems
      });
    }
    
    // Get customer information for delivery address
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Use provided delivery address or default to customer's address
    const address = deliveryAddress || customer.address;
    const contactPhone = deliveryPhone || customer.phone;
    
    // Create order from cart
    const order = await Order.createFromCart(cart._id, {
      method: paymentMethod,
      status: paymentMethod === 'cash_on_delivery' ? 'pending' : 'completed'
    }, {
      address,
      contactPhone,
      instructions: deliveryInstructions,
      fee: 5.00 // Fixed delivery fee for simplicity
    });
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        items: order.items,
        subtotal: order.subtotal,
        total: order.total,
        tax: order.tax,
        deliveryFee: order.deliveryFee,
        discount: order.discount,
        status: order.status,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

