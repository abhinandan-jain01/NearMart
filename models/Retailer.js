const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Define the Retailer schema
const RetailerSchema = new mongoose.Schema({
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
  storeName: {
    type: String,
    required: [true, 'Store name is required'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in query results by default
  },
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
      validate: {
        validator: function(coords) {
          // Simple validation for longitude/latitude ranges
          return Array.isArray(coords) && 
                 coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Coordinates must be a valid [longitude, latitude] pair'
      }
    }
  },
  // Additional fields
  phone: {
    type: String,
    trim: true
  },
  storeDescription: {
    type: String,
    trim: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// These are just schema-level definitions
// Actual index management happens in the setupIndexes function below
RetailerSchema.index({ location: '2dsphere' });

// Function to manage indexes at application startup
// This will drop problematic indexes (like userId) and create only the ones we need
const setupIndexes = async function() {
  try {
    const Retailer = mongoose.model('Retailer', RetailerSchema);
    const collection = Retailer.collection;
    
    console.log('Setting up Retailer model indexes...');
    
    // Get existing indexes
    const indexInfo = await collection.indexes();
    console.log('Current Retailer indexes:', indexInfo.map(idx => idx.name));
    
    // Drop problematic indexes if they exist
    const problematicIndexes = ['userId_1'];
    for (const indexName of problematicIndexes) {
      try {
        // Check if the index exists before trying to drop it
        if (indexInfo.some(idx => idx.name === indexName)) {
          console.log(`Dropping problematic index: ${indexName}`);
          await collection.dropIndex(indexName);
          console.log(`Successfully dropped index: ${indexName}`);
        }
      } catch (error) {
        console.error(`Error dropping index ${indexName}:`, error);
        // Continue even if we can't drop an index
      }
    }
    
    // Create our required indexes if they don't exist
    // These operations are idempotent - they won't create duplicates
    console.log('Creating/Ensuring required indexes...');
    
    // Email unique index
    await collection.createIndex({ email: 1 }, { 
      unique: true,
      background: true,
      name: 'email_1'
    });
    
    // Geospatial index
    await collection.createIndex({ location: '2dsphere' }, {
      background: true,
      name: 'location_2dsphere'
    });
    
    console.log('Retailer model indexes setup complete');
    return true;
  } catch (error) {
    console.error('Error setting up Retailer model indexes:', error);
    return false;
  }
};

// Hash password before saving
RetailerSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    console.error('Password hashing error:', error);
    next(error);
  }
});

// Geocode retailer address if modified
RetailerSchema.pre('save', async function(next) {
  try {
    // Skip geocoding if:
    // 1. Address fields haven't been modified AND
    // 2. Either no location exists, or valid location coordinates exist
    const addressModified = this.isModified('address.street') || 
                          this.isModified('address.city') || 
                          this.isModified('address.state') || 
                          this.isModified('address.zipCode');
                          
    const hasValidCoordinates = this.location && 
                               this.location.coordinates && 
                               Array.isArray(this.location.coordinates) &&
                               this.location.coordinates.length === 2 &&
                               this.location.coordinates[0] !== 0 &&
                               this.location.coordinates[1] !== 0;
    
    // Skip if address hasn't changed and we have valid coordinates
    if (!addressModified && hasValidCoordinates) {
      return next();
    }
    
    // Check if we have a valid address to geocode
    if (this.address && 
        this.address.street && 
        this.address.city && 
        this.address.state && 
        this.address.zipCode) {
      
      // Import geocoder here to avoid circular dependencies
      const { geocodeAddress } = require('../utils/geocoder');
      
      // Geocode the address
      const geoLocation = await geocodeAddress(this.address);
      
      // Set the location field
      this.location = geoLocation;
      next();
    } else {
      // Initialize empty location if none exists
      if (!this.location) {
        this.location = {
          type: 'Point',
          coordinates: [0, 0]
        };
      }
      
      next();
    }
  } catch (error) {
    console.error('Geocoding error during retailer save:', error);
    
    // Don't fail the save operation if geocoding fails
    // Just set default coordinates and continue
    if (!this.location) {
      this.location = {
        type: 'Point',
        coordinates: [0, 0]
      };
    }
    
    // Continue with save operation despite geocoding error
    next();
  }
});

// Remove any legacy userId field reference if present
RetailerSchema.pre('save', function(next) {
  // Ensure there's no userId field that might be causing index issues
  if (this._doc.hasOwnProperty('userId')) {
    delete this._doc.userId;
  }
  next();
});

// Method to check if entered password is correct
RetailerSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate JWT token
RetailerSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      role: 'retailer',
      email: this.email
    }, 
    process.env.JWT_SECRET, 
    { 
      expiresIn: '24h' 
    }
  );
};

// Virtual field for full store information
RetailerSchema.virtual('storeInfo').get(function() {
  return {
    storeName: this.storeName,
    storeDescription: this.storeDescription,
    location: this.location
  };
});

const Retailer = mongoose.model('Retailer', RetailerSchema);

// Export both the model and the setup function
module.exports = Retailer;
module.exports.setupIndexes = setupIndexes;
