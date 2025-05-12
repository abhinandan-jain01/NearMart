const mongoose = require('mongoose');

// Define the Product schema
const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0.01, 'Price must be greater than 0'],
    validate: {
      validator: function(value) {
        return value > 0;
      },
      message: 'Price must be a positive number'
    }
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0,
    validate: {
      validator: function(value) {
        return Number.isInteger(value);
      },
      message: 'Stock must be a whole number'
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  images: {
    type: [String],
    default: []
  },
  retailer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Retailer',
    required: [true, 'Product must be associated with a retailer']
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  // Optional additional fields
  weight: {
    value: {
      type: Number,
      min: 0
    },
    unit: {
      type: String,
      enum: ['g', 'kg', 'lb', 'oz'],
      default: 'g'
    }
  },
  dimensions: {
    length: {
      type: Number,
      min: 0
    },
    width: {
      type: Number,
      min: 0
    },
    height: {
      type: Number,
      min: 0
    },
    unit: {
      type: String,
      enum: ['cm', 'in'],
      default: 'cm'
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Virtual for checking if product is in stock
ProductSchema.virtual('inStock').get(function() {
  return this.stock > 0 && this.isAvailable;
});

// Static method to update stock
ProductSchema.statics.updateStock = async function(productId, quantity) {
  const product = await this.findById(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  if (product.stock < quantity) {
    throw new Error('Insufficient stock');
  }
  
  product.stock -= quantity;
  return product.save();
};

// Method to add stock
ProductSchema.statics.addStock = async function(productId, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive integer');
  }

  const product = await this.findById(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  product.stock += quantity;
  return product.save();
};

// Method to set product availability
ProductSchema.statics.setAvailability = async function(productId, isAvailable) {
  const product = await this.findById(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  product.isAvailable = Boolean(isAvailable);
  return product.save();
};

// Instance method to check if enough stock is available
ProductSchema.methods.hasEnoughStock = function(quantity) {
  return this.stock >= quantity && this.isAvailable;
};

// Add index for faster querying by category and retailer
ProductSchema.index({ category: 1, retailer: 1 });
ProductSchema.index({ retailer: 1 }); // Index for retailer-specific queries
ProductSchema.index({ name: 'text', description: 'text' }); // Text index for search functionality

module.exports = mongoose.model('Product', ProductSchema);
