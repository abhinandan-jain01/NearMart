const swaggerJSDoc = require('swagger-jsdoc');
const swaggerDefinition = require('./swaggerDef');

// Swagger configuration options
const options = {
  swaggerDefinition,
  // Path to the API docs - route files containing annotations
  apis: [
    './routes/*.js',
    './models/*.js',
    './docs/components/*.yaml',  // For separate schema files if needed
    './docs/paths/*.yaml',       // For separate path files if needed
  ],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;

