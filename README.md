================================================================================
S.A.G.E. AI - SELF-HOSTED SUPABASE INFRASTRUCTURE
================================================================================

ACTUAL PROJECT PATH: /root/Supabase/supabase-project
ORCHESTRATION:       Docker Compose (V2)
DATA PERSISTENCE:    ./volumes (Local Directory Mapped)
CONFIG FILES:        docker-compose.yml, .env

--------------------------------------------------------------------------------
1.  PROJECT OVERVIEW
--------------------------------------------------------------------------------

This directory constitutes the root infrastructure for the S.A.G.E. AI backend.
It hosts the entire Supabase stack (Postgres, GoTrue/Auth, Realtime, Storage,
and Edge Runtime) using Docker Compose.

Unlike the cloud version, this self-hosted setup manages its own persistence
(in the 'volumes' directory) and configuration secrets. It serves as the
foundational layer upon which the 'analysis-libraries' (Python) and 'functions'
(Deno) rely.

KEY COMPONENTS:
  - Database Engine:   PostgreSQL 15+ (via supabase/postgres image).
  - Auth Service:      GoTrue (Handles JWT issuance and verification).
  - API Gateway:       Kong (Routes traffic between Auth, Rest, and Realtime).
  - Edge Runtime:      Self-hosted Deno runtime for your TypeScript functions.
  - Backups:           Contains manual SQL dumps and snapshot strategies.

--------------------------------------------------------------------------------
2.  TECH STACK & PREREQUISITES
--------------------------------------------------------------------------------

CORE TECHNOLOGIES:
  - Containerization:  Docker Engine
  - Orchestration:     Docker Compose V2 (plugin)
  - Database:          PostgreSQL
  - Storage:           Local filesystem (mapped to ./volumes) or S3 (via config)
  - Secrets Mgmt:      Environment variables (.env) and local text files.

PREREQUISITES:
To operate this stack, the host machine (CT100) requires:
1.  Docker Engine: Installed and running.
2.  Docker Compose V2: The command `docker compose` should work.
3.  System Resources: Minimum 4GB RAM recommended for full stack stability.

FILE MANIFEST (ROOT):
  - docker-compose.yml:       Main orchestration file.
  - docker-compose.s3.yml:    Alternate config for S3-backed storage.
  - volumes/:                 CRITICAL. Contains live DB data. DO NOT DELETE.
  - dev/:                     Development configurations/scripts.
  - tests/:                   Infrastructure integrity tests.
  - *.sql:                    Database snapshots (e.g., data4in_export.sql).
  - *.txt:                    Backup keys (stripe_keys.txt, resend_api_key.txt).

--------------------------------------------------------------------------------
3.  ARCHITECTURE & SECURITY
--------------------------------------------------------------------------------

A. DATA PERSISTENCE STRATEGY
   The 'volumes' directory is mapped directly into the Docker containers.
   - ./volumes/db:    PostgreSQL data files.
   - ./volumes/storage: Object storage files (images/docs).

   WARNING: Deleting the './volumes' folder will result in TOTAL DATA LOSS unless
   a SQL backup is available.

B. SECURITY & SECRETS
   This directory contains sensitive text files (stripe_keys.txt, etc.).
   - Access Control: Ensure this directory is read/write restricted (chmod 600).
   - Git Policy:     Never commit .txt key files or .env files to version control.
   - Backup Policy:  The '(Backup).env.backup.txt' serves as a recovery point
                     for environment configurations.

C. NETWORKING
   The `docker-compose.yml` defines an internal network (`default`) where:
   - The API Gateway is exposed on port 8000 (Kong).
   - The Database is exposed on port 5432 (Postgres).
   - The Studio Dashboard is exposed on port 3000.

--------------------------------------------------------------------------------
4.  FILE & BACKUP REFERENCE
--------------------------------------------------------------------------------

--- CONFIGURATION FILES ---

File: docker-compose.yml
Description: The primary definition file for the Supabase stack. Defines services:
             studio, kong, auth, rest, realtime, storage, imgproxy, meta, db.

File: docker-compose.s3.yml
Description: An override file likely used to configure Supabase Storage to use
             an S3 bucket (AWS/Wasabi) instead of the local filesystem.

File: (DO NOT DELETE)docker-compose.yml.backup
Description: A hard failsafe copy of the working orchestration config.


--- DATABASE BACKUPS (.sql) ---

File: data4in_export.sql
Description: A full data export (schema + data) of the 'data4in' or related dataset.
Usage:       cat data4in_export.sql | docker exec -i supabase-db psql -U postgres

File: current_empty_db_backup.sql
Description: A "Skeleton" backup containing only the Schema (tables/functions)
             without user data. Useful for resetting environments.

File: data2in_backup_20250727_0153.sql
Description: Timestamped snapshot.
Status:      Likely the most recent reliable restore point.


--- SECRET KEYS (.txt) ---

File: stripe_keys.txt
Description: Contains Stripe Secret/Publishable keys and Webhook secrets.
Action:      Ensure these match the values loaded into the docker container ENV.

File: resend_api_key.txt / full_access_resend_api_key.txt
Description: API keys for the Resend email service used by Auth/Edge Functions.

File: (Backup).env.backup.txt
Description: Text copy of the .env file. Contains JWT Secrets, DB Passwords,
             and API Keys.

