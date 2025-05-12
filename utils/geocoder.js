const NodeGeocoder = require('node-geocoder');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Simple in-memory cache for geocoding results
const geocodeCache = new Map();
const CACHE_MAX_SIZE = 100; // Maximum number of cached addresses
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Logging utility
const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [GEOCODER] [${level}] ${message}`;
  
  if (level === 'ERROR') {
    console.error(logMessage);
    if (data) console.error(data);
  } else {
    console.log(logMessage);
    if (data) console.log(data);
  }
};

// Configure geocoder options
const options = {
  provider: process.env.GEOCODER_PROVIDER || 'openstreetmap', // Default to OpenStreetMap (free)
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null,
  timeout: parseInt(process.env.GEOCODER_TIMEOUT) || 5000
};

log('INFO', `Initializing geocoder with provider: ${options.provider}`);

// Initialize geocoder
let geocoder;
try {
  geocoder = NodeGeocoder(options);
  log('INFO', 'Geocoder initialized successfully');
} catch (error) {
  log('ERROR', 'Failed to initialize geocoder', error);
  // Fallback to openstreetmap if specified provider fails
  if (options.provider !== 'openstreetmap') {
    log('INFO', 'Falling back to openstreetmap provider');
    options.provider = 'openstreetmap';
    options.apiKey = null;
    try {
      geocoder = NodeGeocoder(options);
      log('INFO', 'Fallback geocoder initialized successfully');
    } catch (fallbackError) {
      log('ERROR', 'Failed to initialize fallback geocoder', fallbackError);
      throw new Error('Failed to initialize geocoder with any provider');
    }
  } else {
    throw error;
  }
}

// Track API calls for rate limiting
const apiCalls = {
  count: 0,
  resetTime: Date.now() + parseInt(process.env.GEOCODER_RATE_LIMIT_INTERVAL || 60000)
};

/**
 * Reset API call counter if reset time has passed
 */
const checkRateLimit = () => {
  const now = Date.now();
  if (now > apiCalls.resetTime) {
    apiCalls.count = 0;
    apiCalls.resetTime = now + parseInt(process.env.GEOCODER_RATE_LIMIT_INTERVAL || 60000);
  }
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Geocode an address to coordinates (GeoJSON Point) with retry logic
 * @param {Object} address - Address object with street, city, state, zipCode
 * @param {number} [maxRetries=2] - Maximum number of retries
 * @param {number} [retryDelay=1000] - Delay between retries in milliseconds
 * @returns {Promise<Object>} - GeoJSON Point with coordinates
 */
const geocodeAddress = async (address, maxRetries = 2, retryDelay = 1000) => {
  // Format the address for geocoding
  const formattedAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
  
  // Check cache first
  const cacheKey = formattedAddress.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    const cachedResult = geocodeCache.get(cacheKey);
    
    // Check if cache entry is still valid
    if (cachedResult.timestamp + CACHE_TTL > Date.now()) {
      log('INFO', `Using cached geocode for address: ${formattedAddress}`);
      return cachedResult.coordinates;
    } else {
      // Expired cache entry, remove it
      geocodeCache.delete(cacheKey);
      log('INFO', `Cache expired for address: ${formattedAddress}`);
    }
  }
  
  // Check rate limit
  checkRateLimit();
  
  const rateLimit = parseInt(process.env.GEOCODER_RATE_LIMIT || 60);
  
  if (apiCalls.count >= rateLimit) {
    const waitTime = Math.ceil((apiCalls.resetTime - Date.now()) / 1000);
    log('WARN', `Geocoding rate limit reached. Try again in ${waitTime} seconds.`);
    throw new Error(`Geocoding rate limit reached. Try again in ${waitTime} seconds.`);
  }
  
  log('INFO', `Geocoding address: ${formattedAddress}`);
  
  // Retry logic
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If not first attempt, log retry
      if (attempt > 0) {
        log('INFO', `Retry attempt ${attempt}/${maxRetries} for address: ${formattedAddress}`);
      }
      
      // Increment API call counter
      apiCalls.count++;
      
      // Geocode the address
      const results = await geocoder.geocode(formattedAddress);
      
      // Handle no results
      if (!results || results.length === 0) {
        throw new Error(`No geocoding results found for address: ${formattedAddress}`);
      }
      
      log('INFO', `Successfully geocoded address: ${formattedAddress}`, {
        latitude: results[0].latitude,
        longitude: results[0].longitude
      });
      
      // Create result object
      const result = {
        type: 'Point',
        coordinates: [results[0].longitude, results[0].latitude]
      };
      
      // Store in cache
      geocodeCache.set(cacheKey, {
        coordinates: result,
        timestamp: Date.now()
      });
      
      // Ensure cache doesn't grow too large by removing the oldest entries
      if (geocodeCache.size > CACHE_MAX_SIZE) {
        const oldestKey = [...geocodeCache.entries()]
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        geocodeCache.delete(oldestKey);
        log('INFO', `Cache limit reached. Removed oldest entry: ${oldestKey}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      log('ERROR', `Geocoding error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      
      // If we've reached max retries, throw the error
      if (attempt === maxRetries) {
        throw new Error(`Geocoding failed after ${maxRetries + 1} attempts: ${error.message}`);
      }
      
      // Wait before retrying
      await sleep(retryDelay * (attempt + 1));
    }
  }
  
  // This should never be reached due to the throw in the loop
  throw lastError || new Error('Geocoding failed due to unknown error');
};

/**
 * Reverse geocode coordinates to address with retry logic
 * @param {Array} coordinates - [longitude, latitude]
 * @param {number} [maxRetries=2] - Maximum number of retries
 * @param {number} [retryDelay=1000] - Delay between retries in milliseconds
 * @returns {Promise<Object>} - Address object
 */
const reverseGeocode = async (coordinates, maxRetries = 2, retryDelay = 1000) => {
  // Ensure coordinates are in the right format
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new Error('Invalid coordinates format. Must be [longitude, latitude]');
  }
  
  // Generate a cache key for coordinates
  const cacheKey = `reverse_${coordinates[0].toFixed(6)}_${coordinates[1].toFixed(6)}`;
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    const cachedResult = geocodeCache.get(cacheKey);
    
    // Check if cache entry is still valid
    if (cachedResult.timestamp + CACHE_TTL > Date.now()) {
      log('INFO', `Using cached reverse geocode for coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
      return cachedResult.address;
    } else {
      // Expired cache entry, remove it
      geocodeCache.delete(cacheKey);
      log('INFO', `Cache expired for coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
    }
  }
  
  // Check rate limit
  checkRateLimit();
  
  const rateLimit = parseInt(process.env.GEOCODER_RATE_LIMIT || 60);
  
  if (apiCalls.count >= rateLimit) {
    const waitTime = Math.ceil((apiCalls.resetTime - Date.now()) / 1000);
    log('WARN', `Geocoding rate limit reached. Try again in ${waitTime} seconds.`);
    throw new Error(`Geocoding rate limit reached. Try again in ${waitTime} seconds.`);
  }
  
  log('INFO', `Reverse geocoding coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
  
  // Retry logic
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If not first attempt, log retry
      if (attempt > 0) {
        log('INFO', `Retry attempt ${attempt}/${maxRetries} for coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
      }
      
      // Increment API call counter
      apiCalls.count++;
      
      // Reverse geocode
      const results = await geocoder.reverse({
        lat: coordinates[1],
        lon: coordinates[0]
      });
      
      // Handle no results
      if (!results || results.length === 0) {
        throw new Error(`No reverse geocoding results found for coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
      }
      
      log('INFO', `Successfully reverse geocoded coordinates: [${coordinates[0]}, ${coordinates[1]}]`, {
        formattedAddress: results[0].formattedAddress
      });
      
      // Format the address from results
      const address = {
        street: results[0].streetName || '',
        city: results[0].city || '',
        state: results[0].administrativeLevels?.level1short || results[0].administrativeLevels?.level1long || '',
        zipCode: results[0].zipcode || '',
        formattedAddress: results[0].formattedAddress || ''
      };
      
      // Store in cache
      geocodeCache.set(cacheKey, {
        address,
        timestamp: Date.now()
      });
      
      // Ensure cache doesn't grow too large
      if (geocodeCache.size > CACHE_MAX_SIZE) {
        const oldestKey = [...geocodeCache.entries()]
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        geocodeCache.delete(oldestKey);
      }
      
      return address;
    } catch (error) {
      lastError = error;
      log('ERROR', `Reverse geocoding error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      
      // If we've reached max retries, throw the error
      if (attempt === maxRetries) {
        throw new Error(`Reverse geocoding failed after ${maxRetries + 1} attempts: ${error.message}`);
      }
      
      // Wait before retrying
      await sleep(retryDelay * (attempt + 1));
    }
  }
  
  // This should never be reached due to the throw in the loop
  throw lastError || new Error('Reverse geocoding failed due to unknown error');
};

/**
 * Test the geocoder with a sample address
 * @returns {Promise<boolean>} - True if test succeeded
 */
const testGeocoder = async () => {
  const testAddress = {
    street: 'Connaught Place',
    city: 'New Delhi',
    state: 'Delhi',
    zipCode: '110001'
  };
  
  log('INFO', 'Testing geocoder with address:', testAddress);
  
  try {
    const result = await geocodeAddress(testAddress);
    log('INFO', 'Geocoder test successful:', result);
    return true;
  } catch (error) {
    log('ERROR', 'Geocoder test failed:', error);
    return false;
  }
};

// Run the test if this file is executed directly
if (require.main === module) {
  testGeocoder().then(success => {
    if (success) {
      console.log('Geocoder is working correctly.');
    } else {
      console.error('Geocoder test failed.');
    }
  });
}

module.exports = {
  geocoder,
  geocodeAddress,
  reverseGeocode,
  testGeocoder,
  // For debugging and testing
  clearCache: () => geocodeCache.clear()
};

