================================================================================
SAGE AI - SUPABASE EDGE FUNCTION DOCUMENTATION
================================================================================

MAIN PROJECT PATH: /root/Supabase/supabase-project
FUNCTIONS PATH: /root/Supabase/supabase-project/volumes/functions
ENV FILE PATH: /root/Supabase/supabase-project/.env
DOCKER FILE PATH: /root/Supabase/supabase-project/docker-compose.yml

--------------------------------------------------------------------------------
1. PROJECT OVERVIEW
--------------------------------------------------------------------------------
This repository contains the serverless backend logic for the S.A.G.E. AI
platform. The system is built on Supabase Edge Functions (running on Deno) and 
utilizes a unique Gateway Architecture to route requests and enforce universal 
security policies.

KEY FEATURES:
- Monolithic Gateway Pattern: A single entry point ('main') routes traffic to 
  isolated worker instances, ensuring consistent logging and security.
- Custom Schema (publicv2): All application data resides in a custom PostgreSQL 
  schema, separated from default Supabase tables.
- Dual-State Auth Sync: A robust mechanism keeps Supabase's internal 'auth.users' 
  table perfectly synchronized with the application's 'publicv2.users' profile table.
- 3-Layer Security Model: Admin endpoints are protected by JWT verification, 
  an Email Allowlist, and a Database Tier check.
- Race-Condition Safe Webhooks: The Stripe webhook implementation includes 
  logic to handle race conditions during user creation.

--------------------------------------------------------------------------------
2. TECH STACK & PREREQUISITES
--------------------------------------------------------------------------------
CORE TECHNOLOGIES:
- Runtime:         Deno (TypeScript)
- Backend:         Supabase (PostgreSQL, Auth, Edge Functions)
- Vector Database: Pinecone (Used in 'statistics' for RAG status)
- Payments:        Stripe
- Email:           Resend
- Infrastructure:  Docker & Docker Compose

PREREQUISITES:
To run or modify this stack, the following tools are required:
1. Docker & Docker Compose: For container orchestration.
2. Deno: For local development and type checking.
3. Supabase CLI: (Optional) For generating types.

ENVIRONMENT VARIABLES:
These variables must be set in your docker-compose.yml or .env file.

[ SUPABASE_URL ]
  Your project API URL (internal docker network alias or public URL).

[ SUPABASE_SERVICE_ROLE_KEY ]
  Admin key to bypass Row Level Security (RLS).

[ SUPABASE_ANON_KEY ]
  Public key for client-side context.

[ JWT_SECRET ]
  Used by the 'main' gateway to verify token signatures.

[ VERIFY_JWT ]
  Boolean string ('true'/'false'). Toggles gateway security.

[ ADMIN_EMAILS ]
  Comma-separated list of allowed admin emails (e.g., admin@sage.com,ceo@sage.com).

[ RESEND_API_KEY ]
  API Key for sending transactional emails.

[ STRIPE_SECRET_KEY ]
  Secret key for Stripe API operations.

[ STRIPE_WEBHOOK_SECRET ]
  Secret used to verify signature of incoming webhooks.

[ PINECONE_API_KEY ]
  Access key for Vector DB statistics.

--------------------------------------------------------------------------------
3. ARCHITECTURE & SECURITY
--------------------------------------------------------------------------------

A. THE GATEWAY PATTERN (main.ts)
Instead of exposing every function directly, this project uses a "Main Router."
WARNING: THIS IS A CRITICAL FUNCTION.
1. Ingest: All requests hit the 'main' function.
2. Verify: If VERIFY_JWT is true, it validates the Bearer token signature.
3. Route: It parses the URL path (e.g., /functions/v1/admin-users-secure) 
   and spins up a specific UserWorker for that function.

B. THE 3-LAYER SECURITY MODEL
All Admin functions implement the following checks before executing any logic:
Layer 1 (JWT):      Is the user logged in with a valid Supabase Token?
Layer 2 (Allowlist): Is the user's email present in the ADMIN_EMAILS env var?
Layer 3 (Database):  Does the user's row in 'publicv2.users' have tier: 'admin'?

--------------------------------------------------------------------------------
4. FUNCTION REFERENCE
--------------------------------------------------------------------------------

--- AUTH & USER FLOW ---
Custom authentication logic that bypasses standard Supabase helpers to ensure 
data consistency.

Function: custom-signup (mapped to 'create-user-v3')
Description: Atomic signup process. Creates an Auth user (no default email), 
             creates a DB profile in 'publicv2', and sends a custom verification email.
