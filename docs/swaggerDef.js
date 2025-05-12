/**
 * Swagger/OpenAPI Configuration
 * Base configuration for NearMart API documentation
 */

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'NearMart API',
    version: '1.0.0',
    description: 'NearMart is a local marketplace connecting customers with nearby retailers',
    license: {
      name: 'ISC',
      url: 'https://opensource.org/licenses/ISC',
    },
    contact: {
      name: 'NearMart Support',
      url: 'https://nearmart.com/contact',
      email: 'support@nearmart.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.nearmart.com',
      description: 'Production server',
    },
  ],
  // Define security schemes
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token in the format: Bearer <token>',
      },
    },
    schemas: {
      // Common response format
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates if the request was successful',
            example: true,
          },
          message: {
            type: 'string',
            description: 'Descriptive message about the response',
            example: 'Operation successful',
          },
        },
      },
      // GeoJSON Point representation
      GeoJSONPoint: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['Point'],
            description: 'GeoJSON type, must be "Point"',
            example: 'Point',
          },
          coordinates: {
            type: 'array',
            description: 'Coordinates in [longitude, latitude] format',
            example: [-73.856077, 40.848447],
            items: {
              type: 'number',
            },
            minItems: 2,
            maxItems: 2,
          },
        },
        required: ['type', 'coordinates'],
      },
      // Address structure
      Address: {
        type: 'object',
        properties: {
          street: {
            type: 'string',
            description: 'Street address',
            example: '123 Main St',
          },
          city: {
            type: 'string',
            description: 'City',
            example: 'Brooklyn',
          },
          state: {
            type: 'string',
            description: 'State/province',
            example: 'NY',
          },
          zipCode: {
            type: 'string',
            description: 'Postal/ZIP code',
            example: '11201',
          },
        },
        required: ['street', 'city', 'state', 'zipCode'],
      },
      // Customer schema
      Customer: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Customer ID',
            example: '60a1e2c7d32f1e2b3c4d5e6f',
          },
          name: {
            type: 'string',
            description: 'Customer name',
            example: 'John Doe',
          },
          email: {
            type: 'string',
            description: 'Customer email',
            example: 'john.doe@example.com',
          },
          phone: {
            type: 'string',
            description: 'Customer phone number',
            example: '+1234567890',
          },
          address: {
            $ref: '#/components/schemas/Address',
          },
          location: {
            $ref: '#/components/schemas/GeoJSONPoint',
          },
          deliveryPreferences: {
            type: 'object',
            properties: {
              preferredTime: {
                type: 'string',
                enum: ['morning', 'afternoon', 'evening', 'anytime'],
                description: 'Preferred delivery time of day',
                example: 'evening',
              },
              contactlessDelivery: {
                type: 'boolean',
                description: 'Whether contactless delivery is preferred',
                example: true,
              },
              deliveryInstructions: {
                type: 'string',
                description: 'Special delivery instructions',
                example: 'Leave at front door',
              },
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp',
            example: '2023-05-15T10:30:00.000Z',
          },
        },
      },
      // Retailer schema
      Retailer: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Retailer ID',
            example: '60a1e2c7d32f1e2b3c4d5e6f',
          },
          name: {
            type: 'string',
            description: 'Owner name',
            example: 'Jane Smith',
          },
          email: {
            type: 'string',
            description: 'Retailer email',
            example: 'jane.smith@example.com',
          },
          storeName: {
            type: 'string',
            description: 'Store name',
            example: 'Jane\'s Grocery',
          },
          storeDescription: {
            type: 'string',
            description: 'Store description',
            example: 'Fresh produce and groceries',
          },
          phone: {
            type: 'string',
            description: 'Store phone number',
            example: '+1234567890',
          },
          address: {
            $ref: '#/components/schemas/Address',
          },
          location: {
            $ref: '#/components/schemas/GeoJSONPoint',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp',
            example: '2023-05-15T10:30:00.000Z',
          },
        },
      },
      // Product schema
      Product: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Product ID',
            example: '60a1e2c7d32f1e2b3c4d5e7f',
          },
          name: {
            type: 'string',
            description: 'Product name',
            example: 'Organic Apples',
          },
          description: {
            type: 'string',
            description: 'Product description',
            example: 'Fresh organic apples from local farms',
          },
          price: {
            type: 'number',
            description: 'Product price',
            example: 2.99,
          },
          images: {
            type: 'array',
            description: 'Product images',
            items: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/images/apple.jpg',
            },
          },
          category: {
            type: 'string',
            description: 'Product category',
            example: 'Produce',
          },
          stock: {
            type: 'integer',
            description: 'Available stock quantity',
            example: 50,
          },
          isAvailable: {
            type: 'boolean',
            description: 'Indicates if the product is available for purchase',
            example: true,
          },
          retailer: {
            type: 'string',
            description: 'ID of the retailer selling this product',
            example: '60a1e2c7d32f1e2b3c4d5e6f',
          },
        },
      },
      // Error response schema
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates that the request failed',
            example: false,
          },
          message: {
            type: 'string',
            description: 'Error message',
            example: 'An error occurred',
          },
          error: {
            type: 'string',
            description: 'Detailed error information (only in development mode)',
            example: 'Detailed error stack or message',
          },
        },
      },
    },
  },
  // Global security - applied to all endpoints that don't override it
  security: [
    {
      bearerAuth: [],
    },
  ],
  // Tags for API categorization
  tags: [
    {
      name: 'Customer Authentication',
      description: 'Customer signup and login endpoints',
    },
    {
      name: 'Customer Profile',
      description: 'Customer profile management',
    },
    {
      name: 'Retailer Authentication',
      description: 'Retailer signup and login endpoints',
    },
    {
      name: 'Retailer Profile',
      description: 'Retailer profile management',
    },
    {
      name: 'Products',
      description: 'Product management and querying',
    },
    {
      name: 'Cart',
      description: 'Shopping cart operations',
    },
    {
      name: 'Orders',
      description: 'Order creation and management',
    },
    {
      name: 'Stores',
      description: 'Store discovery and information',
    },
  ],
};

module.exports = swaggerDefinition;

