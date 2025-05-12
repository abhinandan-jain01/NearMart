const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const Retailer = require('../models/Retailer');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Import middleware
const { isRetailer } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/retailer/signup:
 *   post:
 *     summary: Register a new retailer
 *     description: Creates a new retailer account with the provided information
 *     tags: [Retailer Authentication]
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
 *               - storeName
 *             properties:
 *               name:
 *                 type: string
 *                 description: Owner's full name
 *                 example: Jane Smith
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Retailer's email address
 *                 example: jane.smith@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Account password
 *                 minLength: 6
 *                 example: securepassword
 *               storeName:
 *                 type: string
 *                 description: Name of the store
 *                 example: Jane's Grocery
 *               storeDescription:
 *                 type: string
 *                 description: Brief description of the store
 *                 example: Fresh produce and groceries from local farms
 *               phone:
 *                 type: string
 *                 description: Store phone number
 *                 example: "+1234567890"
 *               address:
 *                 $ref: '#/components/schemas/Address'
 *               location:
 *                 $ref: '#/components/schemas/GeoJSONPoint'
 *     responses:
 *       201:
 *         description: Retailer registered successfully
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
 *                   example: Retailer registered successfully
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 retailer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60a1e2c7d32f1e2b3c4d5e6f
 *                     name:
 *                       type: string
 *                       example: Jane Smith
 *                     email:
 *                       type: string
 *                       example: jane.smith@example.com
 *                     storeName:
 *                       type: string
 *                       example: Jane's Grocery
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
 *                   message: Missing required fields - name, email, password, storeName
 *                   missingFields: ["name", "password"]
 *               invalidAddress:
 *                 value:
 *                   success: false
 *                   message: Address is incomplete. Missing fields - street, city
 *                   missingAddressFields: ["street", "city"]
 *               emailExists:
 *                 value:
 *                   success: false
 *                   message: A retailer with this email already exists
 *                   error: EMAIL_ALREADY_EXISTS
 *               invalidLocation:
 *                 value:
 *                   success: false
 *                   message: Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]
 *                   error: INVALID_LOCATION_FORMAT
 *               noAddressOrLocation:
 *                 value:
 *                   success: false
 *                   message: Either address or location is required
 *                   error: ADDRESS_OR_LOCATION_REQUIRED
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   POST /api/retailer/signup
// @desc    Register a new retailer
// @access  Public
router.post('/signup', async (req, res) => {
  console.log('\n============== RETAILER SIGNUP REQUEST ==============');
  
  try {
    // Extract all fields from request body
    const { name, email, password, storeName, phone, storeDescription, address, location } = req.body;
    
    console.log(`Signup attempt for: ${email || 'unknown email'}`);
    
    // 1. Validate required fields
    let missingFields = [];
    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!storeName) missingFields.push('storeName');
    
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields.join(', '));
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      });
    }
    
    // 2. Check if email already exists
    const existingRetailer = await Retailer.findOne({ email });
    if (existingRetailer) {
      console.log('Email already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'A retailer with this email already exists',
        error: 'EMAIL_ALREADY_EXISTS'
      });
    }
    
    // 3. Validate that either location or address is provided
    if (!address && !location) {
      console.log('Missing both address and location');
      return res.status(400).json({
        success: false,
        message: 'Either address or location is required',
        error: 'ADDRESS_OR_LOCATION_REQUIRED'
      });
    }
    
    // 4. Validate address format if provided
    if (address) {
      if (typeof address !== 'object') {
        console.log('Invalid address format (not an object)');
        return res.status(400).json({
          success: false,
          message: 'Address must be an object containing street, city, state, and zipCode fields',
          error: 'INVALID_ADDRESS_FORMAT'
        });
      }
      
      const missingAddressFields = [];
      if (!address.street) missingAddressFields.push('street');
      if (!address.city) missingAddressFields.push('city');
      if (!address.state) missingAddressFields.push('state');
      if (!address.zipCode) missingAddressFields.push('zipCode');
      
      if (missingAddressFields.length > 0) {
        console.log('Incomplete address, missing fields:', missingAddressFields.join(', '));
        return res.status(400).json({
          success: false,
          message: `Address is incomplete. Missing fields: ${missingAddressFields.join(', ')}`,
          missingAddressFields
        });
      }
      
      console.log('Valid address provided for geocoding');
    }
    
    // 5. Validate location format if provided
    if (location) {
      if (!location.type || !location.coordinates || location.type !== 'Point' || 
          !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
        console.log('Invalid location format');
        return res.status(400).json({
          success: false,
          message: 'Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]',
          error: 'INVALID_LOCATION_FORMAT'
        });
      }
      
      console.log('Valid location coordinates provided');
    }

    // 6. All validation passed, create new retailer
    console.log('Creating new retailer account...');
    
    // Create retailer object with required fields
    const retailerData = {
      name,
      email,
      password, // Will be hashed by pre-save hook
      storeName
    };
    
    // Add optional fields if they exist
    if (phone) retailerData.phone = phone;
    if (storeDescription) retailerData.storeDescription = storeDescription;
    if (address) retailerData.address = address;
    if (location) retailerData.location = location;
    
    // Create new retailer
    const retailer = new Retailer(retailerData);
    
    // Save retailer to DB with geocoding middleware processing
    try {
      const savedRetailer = await retailer.save();
      console.log('Retailer saved successfully with ID:', savedRetailer._id);
      
      if (savedRetailer.location && savedRetailer.location.coordinates) {
        console.log('Location coordinates:', savedRetailer.location.coordinates);
      }
    } catch (saveError) {
      console.error('Error saving retailer:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create retailer account',
        error: process.env.NODE_ENV === 'development' ? saveError.message : 'Database error'
      });
    }

    // Generate JWT token for authentication
    const token = retailer.generateAuthToken();

    res.status(201).json({
      success: true,
      message: 'Retailer registered successfully',
      token,
      retailer: {
        id: retailer._id,
        name: retailer.name,
        email: retailer.email,
        storeName: retailer.storeName
      }
    });
  } catch (error) {
    console.error('Retailer signup error:', error);
    
    // Handle specific geocoding errors
    if (error.message && error.message.includes('Geocoding failed')) {
      return res.status(400).json({
        success: false,
        message: 'Could not geocode the provided address. Please check the address and try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Handle MongoDB duplicate key errors
    if (error.name === 'MongoServerError' && error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A retailer with this email already exists',
        error: 'EMAIL_ALREADY_EXISTS'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = {};
      
      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message;
      }
      
      console.log('Validation error details:', validationErrors);
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors
      });
    }
    
    // Default error response for unhandled errors
    console.error('Unhandled error in retailer signup:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/retailer/login:
 *   post:
 *     summary: Retailer login
 *     description: Authenticates a retailer and returns a JWT token
 *     tags: [Retailer Authentication]
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
 *                 description: Retailer's email address
 *                 example: jane.smith@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Account password
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
 *                 retailer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60a1e2c7d32f1e2b3c4d5e6f
 *                     name:
 *                       type: string
 *                       example: Jane Smith
 *                     email:
 *                       type: string
 *                       example: jane.smith@example.com
 *                     storeName:
 *                       type: string
 *                       example: Jane's Grocery
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
// @route   POST /api/retailer/login
// @desc    Authenticate retailer and get token
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

    // Find retailer by email
    const retailer = await Retailer.findOne({ email }).select('+password');
    if (!retailer) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await retailer.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = retailer.generateAuthToken();

    res.json({
      success: true,
      message: 'Login successful',
      token,
      retailer: {
        id: retailer._id,
        name: retailer.name,
        email: retailer.email,
        storeName: retailer.storeName
      }
    });
  } catch (error) {
    console.error('Retailer login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/retailer/products:
 *   get:
 *     summary: Get all products for retailer
 *     description: Retrieves all products belonging to the authenticated retailer
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Products retrieved successfully
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
 *                   description: Number of products
 *                   example: 3
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
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
// @route   GET /api/retailer/products
// @desc    Get all products for authenticated retailer
// @access  Private
router.get('/products', isRetailer, async (req, res) => {
  try {
    const products = await Product.find({ retailer: req.user.id });

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Get retailer products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/retailer/products:
 *   post:
 *     summary: Add a new product
 *     description: Creates a new product for the authenticated retailer
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the product
 *                 example: Organic Apples
 *               description:
 *                 type: string
 *                 description: Detailed product description
 *                 example: Fresh organic apples from local farms
 *               price:
 *                 type: number
 *                 description: Product price
 *                 minimum: 0.01
 *                 example: 2.99
 *               stock:
 *                 type: integer
 *                 description: Available stock quantity
 *                 default: 0
 *                 minimum: 0
 *                 example: 100
 *               category:
 *                 type: string
 *                 description: Product category
 *                 example: Produce
 *               images:
 *                 type: array
 *                 description: Array of image URLs
 *                 items:
 *                   type: string
 *                   format: uri
 *                   example: https://example.com/images/apple.jpg
 *               imageUrl:
 *                 type: string
 *                 description: Legacy single image URL (will be converted to images array)
 *                 format: uri
 *                 example: https://example.com/images/apple.jpg
 *     responses:
 *       201:
 *         description: Product created successfully
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
 *                   example: Product added successfully
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Please provide name, price, and category
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
// @route   POST /api/retailer/products
// @desc    Add a new product
// @access  Private
router.post('/products', isRetailer, async (req, res) => {
  try {
    const { name, description, price, stock, category, imageUrl } = req.body;

    // Basic validation
    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, price, and category'
      });
    }

    // Create new product
    const product = new Product({
      name,
      description,
      price,
      stock: stock || 0,
      category,
      imageUrl,
      retailer: req.user.id
    });

    // Update to use images array instead of single imageUrl
    if (req.body.images && Array.isArray(req.body.images)) {
      product.images = req.body.images;
    } else if (imageUrl) {
      product.images = [imageUrl];
    }

    // Save product to DB
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      product
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/retailer/products/{id}:
 *   put:
 *     summary: Update a product
 *     description: Updates an existing product belonging to the authenticated retailer
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Product ID
 *         example: 60a1e2c7d32f1e2b3c4d5e7f
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the product
 *                 example: Organic Red Apples
 *               description:
 *                 type: string
 *                 description: Detailed product description
 *                 example: Fresh organic red apples from local farms
 *               price:
 *                 type: number
 *                 description: Product price
 *                 minimum: 0.01
 *                 example: 3.49
 *               stock:
 *                 type: integer
 *                 description: Available stock quantity
 *                 minimum: 0
 *                 example: 75
 *               category:
 *                 type: string
 *                 description: Product category
 *                 example: Produce
 *               images:
 *                 type: array
 *                 description: Array of image URLs
 *                 items:
 *                   type: string
 *                   format: uri
 *                   example: https://example.com/images/red-apple.jpg
 *               imageUrl:
 *                 type: string
 *                 description: Legacy single image URL (will be converted to images array)
 *                 format: uri
 *                 example: https://example.com/images/red-apple.jpg
 *               isAvailable:
 *                 type: boolean
 *                 description: Whether the product is available for purchase
 *                 example: true
 *     responses:
 *       200:
 *         description: Product updated successfully
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
 *                   example: Product updated successfully
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Product not found or not owned by this retailer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Product not found or not owned by this retailer
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   PUT /api/retailer/products/:id
// @desc    Update a product
// @access  Private
router.put('/products/:id', isRetailer, async (req, res) => {
  try {
    const { name, description, price, stock, category, imageUrl, isAvailable } = req.body;

    // Check if product exists and belongs to the retailer
    const product = await Product.findOne({
      _id: req.params.id,
      retailer: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not owned by this retailer'
      });
    }

    // Update product fields if provided
    if (name) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (category) product.category = category;
    
    // Handle images update
    if (req.body.images && Array.isArray(req.body.images)) {
      product.images = req.body.images;
    } else if (imageUrl !== undefined) {
      product.images = imageUrl ? [imageUrl] : [];
    }
    
    if (isAvailable !== undefined) product.isAvailable = isAvailable;

    // Save updated product
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/retailer/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     description: Deletes an existing product belonging to the authenticated retailer
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Product ID
 *         example: 60a1e2c7d32f1e2b3c4d5e7f
 *     responses:
 *       200:
 *         description: Product deleted successfully
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
 *                   example: Product deleted successfully
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Product not found or not owned by this retailer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Product not found or not owned by this retailer
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   DELETE /api/retailer/products/:id
// @desc    Delete a product
// @access  Private
router.delete('/products/:id', isRetailer, async (req, res) => {
  try {
    // Check if product exists and belongs to the retailer
    const product = await Product.findOne({
      _id: req.params.id,
      retailer: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not owned by this retailer'
      });
    }

    // Delete the product
    await product.remove();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/retailer/profile:
 *   get:
 *     summary: Get retailer profile
 *     description: Retrieves the authenticated retailer's profile information
 *     tags: [Retailer Profile]
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
 *                 retailer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60a1e2c7d32f1e2b3c4d5e6f
 *                     name:
 *                       type: string
 *                       example: Jane Smith
 *                     email:
 *                       type: string
 *                       example: jane.smith@example.com
 *                     storeName:
 *                       type: string
 *                       example: Jane's Grocery
 *                     storeDescription:
 *                       type: string
 *                       example: Fresh produce and groceries from local farms
 *                     phone:
 *                       type: string
 *                       example: "+1234567890"
 *                     location:
 *                       $ref: '#/components/schemas/GeoJSONPoint'
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
// @route   GET /api/retailer/profile
// @desc    Get retailer profile
// @access  Private
router.get('/profile', isRetailer, async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user.id);

    if (!retailer) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }

    res.json({
      success: true,
      retailer: {
        id: retailer._id,
        name: retailer.name,
        email: retailer.email,
        storeName: retailer.storeName,
        storeDescription: retailer.storeDescription,
        phone: retailer.phone,
        location: retailer.location,
        createdAt: retailer.createdAt
      }
    });
  } catch (error) {
    console.error('Get retailer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/retailer/profile:
 *   put:
 *     summary: Update retailer profile
 *     description: Updates the authenticated retailer's profile information
 *     tags: [Retailer Profile]
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
 *                 description: Owner's full name
 *                 example: Jane A. Smith
 *               storeName:
 *                 type: string
 *                 description: Name of the store
 *                 example: Jane's Organic Grocery
 *               storeDescription:
 *                 type: string
 *                 description: Brief description of the store
 *                 example: Premium organic produce from local farmers
 *               phone:
 *                 type: string
 *                 description: Store phone number
 *                 example: "+1987654321"
 *               address:
 *                 $ref: '#/components/schemas/Address'
 *               location:
 *                 $ref: '#/components/schemas/GeoJSONPoint'
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
 *                 retailer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60a1e2c7d32f1e2b3c4d5e6f
 *                     name:
 *                       type: string
 *                       example: Jane A. Smith
 *                     email:
 *                       type: string
 *                       example: jane.smith@example.com
 *                     storeName:
 *                       type: string
 *                       example: Jane's Organic Grocery
 *                     storeDescription:
 *                       type: string
 *                       example: Premium organic produce from local farmers
 *                     phone:
 *                       type: string
 *                       example: "+1987654321"
 *                     location:
 *                       $ref: '#/components/schemas/GeoJSONPoint'
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
 *                   message: Invalid address format. Missing fields - street, city
 *               invalidLocation:
 *                 value:
 *                   success: false
 *                   message: Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]
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
// @route   PUT /api/retailer/profile
// @desc    Update retailer profile
// @access  Private
router.put('/profile', isRetailer, async (req, res) => {
  try {
    const { name, storeName, storeDescription, phone, address, location } = req.body;

    // Find retailer
    const retailer = await Retailer.findById(req.user.id);

    if (!retailer) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }

    // Update fields if provided
    if (name) retailer.name = name;
    if (storeName) retailer.storeName = storeName;
    if (storeDescription !== undefined) retailer.storeDescription = storeDescription;
    if (phone) retailer.phone = phone;
    
    // Update address if provided
    if (address) {
      // Validate address format
      const missingAddressFields = [];
      if (!address.street) missingAddressFields.push('street');
      if (!address.city) missingAddressFields.push('city');
      if (!address.state) missingAddressFields.push('state');
      if (!address.zipCode) missingAddressFields.push('zipCode');
      
      if (missingAddressFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid address format. Missing fields: ${missingAddressFields.join(', ')}`
        });
      }
      
      retailer.address = address;
      // The geocoding will be handled by the pre-save middleware
    }
    
    // Validate and update location if provided
    if (location) {
      if (!location.type || !location.coordinates || location.type !== 'Point' || 
          !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]'
        });
      }
      retailer.location = location;
    }

    // Save updated retailer
    await retailer.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      retailer: {
        id: retailer._id,
        name: retailer.name,
        email: retailer.email,
        storeName: retailer.storeName,
        storeDescription: retailer.storeDescription,
        phone: retailer.phone,
        location: retailer.location
      }
    });
  } catch (error) {
    console.error('Update retailer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/retailer/orders:
 *   get:
 *     summary: Get retailer orders
 *     description: Retrieves all orders containing products from the authenticated retailer
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
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
 *                   description: Number of orders
 *                   example: 2
 *                 orders:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: Order ID
 *                         example: 60a1e2c7d32f1e2b3c4d5e8h
 *                       orderNumber:
 *                         type: string
 *                         description: Human-readable order number
 *                         example: NM-202504-1001
 *                       customer:
 *                         type: string
 *                         description: Customer ID
 *                         example: 60a1e2c7d32f1e2b3c4d5e6f
 *                       status:
 *                         type: string
 *                         enum: [pending, confirmed, processing, out_for_delivery, delivered, cancelled]
 *                         description: Order status
 *                         example: processing
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Order creation date
 *                         example: 2023-05-15T10:30:00.000Z
 *                       items:
 *                         type: array
 *                         description: Only items from this retailer
 *                         items:
 *                           type: object
 *                           properties:
 *                             product:
 *                               type: string
 *                               description: Product ID
 *                               example: 60a1e2c7d32f1e2b3c4d5e7f
 *                             productName:
 *                               type: string
 *                               example: Organic Apples
 *                             quantity:
 *                               type: integer
 *                               example: 2
 *                             price:
 *                               type: number
 *                               example: 2.99
 *                             total:
 *                               type: number
 *                               example: 5.98
 *                       subtotal:
 *                         type: number
 *                         description: Subtotal for this retailer's items only
 *                         example: 12.98
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
 *                       statusHistory:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               example: processing
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *                               example: 2023-05-15T11:30:00.000Z
 *                             note:
 *                               type: string
 *                               example: "Status updated by retailer"
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
// @route   GET /api/retailer/orders
// @desc    Get all orders for the retailer's products
// @access  Private
router.get('/orders', isRetailer, async (req, res) => {
  try {
    // Find orders that contain items from this retailer
    // This approach uses the retailer field in the items array
    const orders = await Order.find({
      'items.retailer': mongoose.Types.ObjectId(req.user.id)
    }).sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return res.json({
        success: true,
        count: 0,
        orders: []
      });
    }

    // Filter each order to only include items from this retailer
    const filteredOrders = orders.map(order => {
      // Create a new object with all order properties
      const retailerOrder = {
        _id: order._id,
        orderNumber: order.orderNumber,
        customer: order.customer,
        status: order.status,
        createdAt: order.createdAt,
        delivery: order.delivery,
        statusHistory: order.statusHistory
      };

      // Filter items to only include those from this retailer
      const retailerItems = order.items.filter(item => 
        item.retailer.toString() === req.user.id
      );

      retailerOrder.items = retailerItems;

      // Calculate subtotal for this retailer's items only
      retailerOrder.subtotal = retailerItems.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);

      return retailerOrder;
    });

    res.json({
      success: true,
      count: filteredOrders.length,
      orders: filteredOrders
    });
  } catch (error) {
    console.error('Get retailer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/retailer/orders/{id}/status:
 *   put:
 *     summary: Update order status
 *     description: Updates the status of an order containing items from the authenticated retailer
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Order ID
 *         example: 60a1e2c7d32f1e2b3c4d5e8h
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmed, processing, out_for_delivery, delivered]
 *                 description: New status for the order
 *                 example: processing
 *     responses:
 *       200:
 *         description: Order status updated successfully
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
 *                   example: Order status updated successfully
 *                 order:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Order ID
 *                       example: 60a1e2c7d32f1e2b3c4d5e8h
 *                     orderNumber:
 *                       type: string
 *                       description: Human-readable order number
 *                       example: NM-202504-1001
 *                     status:
 *                       type: string
 *                       enum: [pending, confirmed, processing, out_for_delivery, delivered, cancelled]
 *                       description: Updated order status
 *                       example: processing
 *                     statusHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                             example: processing
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                             example: 2023-05-15T11:30:00.000Z
 *                           note:
 *                             type: string
 *                             example: "Status updated by retailer"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Last update timestamp
 *                       example: 2023-05-15T11:30:00.000Z
 *       400:
 *         description: Bad request - invalid status or missing status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingStatus:
 *                 value:
 *                   success: false
 *                   message: Status is required
 *               invalidStatus:
 *                 value:
 *                   success: false
 *                   message: Invalid status. Must be one of - confirmed, processing, out_for_delivery, delivered
 *               cancelledOrder:
 *                 value:
 *                   success: false
 *                   message: Cannot update status for cancelled orders
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Order does not contain retailer's items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: This order does not contain any items from your store
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Order not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// @route   PUT /api/retailer/orders/:id/status
// @desc    Update order status for a retailer's items
// @access  Private
router.put('/orders/:id/status', isRetailer, async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Validate status value
    const validStatuses = ['confirmed', 'processing', 'out_for_delivery', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find the order and verify it contains items from this retailer
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order contains items from this retailer
    const hasRetailerItems = order.items.some(item => 
      item.retailer.toString() === req.user.id
    );

    if (!hasRetailerItems) {
      return res.status(403).json({
        success: false,
        message: 'This order does not contain any items from your store'
      });
    }

    // Don't allow status update for cancelled orders
    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update status for cancelled orders'
      });
    }

    // Update the order status
    order.status = status;
    
    // Add status change to history
    order.statusHistory.push({
      status,
      timestamp: Date.now(),
      note: `Status updated by retailer ID: ${req.user.id}`
    });

    // Set delivery date if status is 'delivered'
    if (status === 'delivered' && order.delivery) {
      order.delivery.actualDeliveryDate = new Date();
    }

    // Set expected delivery date if status is 'confirmed'
    if (status === 'confirmed' && order.delivery && !order.delivery.expectedDeliveryDate) {
      // Default to 3 days from now
      order.delivery.expectedDeliveryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        statusHistory: order.statusHistory,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
