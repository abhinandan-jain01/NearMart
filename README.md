# NearMart Backend API

A robust RESTful API backend for NearMart, a platform connecting customers to nearby retailers using geolocation.

## 🎯 Purpose

NearMart's backend serves as the backbone of the platform, managing:
- Authentication for customers and retailers
- Product and store data
- Cart and order flows
- Secure, role-based access control
- Geolocation-based store discovery

## ⚙️ Architecture & Design

### RESTful API Architecture
- Built with Node.js and Express.js
- MongoDB for data storage
- JWT-based authentication
- Geospatial queries for location-based features

### 📂 Project Structure
```
nearmart-backend/
├── models/          # MongoDB schemas for each entity
│   ├── Retailer.js
│   ├── Customer.js
│   ├── Product.js
│   ├── Cart.js
│   └── Order.js
├── routes/          # API routes for customers and retailers
│   ├── retailer.js
│   └── customer.js
├── middleware/      # JWT verification middleware
│   └── auth.js
├── .env             # Environment variables
└── server.js        # Entry point (Express server)
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14.x or higher)
- npm (v6.x or higher)
- MongoDB (local or Atlas connection)

### Installation

1. Clone the repository
```bash
git clone https://github.com/abhinandan-jain01/NearMart.git
cd nearmart-backend
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables:
   - Create a `.env` file based on the provided example
   - Update MongoDB connection string and JWT secret

4. Start the server
```bash
# Development mode (with hot-reload)
npm run dev

# Production mode
npm start
```

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port number | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/nearmart` |
| `JWT_SECRET` | Secret for JWT token generation | Random string |
| `JWT_EXPIRY` | JWT token expiration time | `24h` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `http://localhost:3000,http://localhost:5173` |
| `DEFAULT_SEARCH_RADIUS_KM` | Default radius for store search | `5` |
| `STANDARD_DELIVERY_FEE` | Standard delivery fee | `5.00` |
| `TAX_RATE` | Tax rate for orders | `0.1` |

## 📜 API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/retailer/signup` | Register a new retailer | Public |
| `POST` | `/api/v1/retailer/login` | Authenticate retailer | Public |
| `POST` | `/api/v1/customer/signup` | Register a new customer | Public |
| `POST` | `/api/v1/customer/login` | Authenticate customer | Public |

### Retailer Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/retailer/profile` | Get retailer profile | Private - Retailer |
| `PUT` | `/api/v1/retailer/profile` | Update retailer profile | Private - Retailer |
| `GET` | `/api/v1/retailer/products` | Get retailer's products | Private - Retailer |
| `POST` | `/api/v1/retailer/products` | Add a new product | Private - Retailer |
| `PUT` | `/api/v1/retailer/products/:id` | Update a product | Private - Retailer |
| `DELETE` | `/api/v1/retailer/products/:id` | Delete a product | Private - Retailer |

### Customer Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/customer/profile` | Get customer profile | Private - Customer |
| `PUT` | `/api/v1/customer/profile` | Update customer profile | Private - Customer |
| `GET` | `/api/v1/customer/stores` | Get nearby stores | Private - Customer |
| `GET` | `/api/v1/customer/cart` | Get customer's cart | Private - Customer |
| `POST` | `/api/v1/customer/cart/add` | Add item to cart | Private - Customer |
| `POST` | `/api/v1/customer/cart/remove` | Remove item from cart | Private - Customer |
| `POST` | `/api/v1/customer/order` | Create new order from cart | Private - Customer |
| `GET` | `/api/v1/customer/orders` | Get order history | Private - Customer |

## 🔒 Security

- JWT-based authentication with role validation
- Password hashing using bcryptjs
- Rate limiting to prevent abuse
- Helmet for secure HTTP headers
- CORS protection
- MongoDB injection protection

## 🧪 Testing

API endpoints can be tested using Postman, Thunder Client, or any other API testing tool.

Example for testing customer login:
```
POST http://localhost:3000/api/v1/customer/login
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "password123"
}
```

## 🌐 Deployment

The API is designed to be easily deployable to platforms like:
- Heroku
- Railway
- Render
- AWS
- Azure

For production deployment:
1. Set `NODE_ENV=production`
2. Configure a production MongoDB instance
3. Set a strong `JWT_SECRET`
4. Configure appropriate `ALLOWED_ORIGINS`
5. Set up proper logging and monitoring

## 🛠️ Technologies Used

- **Node.js**: Backend runtime
- **Express.js**: Web framework
- **MongoDB**: Database
- **Mongoose**: ODM for MongoDB
- **bcryptjs**: Password hashing
- **jsonwebtoken**: Auth token generation/verification
- **express-rate-limit**: Rate limiting
- **helmet**: Security headers
- **cors**: Cross-Origin Resource Sharing
- **dotenv**: Environment variable management
- **morgan**: HTTP request logging

## 📝 License

[MIT License](LICENSE)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check [issues page](#).

#   N e a r M a r t 
 
 