Payload:     { 
               "email": "...", 
               "password": "...", 
               "metadata": { "first_name": "...", "tier": "basic" } 
             }

Function: email-verify
Description: The target link for the signup verification email. Verifies the token.
Method:      GET
Params:      ?token=...&type=signup&user_id=...

Function: password-reset-request
Description: Initiates a password reset. Returns "success" even if email doesn't 
             exist (Security by Obscurity).
Payload:     { "email": "user@example.com" }

Function: password-reset-verify
Description: Completes the password reset and invalidates all existing sessions.
Payload:     { "token": "...", "email": "...", "newPassword": "..." }


--- ADMIN SECURE ENDPOINTS ---
These endpoints provide CMS-like capabilities for the dashboard.

Function: admin-users-secure
Description: A complete CRUD suite for user management.
Methods:
  - GET: List users (?page=1&search=...)
  - POST: Create a user manually.
  - PUT /bulk-update: Perform bulk actions (disable, delete, upgrade).
  - DELETE /:id: Hard delete a user.

Function: admin-contacts-secure
Description: Manages contact form submissions.
Methods:
  - GET: List messages (?status=New)
  - PUT /:id: Update status ({ "status": "Replied" })

Function: admin-feedback-secure
Description: Manages user feedback. Joins data with the 'users' table.
Methods:     GET, PUT

Function: stripe-analytics (formerly admin-subscriptions-secure)
Description: Aggregates data from Stripe and DB for financial overview.
Tabs:
  - overview: MRR, User Count, 12-month trend.
  - transactions: Recent payments.
  - subscriptions: Active subscriptions with product details.
  - customers: DB User list with subscription status.

Function: admin-send-email
Description: Allows admins to send raw HTML emails via Resend.
Payload:     { "to": "...", "subject": "...", "message": "..." }

Function: statistics
Description: System health check. Fetches DB stats (via RPC) and Pinecone stats.
Payload:     { "update": true } (Forces a refresh of cached stats).


--- BILLING & PUBLIC ENDPOINTS ---

Function: stripe-webhook
Description: Critical sync engine. Listens to Stripe events to update user Tiers 
             and Plans in 'publicv2.users'. Includes "Failsafe" lookup by email.

Function: create-portal-session
Description: Generates a short-lived URL for the Stripe Customer Portal.
Security:    Uses user's JWT to ensure access only to their own portal.

Function: redeem-promo
Description: Allows users to input a promo code to unlock Premium access.
Payload:     { "code": "PROMO2024" }

Function: insert-contact
Description: Public-facing endpoint for the "Contact Us" form.

Function: insert-feedback
Description: Submit bug reports. Automatically maps "Reason" to "Priority".


--- UTILITY FUNCTIONS ---

Function: text-parser
Description: Document processor. Extracts raw text from files.
Supported:   PDF, DOCX, CSV, JSON, XML, HTML, TXT, MD.
Libraries:   mammoth (DOCX), pdf-parse (PDF).
Input:       multipart/form-data with a 'file' field.

Function: validate-jwt-v2
Description: Internal middleware. Verifies JWT is valid, not expired, and 
             belongs to a user that exists in 'publicv2.users'.

--------------------------------------------------------------------------------
5. DEPLOYMENT & OPERATION GUIDE (DOCKER)
--------------------------------------------------------------------------------
This project utilizes Docker Compose for orchestration.

STARTING THE STACK:
  docker compose up -d
  (Starts all containers in detached mode)

STOPPING THE STACK:
  docker compose down
  (Stops and removes containers and networks)

RESTARTING SERVICES:
  docker compose restart
  (Useful after updating environment variables or configuration)

VIEWING LOGS:
  docker logs -f [container_name]
  
  Common containers to check:
  - Edge Functions:  docker logs -f supabase-edge-functions
  - Database:        docker logs -f supabase-db
  - Auth Service:    docker logs -f supabase-auth

REBUILDING:
  docker compose up -d --build
  (Forces a rebuild of images, useful if Dockerfiles have changed)

CHECKING STATUS:
  docker compose ps
  (Lists all running containers and their health status)

NOTE ON TYPE GENERATION:
Because this project uses a custom schema (publicv2), you must use the 
following command to update TypeScript definitions:

  supabase gen types typescript --project-id "your-id" --schema publicv2 > types/supabase.ts

================================================================================
END OF DOCUMENTATION
================================================================================