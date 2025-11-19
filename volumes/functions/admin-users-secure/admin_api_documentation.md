# S.A.G.E. Admin API - Complete Documentation

## Overview

The S.A.G.E. Admin API is an enterprise-grade, ultra-secure user management system built for self-hosted Supabase environments. It provides comprehensive CRUD operations for user management with multiple layers of security and audit capabilities.

## Security Architecture

### Multi-Layer Security Model

The API implements **4 distinct security layers** that ALL must pass for access:

1. **Admin Secret Verification**: Custom secret key in `x-admin-secret` header
2. **JWT Token Authentication**: Valid Supabase authentication token required
3. **Email Whitelist**: Only pre-approved admin emails allowed
4. **Database Tier Verification**: User must have `tier = 'admin'` in database

### Authorized Admin Users

#### Email Whitelist (Can Access API):
- `supadatain@gmail.com` (Primary Admin)
- `elijahfurlonge@yahoo.com` (Secondary Admin)
- `gurby1@gmail.com` (Client Admin #1)
- `gurby1@yahoo.com` (Client Admin #2)

#### Admin Creators (Can Create Other Admins):
- `supadatain@gmail.com` (Primary Admin)
- `gurby1@gmail.com` (Client Admin Creator)
- `gurby1@yahoo.com` (Client Admin Creator)

> **Note**: `elijahfurlonge@yahoo.com` can use all admin functions but cannot create new admin users.

## API Endpoints

### Base URL
```
https://supabase.data2int.com/functions/v1/admin-users-secure
```

### Authentication Headers
All requests require these headers:
```http
Authorization: Bearer <JWT_TOKEN>
x-admin-secret: <ADMIN_SECRET_KEY>
Content-Type: application/json
```

### Sensitive Operations
DELETE and bulk operations require an additional confirmation header:
```http
x-operation-confirm: <USER_ID>-<TIMESTAMP>
```

---

## Endpoint Reference

### 🔍 Health & Monitoring

#### `GET /health`
**Description**: Health check and system status  
**Security**: Admin authentication required

**Response**:
```json
{
  "success": true,
  "message": "Admin function with FULL SECURITY working!",
  "authenticated_user": "supadatain@gmail.com",
  "database_tier": "admin",
  "security_layers": ["admin_secret", "jwt_token", "email_whitelist", "database_tier"],
  "timestamp": "2025-11-06T23:22:23.000Z"
}
```

#### `GET /cleanup`
**Description**: Remove orphaned authentication users  
**Security**: Admin authentication required

**Response**:
```json
{
  "success": true,
  "message": "Cleaned up 2 orphaned auth users",
  "total_orphaned": 2,
  "cleaned": 2,
  "results": [
    {
      "id": "auth-user-id-1",
      "email": "orphaned@example.com",
      "status": "deleted"
    }
  ],
  "authenticated_user": "admin@example.com",
  "timestamp": "2025-11-06T23:22:23.146Z"
}
```

### 📊 Analytics & Statistics

#### `GET /users/stats`
**Description**: Retrieve comprehensive user statistics  
**Security**: Admin authentication required

**Response**:
```json
{
  "success": true,
  "message": "User statistics retrieved",
  "data": {
    "totalUsers": 12,
    "basicUsers": 6,
    "premiumUsers": 4,
    "adminUsers": 2,
    "newUsersLast30Days": 3,
    "premiumPercentage": 33
  },
  "authenticated_user": "admin@example.com",
  "timestamp": "2025-11-06T23:22:23.073Z"
}
```

### 👥 User Management

#### `GET /users`
**Description**: List users with pagination, search, and filtering  
**Security**: Admin authentication required

**Query Parameters**:
- `page` (default: 1): Page number
- `limit` (default: 50, max: 100): Items per page
- `search`: Search in first_name, last_name, email
- `tier`: Filter by user tier (basic/premium/admin)
- `sortBy` (default: created_at): Sort field
- `sortOrder` (default: desc): Sort direction (asc/desc)

**Example**:
```bash
GET /users?page=1&limit=10&search=john&tier=premium&sortBy=created_at&sortOrder=desc
```

**Response**:
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": 1,
      "auth_user_id": "uuid-here",
      "created_at": "2025-11-06T23:22:23.430Z",
      "first_name": "John",
      "last_name": "Doe",
      "tier": "premium",
      "email": "john@example.com",
      "upgraded_at": "2025-11-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  },
  "authenticated_user": "admin@example.com",
  "timestamp": "2025-11-06T23:22:23.000Z"
}
```

#### `POST /users`
**Description**: Create a new user  
**Security**: Admin authentication required

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "first_name": "New",
  "last_name": "User",
  "tier": "basic"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Test user created successfully",
  "data": {
    "id": 24,
    "auth_user_id": "55b03423-c832-4adf-a2af-ada7645661a9",
    "created_at": "2025-11-06T23:22:23.430Z",
    "first_name": "New",
    "last_name": "User",
    "tier": "basic",
    "email": "newuser@example.com",
    "upgraded_at": null
  },
  "auth_user_id": "55b03423-c832-4adf-a2af-ada7645661a9",
  "authenticated_user": "admin@example.com",
  "timestamp": "2025-11-06T23:22:23.435Z"
}
```

#### `GET /users/{id}`
**Description**: Retrieve specific user details  
**Security**: Admin authentication required

**Response**:
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": 1,
    "auth_user_id": "uuid-here",
    "created_at": "2025-11-06T23:22:23.430Z",
    "first_name": "John",
    "last_name": "Doe",
    "tier": "premium",
    "email": "john@example.com",
    "upgraded_at": "2025-11-01T10:00:00Z"
  },
  "authenticated_user": "admin@example.com",
  "timestamp": "2025-11-06T23:22:23.000Z"
}
```

#### `PUT /users/{id}`
**Description**: Update user information  
**Security**: Admin authentication required

**Updatable Fields**:
- `first_name`: User's first name
- `last_name`: User's last name  
- `email`: User's email address
- `tier`: User tier (basic/premium/admin)

**Special Rules**:
- Only admin creators can set `tier: "admin"`
- Setting `tier: "premium"` automatically sets `upgraded_at`
- Auth metadata is automatically synced

**Request Body**:
```json
{
  "tier": "premium",
  "first_name": "Updated Name"
}
```

**Response**:
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": 1,
    "auth_user_id": "uuid-here",
    "created_at": "2025-11-06T23:22:23.430Z",
    "first_name": "Updated Name",
    "last_name": "Doe",
    "tier": "premium",
    "email": "john@example.com",
    "upgraded_at": "2025-11-06T23:22:23.557Z"
  },
  "authenticated_user": "admin@example.com",
  "timestamp": "2025-11-06T23:22:23.557Z"
}
```

