Supabase Edge Functions Documentation

This document provides a comprehensive overview of the entire serverless architecture used by the project. The functions are written in Deno/TypeScript and deployed to a self-hosted Supabase Edge runtime, running behind a custom Router that enforces universal security policies.

1. Architecture & Security Overview

Naming Convention

Functions are primarily categorized by their purpose:

    System/Gateway: main, validate-jwt-v2.

    User-Facing (Authenticated): Billing, profile updates.

    Admin-Facing (Secured): CRUD operations, analytics, bulk updates.

Global Security Policy (Admin Functions)

All Admin-facing functions implement a minimum of a 3-Layer Security Check relying on the Service Role Key for elevated permissions:

    Layer 1 (JWT Verification): Ensures the request contains a valid Supabase JWT.

    Layer 2 (Email Whitelist): Checks if the authenticated user's email is listed in the ADMIN_EMAILS environment variable.

    Layer 3 (DB Tier Check): Queries the publicv2.users table to verify the user's tier is set to 'admin'.

Infrastructure Gateway

The entire suite relies on the main function, which acts as the Edge Function Router. It handles the initial request and conditionally performs a global JWT validation before dispatching the request 
to the correct worker service (e.g., stripe-analytics, admin-users-secure).

2. Authentication and Security Matrix:

===========================================================================================================================================================================================================
SUPABASE EDGE FUNCTIONS CATALOG
===========================================================================================================================================================================================================
This catalog summarizes the functionality, access, and security model for all
Edge Functions in the project.

| FUNCTION NAME           | ROLE/CATEGORY         | METHODS  | SECURITY TYPE     | KEY FEATURES
|-------------------------|-----------------------|----------|-------------------|-------------------------------------------------------------------------------------------------------------------------
| main                    | Router Gateway        | ANY      | Custom JWT        | Routes requests to dynamic workers. DO NOT DELETE.
| validate-jwt-v2         | Internal Security     | POST     | Service Role Key  | Verifies forwarded JWT, checks expiration and DB profile existence.
|-------------------------|-----------------------|----------|-------------------|-------------------------------------------------------------------------------------------------------------------------
| USER FACING (AUTH & BILLING)
|-------------------------|-----------------------|----------|-------------------|-------------------------------------------------------------------------------------------------------------------------
| custom-signup           | Auth Flow             | POST     | Service Role Key  | Creates user/profile atomically, sends custom Resend verification email (includes rollback logic).
| email-verify            | Auth Flow             | GET      | Service Role Key  | Confirms email via custom token and redirects to app.
| password-reset-request  | Auth Flow             | POST     | Service Role Key  | Sends custom password reset link via Resend. Hides user existence for security.
| password-reset-verify   | Auth Flow             | POST     | Service Role Key  | Verifies token, updates password, and invalidates all sessions.
| create-portal-session   | Billing Access        | POST     | JWT (Anon Key)    | Generates a temporary, secure Stripe Billing Portal URL.
| redeem-promo            | Billing Logic         | POST     | JWT (Anon Key)    | Assumed: Validates promo code and updates user's tier/benefits.
|-------------------------|-----------------------|----------|-------------------|-------------------------------------------------------------------------------------------------------------------------
| SYSTEM INTEGRATION
|-------------------------|-----------------------|----------|-------------------|-------------------------------------------------------------------------------------------------------------------------
| stripe-webhook          | Critical Sync         | POST     | Stripe Signature  | Syncs user tier/status/customer ID based on Stripe events (checkout, subscription lifecycle). Includes Failsafe Logic.
| text-parser             | Data Ingestion        | POST     | JWT (Anon Key)    | Extracts raw text content from multiple formats (PDF, DOCX, CSV, JSON) using NPM dependencies.
| insert-contact          | Public Form           | POST     | Service Role Key  | Inserts public contact form submissions into the DB with rigorous input validation.
|-------------------------|-----------------------|----------|-------------------|-------------------------------------------------------------------------------------------------------------------------
| ADMIN FACING (CRUD & ANALYTICS)
|-------------------------|-----------------------|----------|-------------------|-------------------------------------------------------------------------------------------------------------------------
| stripe-analytics        | Reporting             | GET      | Admin (3-Layer)   | Aggregates 12 months of Stripe invoice data for MRR/trend analysis. Multi-tab data viewer.
| statistics              | Health Check          | POST     | Admin (3-Layer)   | Aggregates status from Postgres/Pinecone. Optionally triggers DB stats update.
| admin-users-secure      | User Management       | CRUD     | Admin (3-Layer)   | Full user CRUD, statistics, and bulk operations. Protects Admin accounts.
| admin-contacts-secure   | Contacts              | GET, PUT | Admin (3-Layer)   | Lists/searches contact forms; updates status.
| admin-feedback-secure   | Feedback              | GET, PUT | Admin (3-Layer)   | Lists/searches feedback; updates status/priority. Joins with user profile data.
| admin-send-email        | Messaging             | POST     | Admin (3-Layer)   | Securely sends admin reply emails via Resend.
===========================================================================================================================================================================================================