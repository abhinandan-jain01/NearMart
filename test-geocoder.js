const { geocodeAddress, reverseGeocode, clearCache } = require('./utils/geocoder');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Test addresses
const testAddresses = [
  {
    name: "Delhi Address",
    address: {
      street: 'Connaught Place',
      city: 'New Delhi',
      state: 'Delhi',
      zipCode: '110001'
    },
    expectedCoordinates: [77.2, 28.6] // Approximate coordinates for validation
  },
  {
    name: "Mumbai Address",
    address: {
      street: 'Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400020'
    },
    expectedCoordinates: [72.8, 19.0] // Approximate coordinates for validation
  }
];

// Test coordinates for reverse geocoding
const testCoordinates = [
  {
    name: "New Delhi Coordinates",
    coordinates: [77.2273, 28.6139],
    expectedCity: "Delhi"
  },
  {
    name: "Mumbai Coordinates",
    coordinates: [72.8777, 19.0760],
    expectedCity: "Mumbai"
  }
];

// Invalid inputs for error testing
const invalidInputs = {
  address: {
    emptyAddress: {},
    missingRequiredFields: {
      street: '123 Main St',
      // Missing city, state, zipCode
    },
    invalidFormat: "This is not an address object"
  },
  coordinates: {
    emptyArray: [],
    wrongLength: [77.2],
    invalidTypes: ["not", "coordinates"],
    outOfRange: [200, 100] // Invalid longitude/latitude
  }
};

// Utility function to check if coordinates are within expected range
const areCoordinatesValid = (actual, expected, tolerance = 1.0) => {
  if (!actual || !actual.coordinates || !Array.isArray(actual.coordinates) || actual.coordinates.length !== 2) {
    return false;
  }
  
  const [actualLon, actualLat] = actual.coordinates;
  const [expectedLon, expectedLat] = expected;
  
  const lonDiff = Math.abs(actualLon - expectedLon);
  const latDiff = Math.abs(actualLat - expectedLat);
  
  return lonDiff <= tolerance && latDiff <= tolerance;
};

// Pretty print results
const printResult = (testName, passed, details = null) => {
  const result = passed ? '✅ PASSED' : '❌ FAILED';
  console.log(`${result} - ${testName}`);
  if (details && !passed) {
    console.log(`  Details: ${details}`);
  }
};

// Run all tests
const runTests = async () => {
  console.log('🧪 STARTING GEOCODER TESTS 🧪');
  console.log('============================');
  
  try {
    // Test 1: Forward Geocoding
    console.log('\n1️⃣ Testing Forward Geocoding (Address → Coordinates)');
    for (const test of testAddresses) {
      try {
        console.log(`\n→ Testing: ${test.name}`);
        const result = await geocodeAddress(test.address);
        
        // Verify result format
        const hasCorrectType = result.type === 'Point';
        printResult('Result has correct GeoJSON type', hasCorrectType);
        
        // Verify coordinates array format
        const hasValidCoords = Array.isArray(result.coordinates) && result.coordinates.length === 2;
        printResult('Result has valid coordinates array', hasValidCoords);
        
        // Verify coordinates are in expected range
        const coordsInRange = areCoordinatesValid(result, test.expectedCoordinates);
        printResult('Coordinates are in expected range', coordsInRange, 
          coordsInRange ? null : `Expected near [${test.expectedCoordinates}], got [${result.coordinates}]`);
        
        console.log(`  Coordinates: [${result.coordinates[0]}, ${result.coordinates[1]}]`);
      } catch (error) {
        printResult(`Geocoding ${test.name}`, false, error.message);
      }
    }
    
    // Test 2: Reverse Geocoding
    console.log('\n2️⃣ Testing Reverse Geocoding (Coordinates → Address)');
    for (const test of testCoordinates) {
      try {
        console.log(`\n→ Testing: ${test.name}`);
        const result = await reverseGeocode(test.coordinates);
        
        // Verify result has address fields
        const hasAddressFields = result && result.street !== undefined && 
                                result.city !== undefined && 
                                result.state !== undefined && 
                                result.zipCode !== undefined;
        printResult('Result has expected address fields', hasAddressFields);
        
        // Verify city is in expected region
        const cityMatches = result.city && 
          (result.city.includes(test.expectedCity) || 
           result.state.includes(test.expectedCity));
        printResult('Location matches expected region', cityMatches,
          cityMatches ? null : `Expected to find "${test.expectedCity}" in result`);
        
        console.log(`  Address: ${result.formattedAddress}`);
      } catch (error) {
        printResult(`Reverse geocoding ${test.name}`, false, error.message);
      }
    }
    
    // Test 3: Caching Mechanism
    console.log('\n3️⃣ Testing Caching Mechanism');
    
    // Clear cache first
    clearCache();
    console.log('  Cache cleared');
    
    // First geocoding request (should hit the API)
    console.log('  First request (should hit API)...');
    const start1 = Date.now();
    await geocodeAddress(testAddresses[0].address);
    const duration1 = Date.now() - start1;
    
    // Second geocoding request for the same address (should hit cache)
    console.log('  Second request (should hit cache)...');
    const start2 = Date.now();
    await geocodeAddress(testAddresses[0].address);
    const duration2 = Date.now() - start2;
    
    // Verify second request was faster (indicating cache hit)
    const cachingWorks = duration2 < duration1;
    printResult('Caching mechanism works (second request faster)', cachingWorks,
      `First request: ${duration1}ms, Second request: ${duration2}ms`);
    
    // Test 4: Error Handling with Invalid Inputs
    console.log('\n4️⃣ Testing Error Handling with Invalid Inputs');
    
    // Test invalid address
    for (const [key, value] of Object.entries(invalidInputs.address)) {
      try {
        console.log(`\n→ Testing invalid address: ${key}`);
        await geocodeAddress(value);
        printResult(`Handled invalid address (${key})`, false, 'Should have thrown an error');
      } catch (error) {
        printResult(`Handled invalid address (${key})`, true, error.message);
      }
    }
    
    // Test invalid coordinates
    for (const [key, value] of Object.entries(invalidInputs.coordinates)) {
      try {
        console.log(`\n→ Testing invalid coordinates: ${key}`);
        await reverseGeocode(value);
        printResult(`Handled invalid coordinates (${key})`, false, 'Should have thrown an error');
      } catch (error) {
        printResult(`Handled invalid coordinates (${key})`, true, error.message);
      }
    }
    
    console.log('\n============================');
    console.log('🎉 ALL TESTS COMPLETED 🎉');
    
  } catch (error) {
    console.error('\n❌ TEST EXECUTION ERROR ❌');
    console.error(error);
  }
};

// Run all tests
runTests().then(() => {
  console.log('\nTests completed.');
}).catch(error => {
  console.error('Error in test execution:', error);
});