#### `DELETE /users/{id}`
**Description**: Delete or disable a user  
**Security**: Admin authentication + confirmation token required  
**Restrictions**: Cannot delete admin users

**Headers Required**:
```http
x-operation-confirm: <USER_ID>-<TIMESTAMP>
```

**Request Body**:
```json
{
  "hardDelete": true
}
```

**Soft Delete Response** (`hardDelete: false`):
```json
{
  "success": true,
  "message": "User account disabled",
  "disabled_user": {
    "id": "23",
    "email": "user@example.com"
  },
  "authenticated_user": "admin@example.com",
  "timestamp": "2025-11-06T23:22:23.000Z"
}
```

**Hard Delete Response** (`hardDelete: true`):
```json
{
  "success": true,
  "message": "User permanently deleted",
  "deleted_user": {
    "id": "23",
    "email": "user@example.com"
  },
  "authenticated_user": "admin@example.com",
  "timestamp": "2025-11-06T23:22:23.000Z"
}
```

### 📦 Bulk Operations

#### `POST /users/bulk-action`
**Description**: Perform bulk operations on multiple users  
**Security**: Admin authentication + confirmation token required

**Headers Required**:
```http
x-operation-confirm: <USER_ID>-<TIMESTAMP>
```

**Request Body**:
```json
{
  "action": "upgrade-to-premium",
  "userIds": [1, 2, 3, 4, 5]
}
```

