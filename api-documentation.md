# NearMart API Documentation

## Customer API

### Authentication Endpoints

#### Sign Up

- **Method**: POST
- **Path**: `/api/customer/signup`
- **Access**: Public

**Request Body Parameters:**

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| name | String | Yes | Customer's full name | Non-empty string |
| email | String | Yes | Customer's email address | Valid email format |
| password | String | Yes | Customer's password | Min 6 characters |
| phone | String | No | Customer's phone number | Valid phone format |
| location | Object | Yes | Customer's geographical coordinates | GeoJSON Point format |
| location.type | String | Yes | GeoJSON type | Must be "Point" |
| location.coordinates | Array | Yes | [longitude, latitude] | Array of 2 numbers |
| address | Object | Yes | Customer's physical address | Complete address object |
| address.street | String | Yes | Street address | Non-empty string |
| address.city | String | Yes | City | Non-empty string |
| address.state | String | Yes | State/province | Non-empty string |
| address.zipCode | String | Yes | Postal/ZIP code | Non-empty string |

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Customer registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": "60a1e2c7d32f1e2b3c4d5e6f",
    "name": "John Doe",
    "email": "john.doe@example.com"
  }
}
```

**Error Responses:**

- **400 Bad Request**: Missing required fields
```json
{
  "success": false,
  "message": "Please provide all required fields"
}
```

- **400 Bad Request**: Invalid address format
```json
{
  "success": false,
  "message": "Please provide complete address information"
}
```

- **400 Bad Request**: Email already exists
```json
{
  "success": false,
  "message": "Customer with this email already exists"
}
```

- **400 Bad Request**: Invalid location format
```json
{
  "success": false,
  "message": "Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]"
}
```

- **500 Server Error**: Server error
```json
{
  "success": false,
  "message": "Server error"
}
```

**Example cURL Request:**

```bash
curl -X POST https://api.nearmart.com/api/customer/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "securepassword",
    "phone": "+1234567890",
    "location": {
      "type": "Point",
      "coordinates": [-73.856077, 40.848447]
    },
    "address": {
      "street": "123 Main St",
      "city": "Brooklyn",
      "state": "NY",
      "zipCode": "11201"
    }
  }'
```

#### Login

- **Method**: POST
- **Path**: `/api/customer/login`
- **Access**: Public

**Request Body Parameters:**

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| email | String | Yes | Customer's email address | Valid email format |
| password | String | Yes | Customer's password | Non-empty string |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": "60a1e2c7d32f1e2b3c4d5e6f",
    "name": "John Doe",
    "email": "john.doe@example.com"
  }
}
```

**Error Responses:**

- **400 Bad Request**: Missing credentials
```json
{
  "success": false,
  "message": "Please provide email and password"
}
```

- **400 Bad Request**: Invalid credentials
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

- **500 Server Error**: Server error
```json
{
  "success": false,
  "message": "Server error"
}
```

**Example cURL Request:**

```bash
curl -X POST https://api.nearmart.com/api/customer/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "securepassword"
  }'
```

**Authentication Token Usage:**

The token received in the login and signup responses should be included in the Authorization header for all protected endpoints:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Profile Management Endpoints

#### Get Customer Profile

- **Method**: GET
- **Path**: `/api/customer/profile`
- **Access**: Private (requires authentication)

**Headers:**

| Header | Value | Required | Description |
|--------|-------|----------|-------------|
| Authorization | Bearer [token] | Yes | JWT authentication token |

**Success Response (200 OK):**

```json
{
  "success": true,
  "customer": {
    "id": "60a1e2c7d32f1e2b3c4d5e6f",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "address": {
      "street": "123 Main St",
      "city": "Brooklyn",
      "state": "NY",
      "zipCode": "11201"
    },
    "location": {
      "type": "Point",
      "coordinates": [-73.856077, 40.848447]
    },
    "deliveryPreferences": {
      "preferredTime": "evening",
      "contactlessDelivery": true,
      "deliveryInstructions": "Leave at front door"
    },
    "createdAt": "2023-05-15T10:30:00.000Z"
  }
}
```

