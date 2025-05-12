const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Define the Customer schema
const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in query results by default
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required']
    }
  },
  // Optional fields
  phone: {
    type: String,
    trim: true
  },
  deliveryPreferences: {
    preferredTime: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'anytime'],
      default: 'anytime'
    },
    contactlessDelivery: {
      type: Boolean,
      default: false
    },
    deliveryInstructions: {
      type: String,
      trim: true
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Add geospatial index to location field for potentially finding nearby stores
CustomerSchema.index({ location: '2dsphere' });

// Hash password before saving
CustomerSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Geocode customer address if modified
CustomerSchema.pre('save', async function(next) {
  // Skip if location is already set or address is not updated
  if (
    (!this.isModified('address.street') &&
     !this.isModified('address.city') &&
     !this.isModified('address.state') &&
     !this.isModified('address.zipCode')) ||
    // Skip if location coordinates are manually provided
    (this.location && 
     this.location.coordinates && 
     this.location.coordinates.length === 2 &&
     this.location.coordinates[0] !== 0 &&
     this.location.coordinates[1] !== 0)
  ) {
    return next();
  }
  
  // If we have a valid address, geocode it
  if (this.address && 
      this.address.street && 
      this.address.city && 
      this.address.state && 
      this.address.zipCode) {
    try {
      // Dynamically import geocoder to avoid circular dependencies
      const { geocodeAddress } = require('../utils/geocoder');
      
      // Geocode the address
      const geoLocation = await geocodeAddress(this.address);
      
      // Set the location field
      this.location = geoLocation;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    // If no address is provided, continue without geocoding
    next();
  }
});

// Method to check if entered password is correct
CustomerSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate JWT token
CustomerSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      role: 'customer',
      email: this.email
    }, 
    process.env.JWT_SECRET, 
    { 
      expiresIn: '24h' 
    }
  );
};

// Method to update current location
CustomerSchema.methods.updateCurrentLocation = async function(longitude, latitude) {
  if (!longitude || !latitude || 
      isNaN(longitude) || isNaN(latitude) ||
      longitude < -180 || longitude > 180 ||
      latitude < -90 || latitude > 90) {
    throw new Error('Invalid coordinates provided. Longitude must be between -180 and 180, and latitude between -90 and 90.');
  }
  
  this.location = {
    type: 'Point',
    coordinates: [longitude, latitude]
  };
  
  return this.save();
};

// Virtual field for full address
CustomerSchema.virtual('fullAddress').get(function() {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

module.exports = mongoose.model('Customer', CustomerSchema);