**Supported Actions**:
- `upgrade-to-premium`: Upgrade users to premium tier
- `downgrade-to-basic`: Downgrade users to basic tier  
- `delete`: Permanently delete users (non-admins only)

**Response**:
```json
{
  "success": true,
  "message": "Bulk upgrade-to-premium completed for 5 users",
  "action": "upgrade-to-premium",
  "results": [
    {
      "id": 1,
      "tier": "premium",
      "upgraded_at": "2025-11-06T23:22:23.000Z"
    }
  ],
  "authenticated_user": "admin@example.com",
  "timestamp": "2025-11-06T23:22:23.000Z"
}
```

## Error Responses

### Authentication Errors

#### Missing Admin Secret (401)
```json
{
  "error": "Unauthorized - Admin secret required"
}
```

#### Invalid JWT Token (401)
```json
{
  "error": "Unauthorized - Invalid JWT token"
}
```

#### Unauthorized Email (403)
```json
{
  "error": "Access denied - Email not authorized"
}
```

#### Insufficient Database Privileges (403)
```json
{
  "error": "Access denied - Admin privileges required"
}
```

### Operation Errors

#### Missing Confirmation Token (400)
```json
{
  "error": "Sensitive operation requires confirmation token",
  "required_header": "x-operation-confirm",
  "token_format": "c196a3de-c012-4fe3-81c8-959f53fa0795-1699293723"
}
```

#### Cannot Delete Admin (403)
```json
{
  "error": "Cannot delete admin users"
}
```

#### Cannot Create Admin (403)
```json
{
  "error": "Cannot create admin users - insufficient privileges"
}
```

#### User Not Found (404)
```json
{
  "error": "User not found"
}
```

#### Route Not Found (404)
```json
{
  "error": "Route not found",
  "available_routes": [
    "GET /health - Health check",
    "GET /cleanup - Clean up orphaned auth users",
    "GET /users/stats - User statistics",
    "GET /users - List users with pagination",
    "POST /users - Create new user",
    "GET /users/:id - Get specific user",
    "PUT /users/:id - Update user",
    "DELETE /users/:id - Delete user",
    "POST /users/bulk-action - Bulk operations"
  ],
  "authenticated_user": "admin@example.com",
  "requested_path": "/invalid-path"
}
```

## Implementation Guide

### Environment Variables Required

```bash
# Supabase Configuration
SUPABASE_URL=http://kong:8000
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security Configuration  
ADMIN_SECRET_KEY=your-ultra-secret-admin-key
JWT_SECRET=your-jwt-secret
```

### Database Schema Requirements

The API requires a `publicv2.users` table:

```sql
CREATE TABLE publicv2.users (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  tier TEXT DEFAULT 'basic' CHECK (tier IN ('basic', 'premium', 'admin')),
  email TEXT,
  upgraded_at TIMESTAMPTZ
);

CREATE INDEX idx_users_tier ON publicv2.users(tier);
CREATE INDEX idx_users_email ON publicv2.users(email);
```

### Self-Hosted Supabase Deployment

1. **Place function file**:
   ```bash
   mkdir -p ./volumes/functions/admin-users-secure/
   # Copy index.ts to ./volumes/functions/admin-users-secure/index.ts
   ```

2. **Update Docker Compose** to include environment variables:
   ```yaml
   functions:
     environment:
       ADMIN_SECRET_KEY: ${JWT_SECRET}
   ```

3. **Restart functions container**:
   ```bash
   docker-compose restart functions
   ```

### Kong Gateway Configuration

Ensure your Kong configuration includes:

```yaml
- name: functions-v1
  url: http://functions:9000/
  routes:
    - name: functions-v1-all
      strip_path: true
      paths:
        - /functions/v1/
```

## Testing Guide

### Complete Test Script

```bash
#!/bin/bash

# Configuration
BASE_URL="https://supabase.data2int.com/functions/v1/admin-users-secure"
ADMIN_SECRET="your-admin-secret-key"
LOGIN_EMAIL="supadatain@gmail.com"
LOGIN_PASSWORD="your-password"

# Get authentication token
TOKEN=$(curl -s -X POST "https://supabase.data2int.com/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: your-anon-key" \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"password\":\"$LOGIN_PASSWORD\"}" | jq -r '.access_token')

# Test health check
echo "Testing health check..."
curl -s "$BASE_URL/health" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-admin-secret: $ADMIN_SECRET" | jq '.'

# Test user statistics
echo "Testing user statistics..."
curl -s "$BASE_URL/users/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-admin-secret: $ADMIN_SECRET" | jq '.'

# Test user listing
echo "Testing user listing..."
curl -s "$BASE_URL/users?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-admin-secret: $ADMIN_SECRET" | jq '.'
```

### Security Test Cases

1. **No Admin Secret**: Should return 401
2. **Wrong Admin Secret**: Should return 401  
3. **Invalid JWT**: Should return 401
4. **Unauthorized Email**: Should return 403
5. **Non-Admin Database Tier**: Should return 403

## Security Best Practices

### Implemented Security Measures

- **Multi-layer authentication** prevents bypass attempts
- **Email whitelisting** limits access to known administrators
- **Confirmation tokens** prevent accidental destructive operations
- **Admin protection** prevents deletion of administrator accounts
- **Audit logging** tracks all administrative actions
- **Rate limiting** (can be added) prevents abuse
- **CORS protection** controls cross-origin requests

### Operational Security

1. **Rotate admin secret keys** regularly
2. **Monitor audit logs** for suspicious activity
3. **Limit admin creator accounts** to essential personnel only
4. **Use strong passwords** for admin accounts
5. **Enable 2FA** on admin email accounts
6. **Regular security audits** of user permissions

### Network Security

- **HTTPS only** for all API communications
- **VPN access** recommended for admin operations
- **IP whitelisting** at infrastructure level
- **Network segmentation** for admin functions

## Troubleshooting

### Common Issues

#### Function Not Loading
- Check function file exists in `./volumes/functions/admin-users-secure/index.ts`
- Verify Docker container has restarted: `docker-compose restart functions`
- Check container logs: `docker logs supabase-edge-functions`

#### Authentication Failures
- Verify `ADMIN_SECRET_KEY` environment variable is set
- Check email is in `ALLOWED_ADMIN_EMAILS` array
- Ensure user has `tier = 'admin'` in database
- Confirm JWT token is valid and not expired

#### Database Connection Issues
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check `publicv2` schema exists and is accessible
- Ensure `users` table has correct structure and constraints

#### Kong Routing Problems
- Confirm Kong configuration includes functions routing
- Check Kong container is healthy: `docker logs supabase-kong`
- Verify port 9000 routing to functions container

## Changelog

### Version 1.0.0 (Current)
- ✅ Complete CRUD operations for user management
- ✅ Multi-layer security architecture
- ✅ Bulk operations support
- ✅ Orphaned auth user cleanup
- ✅ Comprehensive error handling
- ✅ Admin creation privilege controls
- ✅ Soft and hard delete options
- ✅ Authentication and authorization sync

## Support

For technical support or questions about this API:

1. **Check this documentation** for endpoint details and examples
2. **Review error responses** for specific error codes and solutions
3. **Test with the provided test scripts** to isolate issues
4. **Check Docker container logs** for runtime errors
5. **Verify environment configuration** matches requirements

---

**Document Version**: 1.0.0  
**Last Updated**: November 6, 2025  
**API Version**: Production Ready  
**Security Level**: Enterprise Grade