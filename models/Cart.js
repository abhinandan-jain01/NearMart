const mongoose = require('mongoose');

// Define cart item schema (sub-document)
const CartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    validate: {
      validator: function(value) {
        return Number.isInteger(value) && value > 0;
      },
      message: 'Quantity must be a positive integer'
    }
  },
  price: {
    type: Number,
    required: [true, 'Item price is required'],
    min: [0.01, 'Price must be greater than 0']
  },
  // Store some product details to avoid multiple lookups
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String
  },
  retailerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Retailer',
    required: true
  }
}, { _id: true });

// Define the main Cart schema
const CartSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Cart must belong to a customer'],
    unique: true // Each customer can only have one active cart
  },
  retailer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Retailer'
  },
  items: [CartItemSchema],
  // Optional fields
  couponCode: {
    type: String,
    trim: true
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Virtual field for cart subtotal (sum of all items)
CartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
});

// Virtual field for tax amount (10% by default, configurable via env)
CartSchema.virtual('tax').get(function() {
  const taxRate = process.env.TAX_RATE || 0.1; // Default 10%
  return Math.round((this.subtotal - this.discount) * taxRate * 100) / 100;
});

// Virtual field for delivery fee
CartSchema.virtual('deliveryFee').get(function() {
  return parseFloat(process.env.STANDARD_DELIVERY_FEE || 5.00);
});

// Virtual field for cart total (with discount, tax, and delivery fee applied)
CartSchema.virtual('total').get(function() {
  const subtotal = this.subtotal;
  const discountedSubtotal = subtotal - this.discount;
  return discountedSubtotal + this.tax + this.deliveryFee;
});

// Virtual field for item count
CartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((count, item) => count + item.quantity, 0);
});

// Method to add item to cart
CartSchema.methods.addItem = async function(productId, quantity = 1) {
  const Product = mongoose.model('Product');
  
  // Find the product
  const product = await Product.findById(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  if (!product.isAvailable || product.stock < quantity) {
    throw new Error('Product is unavailable or insufficient stock');
  }
  
  // Check if the product already exists in the cart
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString()
  );
  
  if (existingItemIndex > -1) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity += quantity;
    // Update price in case it changed
    this.items[existingItemIndex].price = product.price;
  } else {
    // Add new item to cart
    this.items.push({
      product: productId,
      quantity: quantity,
      price: product.price,
      productName: product.name,
      productImage: product.images && product.images.length > 0 ? product.images[0] : '',
      retailerId: product.retailer
    });
    
    // Set the retailer for the cart if not already set
    if (!this.retailer) {
      this.retailer = product.retailer;
    }
  }
  
  return this.save();
};

// Method to remove item from cart
CartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(item => 
    item.product.toString() !== productId.toString()
  );
  
  return this.save();
};

// Method to update item quantity
CartSchema.methods.updateItemQuantity = async function(productId, quantity) {
  if (quantity <= 0) {
    return this.removeItem(productId);
  }
  
  const Product = mongoose.model('Product');
  const product = await Product.findById(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  if (!product.isAvailable || product.stock < quantity) {
    throw new Error('Product is unavailable or insufficient stock');
  }
  
  const itemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString()
  );
  
  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }
  
  this.items[itemIndex].quantity = quantity;
  this.items[itemIndex].price = product.price; // Update price in case it changed
  
  return this.save();
};

// Method to clear cart
CartSchema.methods.clearCart = function() {
  this.items = [];
  this.discount = 0;
  this.couponCode = null;
  
  return this.save();
};

// Method to verify all items in cart are available and in stock
CartSchema.methods.verifyAvailability = async function() {
  const Product = mongoose.model('Product');
  const unavailableItems = [];
  
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    
    if (!product || !product.isAvailable || product.stock < item.quantity) {
      unavailableItems.push({
        productId: item.product,
        productName: item.productName,
        requested: item.quantity,
        available: product ? product.stock : 0,
        isAvailable: product ? product.isAvailable : false
      });
    }
  }
  
  return {
    isValid: unavailableItems.length === 0,
    unavailableItems
  };
};

// Pre-save middleware to validate all items are from the same retailer
CartSchema.pre('save', function(next) {
  if (this.items.length === 0) {
    return next();
  }
  
  // Get the retailerId from the first item
  const firstItemRetailerId = this.items[0].retailerId.toString();
  
  // Check if all items have the same retailerId
  const allFromSameRetailer = this.items.every(item => 
    item.retailerId.toString() === firstItemRetailerId
  );
  
  if (!allFromSameRetailer) {
    const error = new Error('All items in cart must be from the same retailer');
    return next(error);
  }
  
  // Ensure the cart retailer field matches the items' retailer
  this.retailer = firstItemRetailerId;
  
  next();
});

module.exports = mongoose.model('Cart', CartSchema);