--------------------------------------------------------------------------------
5.  DEPLOYMENT & OPERATION GUIDE (DOCKER)
--------------------------------------------------------------------------------

IMPORTANT: Use 'docker compose' (space), not 'docker-compose' (hyphen).

STARTING THE STACK:
  docker compose up -d
  (Starts all containers in detached mode)

STOPPING THE STACK:
  docker compose down
  (Stops containers and removes networks. Volumes persist.)

CHECKING HEALTH:
  docker compose ps
  (Ensure 'supabase-db' and 'supabase-auth' are 'Up' or 'healthy')

VIEWING LOGS:
  docker compose logs -f
  (Streams logs from all services)

  docker logs -f [container_name] (Find in docker-compose.yml)

RESTORING A BACKUP:
  cat data4in_export.sql | docker exec -i supabase-db psql -U postgres

RESETTING TO FRESH STATE:
  1. docker compose down
  2. sudo rm -rf volumes/db/* (WARNING: DESTRUCTIVE)
  3. docker compose up -d

--------------------------------------------------------------------------------
6.  ACCESS CREDENTIALS & SECURITY
--------------------------------------------------------------------------------

WARNING: These credentials control root access. Do not share this file publicly.

A. DEFAULT CREDENTIALS
   These values are defined in the `.env` file. If they differ, check .env directly.

   1. POSTGRES DATABASE (Superuser)
      - Username: postgres
      - Password: Interceptor-Pearl-CR505hgkmgj
      - Port:     5432
      - Connection String: postgresql://postgres:Interceptor-Pearl-CR505hgkmgj@localhost:5432/postgres

   2. SUPABASE STUDIO (Dashboard)
      - URL:      http://localhost:3000
      - Username: admin@sageaios.com
      - Password: gurajji1@

   3. SERVICE_ROLE KEY (Admin API Access)
      - Location: .env file (SEARCH FOR: SERVICE_ROLE_KEY)
      - Usage:    Used by backend scripts (Python/Node) to bypass Row Level Security.

B. HOW TO CHANGE PASSWORDS
   Changing credentials requires updating the environment configuration and 
   restarting the containers.

   Step 1: Open the environment file.
           nano .env

   Step 2: Locate and edit the relevant variable.
           POSTGRES_PASSWORD=new_secure_password
           DASHBOARD_USERNAME=new_admin
           DASHBOARD_PASSWORD=new_password

   Step 3: Apply changes.
           docker compose down
           docker compose up -d

   Note: Changing the POSTGRES_PASSWORD may require updating the connection 
   strings in your Python backend (analysis-libraries) as well.

--------------------------------------------------------------------------------
7.  OPERATIONAL WORKFLOWS
--------------------------------------------------------------------------------

A. EXAMPLE: ADDING DATABASE FIELDS
   You can add fields via the Studio UI (http://localhost:3000 or https://supabase.sageaios.com).

   Method 1: SQL Command (Preferred for consistency)
   Run the following command to add a 'phone_number' field to the 'users' table:
   
   docker exec -it supabase-db psql -U postgres -c "ALTER TABLE public.users ADD COLUMN phone_number text;"

   Method 2: Studio UI
   1. Go to http://localhost:3000 or https://supabase.sageaios.com -> Table Editor.
   2. Select the table (e.g., 'users').
   3. Click "Insert Column" (Plus icon).
   4. Name: phone_number | Type: text | Default Value: NULL.
   5. Click Save.

B. EXAMPLE: CREATING A NEW PROMO CODE (NOT IN USE)
   Use this workflow to add a new code to the `publicv2.promo_codes` table.

   Method 1: Using SQL (SQL Editor or Terminal)
   This is the fastest method to ensure all fields are correct.

   INSERT INTO publicv2.promo_codes 
     (code, description, max_uses, times_used, is_active, type, duration_days) 
   VALUES 
     ('SAGE2025', 'Early bird discount', 50, 0, true, 'premium_unlock', 30);

   Method 2: Using Supabase Studio (Visual Table Editor) (NOT IN USE)
   1. Open Supabase Studio: http://localhost:3000
   2. Click the "Table Editor" icon (Grid).
   3. In the sidebar, select the schema: `publicv2`.
   4. Click on the table: `promo_codes`.
   5. Click "Insert Row" (Green button or 'Insert').
   6. Fill in the form:
      - code:          "SAGE2025"
      - description:   "Promo description"
      - max_uses:      50
      - times_used:    0
      - is_active:     TRUE
      - type:          "premium_unlock"
      - duration_days: 30
   7. Click "Save".

C. TROUBLESHOOTING THE DATABASE
   
   Issue 1: Database is "Locked" or refusing connections.
   - Action: Check if the container is restarting loop.
     docker logs supabase-db --tail 50
   - Fix: If logs show "lock file exists", restart the container forceably:
     docker restart supabase-db

   Issue 2: "Disk is full" errors.
   - Action: Prune unused Docker data (Use caution).
     docker system prune -a
   - Action: Check volume size.
     du -sh ./volumes/db

   Issue 3: Slow Queries / Performance.
   - Action: Run the active queries inspector via Docker CLI:
     docker exec -it supabase-db psql -U postgres -c "SELECT pid, age(clock_timestamp(), query_start), usename, query FROM pg_stat_activity WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%' ORDER BY query_start desc;"

================================================================================
END OF DOCUMENTATION
================================================================================