**Error Responses:**

- **401 Unauthorized**: No authentication token provided or invalid token
```json
{
  "success": false,
  "message": "No token, authorization denied"
}
```

- **404 Not Found**: Customer not found
```json
{
  "success": false,
  "message": "Customer not found"
}
```

- **500 Server Error**: Server error
```json
{
  "success": false,
  "message": "Server error"
}
```

**Example cURL Request:**

```bash
curl -X GET https://api.nearmart.com/api/customer/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Update Customer Profile

- **Method**: PUT
- **Path**: `/api/customer/profile`
- **Access**: Private (requires authentication)

**Headers:**

| Header | Value | Required | Description |
|--------|-------|----------|-------------|
| Authorization | Bearer [token] | Yes | JWT authentication token |

**Request Body Parameters:**

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| name | String | No | Customer's full name | Non-empty string |
| phone | String | No | Customer's phone number | Valid phone format |
| address | Object | No | Customer's physical address | Complete address object if provided |
| address.street | String | Yes (if address provided) | Street address | Non-empty string |
| address.city | String | Yes (if address provided) | City | Non-empty string |
| address.state | String | Yes (if address provided) | State/province | Non-empty string |
| address.zipCode | String | Yes (if address provided) | Postal/ZIP code | Non-empty string |
| location | Object | No | Customer's geographical coordinates | GeoJSON Point format if provided |
| location.type | String | Yes (if location provided) | GeoJSON type | Must be "Point" |
| location.coordinates | Array | Yes (if location provided) | [longitude, latitude] | Array of 2 numbers |
| deliveryPreferences | Object | No | Delivery preferences | Valid delivery preferences object |
| deliveryPreferences.preferredTime | String | No | Preferred delivery time | One of: "morning", "afternoon", "evening", "anytime" |
| deliveryPreferences.contactlessDelivery | Boolean | No | Whether contactless delivery is preferred | true or false |
| deliveryPreferences.deliveryInstructions | String | No | Special delivery instructions | String |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "customer": {
    "id": "60a1e2c7d32f1e2b3c4d5e6f",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "address": {
      "street": "456 Park Avenue",
      "city": "Brooklyn",
      "state": "NY",
      "zipCode": "11201"
    },
    "location": {
      "type": "Point",
      "coordinates": [-73.856077, 40.848447]
    },
    "deliveryPreferences": {
      "preferredTime": "evening",
      "contactlessDelivery": true,
      "deliveryInstructions": "Leave at front door"
    }
  }
}
```

**Error Responses:**

- **401 Unauthorized**: No authentication token provided or invalid token
```json
{
  "success": false,
  "message": "No token, authorization denied"
}
```

- **404 Not Found**: Customer not found
```json
{
  "success": false,
  "message": "Customer not found"
}
```

- **400 Bad Request**: Invalid address format
```json
{
  "success": false,
  "message": "Please provide complete address information"
}
```

- **400 Bad Request**: Invalid location format
```json
{
  "success": false,
  "message": "Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]"
}
```

- **400 Bad Request**: Invalid preferred delivery time
```json
{
  "success": false,
  "message": "Invalid preferred time. Must be one of: morning, afternoon, evening, anytime"
}
```

- **500 Server Error**: Server error
```json
{
  "success": false,
  "message": "Server error"
}
```

**Example cURL Request:**

```bash
curl -X PUT https://api.nearmart.com/api/customer/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "John Smith",
    "phone": "+1987654321",
    "address": {
      "street": "456 Park Avenue",
      "city": "Brooklyn",
      "state": "NY",
      "zipCode": "11201"
    },
    "location": {
      "type": "Point",
      "coordinates": [-73.956077, 40.748447]
    },
    "deliveryPreferences": {
      "preferredTime": "evening",
      "contactlessDelivery": true,
      "deliveryInstructions": "Call when arriving"
    }
  }'
```

