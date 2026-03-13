# Glamlink API Overview

This document provides a high-level overview of the Glamlink API. For full technical details, refer to the [OpenAPI Specification](./openapi-spec.yaml).

## Base URL
The API is typically hosted at `http://localhost:3000` for local development.

## Authentication
Most endpoints require a Bearer Token in the `Authorization` header.
```
Authorization: Bearer <your-token>
```

## Core Modules

### 🔐 Authentication (`/auth`)
- **Request OTP**: Initiation of the auth flow.
- **Verify OTP**: Verification of the code.
- **Firebase Login**: Integration with Firebase authentication.
- **Profile Management**: Retrieve current user data via `/auth/me`.

### 🏢 Vendors (`/vendors`)
- **Profile**: Manage vendor business details and logos.
- **Staff**: Add and manage staff members.
- **Seats**: Configure physical locations/seats for services.
- **Portfolio**: Showcase vendor work with images.
- **Onboarding**: Submit for review and check verification status.

### ✂️ Services (`/vendors/me/services`)
- **Management**: CRUD operations for service listings.
- **Images**: Upload, reorder, and delete service gallery images.
- **Archiving**: Soft-delete and restore services.

### 📅 Availability (`/vendors/me/availability`)
- **Weekly Schedule**: Set recurring business hours.
- **Overrides**: Manage specific date/time exceptions.
- **Slots**: Retrieve calculated availability slots.

### 📅 Bookings (`/bookings`, `/public/bookings`)
- **Public Flow**: Customer-facing booking creation and summaries.
- **Vendor Flow**: Manage upcoming and historical bookings.

### 🔍 Search (`/search/ai`)
- **AI-Powered Search**: Natural language search for finding services and vendors.

### ⚙️ Platform Settings (`/admin/settings`, `/public/settings`)
- **Platform Fee**: Manage and view the service platform fees.

## API Documentation
The interactive Swagger UI is available at `/api-docs` when the server is running.
