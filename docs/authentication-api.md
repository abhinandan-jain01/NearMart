# NearMart Authentication API Documentation

This document provides detailed information about the authentication endpoints for the NearMart platform's customer-facing API.

## Base URL

All endpoints are relative to the base URL:

```
/api
```

## Response Format

All API responses follow a standard format:

```json
{
  "success": boolean,
  "message": string,
  "data": object | array (optional),
  "error": string (optional, only in development)
}
```

---

## Authentication Endpoints

### Customer Signup

Creates a new customer account and returns an authentication token.

- **URL**: `/customer/signup`
- **Method**: `POST`
- **Access**: Public

#### Request Body

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| name | String | Customer's full name | Yes |
| email | String | Customer's email address (must be unique) | Yes |
| password | String | Customer's password | Yes |
| phone | String | Customer's phone number | Yes |
| location | Object | GeoJSON Point object with coordinates | Yes |
| location.type | String | Must be "Point" | Yes |
| location.coordinates | Array | [longitude, latitude] as numbers | Yes |
| address | Object | Customer's address details | Yes |
| address.street | String | Street address | Yes |
| address.city | String | City | Yes |
| address.state | String | State | Yes |
| address.zipCode | String | ZIP/Postal code | Yes |

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Customer registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": "60d21b4667d0d8992e610c85",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### Error Responses

##### Missing Required Fields (400 Bad Request)

```json
{
  "success": false,
  "message": "Please provide all required fields"
}
```

##### Invalid Address (400 Bad Request)

```json
{
  "success": false,
  "message": "Please provide complete address information"
}
```

##### Email Already Exists (400 Bad Request)

```json
{
  "success": false,
  "message": "Customer with this email already exists"
}
```

##### Invalid Location Format (400 Bad Request)

```json
{
  "success": false,
  "message": "Invalid location format. Must be GeoJSON Point with coordinates [longitude, latitude]"
}
```

##### Server Error (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Server error",
  "error": "Detailed error message" // Only in development environment
}
```

#### Example Request

```bash
curl -X POST http://api.nearmart.com/api/customer/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123",
    "phone": "555-123-4567",
    "location": {
      "type": "Point",
      "coordinates": [-73.9857, 40.7484]
    },
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001"
    }
  }'
```

---

### Customer Login

Authenticates a customer and provides an authentication token.

- **URL**: `/customer/login`
- **Method**: `POST`
- **Access**: Public

#### Request Body

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| email | String | Customer's email address | Yes |
| password | String | Customer's password | Yes |

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": "60d21b4667d0d8992e610c85",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### Error Responses

##### Missing Fields (400 Bad Request)

```json
{
  "success": false,
  "message": "Please provide email and password"
}
```

##### Invalid Credentials (400 Bad Request)

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

##### Server Error (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Server error",
  "error": "Detailed error message" // Only in development environment
}
```

#### Example Request

```bash
curl -X POST http://api.nearmart.com/api/customer/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

## Authentication

After successful login or signup, the API provides a JWT (JSON Web Token) that should be included in the Authorization header for all subsequent requests that require authentication:

```
Authorization: Bearer <token>
```

The token contains encoded information about the customer and has an expiration time. If the token expires, the client must request a new token by logging in again.

