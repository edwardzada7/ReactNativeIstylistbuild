# iStylist Mobile App - API Integration Guide

## Overview

This mobile app is designed to connect to your existing production backend. All API services are already implemented and ready to consume your endpoints.

## Configuration

### 1. Set Your Backend URL

Edit `/app/frontend/.env` and set your production backend URL:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-production-backend.com/api
```

### 2. Authentication Flow

The app expects JWT-based authentication:

**Login Endpoint**: `POST /auth/login`
```json
// Request
{
  "email": "user@example.com",
  "password": "password123"
}

// Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "customer",
    "is_verified": true
  }
}
```

**Signup Endpoint**: `POST /auth/signup`
```json
// Request
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "phone": "+1234567890",
  "role": "customer"
}

// Response: Same as login
```

**Get Current User**: `GET /auth/me`
```json
// Headers
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
}

// Response
{
  "id": "user_123",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar": "base64_string_or_url",
  "role": "customer",
  "is_verified": true
}
```

### 3. Required Endpoints

All service methods are defined in `/app/frontend/src/services/`. Here's the complete list:

#### Auth Service (`auth.service.ts`)
- `POST /auth/login`
- `POST /auth/signup`
- `POST /auth/verify-otp`
- `POST /auth/resend-otp`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/refresh`

#### Provider Service (`provider.service.ts`)
- `GET /providers` - List providers with filters
- `GET /providers/:id` - Get provider details
- `GET /providers/:id/services` - Get provider services
- `GET /providers/featured` - Get featured providers
- `POST /providers/:id/save` - Save/unsave provider
- `GET /providers/saved` - Get saved providers
- `POST /providers` - Become a provider
- `PUT /providers/:id` - Update provider
- `GET /categories` - Get categories

#### Booking Service (`booking.service.ts`)
- `POST /bookings` - Create booking
- `GET /bookings` - Get user bookings
- `GET /bookings/:id` - Get booking details
- `PATCH /bookings/:id/status` - Update booking status
- `POST /bookings/:id/cancel` - Cancel booking
- `POST /bookings/:id/reschedule` - Reschedule booking

#### Wallet Service (`wallet.service.ts`)
- `GET /wallet` - Get wallet balance
- `GET /wallet/transactions` - Get transactions
- `POST /wallet/withdraw` - Initiate withdrawal
- `POST /wallet/fund` - Fund wallet
- `POST /wallet/verify-payment` - Verify payment

#### Feed Service (`feed.service.ts`)
- `GET /feed` - Get feed posts
- `POST /feed` - Create post
- `POST /feed/:id/like` - Toggle like
- `GET /feed/:id/comments` - Get comments
- `POST /feed/:id/comments` - Add comment
- `DELETE /feed/:id` - Delete post

#### Review Service (`feed.service.ts`)
- `GET /reviews/provider/:id` - Get provider reviews
- `POST /reviews` - Create review
- `GET /reviews/me` - Get my reviews

#### Message Service (`message.service.ts`)
- `GET /messages/conversations` - Get conversations
- `POST /messages/conversations` - Create conversation
- `GET /messages/conversations/:id/messages` - Get messages
- `POST /messages/conversations/:id/messages` - Send message
- `POST /messages/conversations/:id/read` - Mark as read

#### Notification Service (`notification.service.ts`)
- `GET /notifications` - Get notifications
- `POST /notifications/:id/read` - Mark as read
- `POST /notifications/read-all` - Mark all as read
- `GET /notifications/unread-count` - Get unread count
- `POST /notifications/register-token` - Register push token

#### Support Service (`support.service.ts`)
- `POST /support/tickets` - Create support ticket
- `GET /support/tickets/me` - Get my tickets
- `GET /support/tickets/:id` - Get ticket details
- `POST /reports` - Create report
- `POST /kyc/submit` - Submit KYC
- `GET /kyc/status` - Get KYC status

### 4. Request/Response Format

All endpoints should follow these conventions:

**Success Response**:
```json
{
  "data": { /* your data */ },
  "message": "Success message (optional)"
}
```

**Error Response**:
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

**Paginated Response**:
```json
{
  "data": [ /* items */ ],
  "total": 100,
  "page": 1,
  "per_page": 20,
  "total_pages": 5
}
```

### 5. Image Handling

**Important**: The app expects images in **base64 format** for display.

When sending images to the backend:
```javascript
// Convert image to base64
const base64Image = await FileSystem.readAsStringAsync(imageUri, {
  encoding: FileSystem.EncodingType.Base64,
});

// Send to backend
await apiService.post('/endpoint', {
  image: `data:image/jpeg;base64,${base64Image}`
});
```

When receiving images from backend:
```javascript
// Backend should return
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}

// Or just the base64 string (app will handle it)
{
  "image": "/9j/4AAQSkZJRg..."
}
```

### 6. Token Management

The app automatically handles:
- ✅ Adding `Authorization: Bearer <token>` to all requests
- ✅ Token refresh on 401 errors (if `/auth/refresh` is implemented)
- ✅ Automatic logout on auth failure
- ✅ Secure token storage

### 7. Testing the Integration

1. **Update the .env file** with your backend URL
2. **Restart the app**: `sudo supervisorctl restart expo`
3. **Try login** with real credentials from your backend
4. **Check console logs** for API calls and responses

### 8. Error Handling

All API calls are wrapped in try/catch blocks:

```typescript
try {
  const data = await apiService.get('/endpoint');
  // Handle success
} catch (error) {
  // Error is automatically displayed to user via Alert
  console.error('API Error:', error);
}
```

### 9. Common Issues

**Issue**: API calls failing
- Check if `EXPO_PUBLIC_API_BASE_URL` is correct
- Ensure backend has CORS enabled
- Check backend logs for errors

**Issue**: Authentication not working
- Verify JWT token format
- Check token expiry
- Ensure `/auth/me` endpoint works

**Issue**: Images not showing
- Ensure images are in base64 format
- Check image data is not corrupted
- Verify base64 prefix (`data:image/jpeg;base64,`)

### 10. Next Steps

1. Connect to your production backend
2. Test authentication flow
3. Test each feature (bookings, wallet, feed, etc.)
4. Implement remaining screens as needed
5. Add error handling and loading states
6. Test on real devices
7. Submit to app stores

---

**Need Help?**

All service files are in `/app/frontend/src/services/`. Review these files to see the exact API calls being made.