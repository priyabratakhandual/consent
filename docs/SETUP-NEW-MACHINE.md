# Full setup: Consent Management app on a new machine

Step-by-step process including prerequisites, database, migrations, and running the server. Use these steps on a fresh machine or new clone.

---

## Prerequisites

Install these before starting:

| Requirement | Version | How to check |
|-------------|---------|----------------|
| **Node.js** | 18 or higher | `node -v` |
| **npm** | Comes with Node | `npm -v` |
| **PostgreSQL** | 14+ (or 12+) | `psql --version` |
| **Git** | Any recent | `git --version` |

### Install Node.js (if needed)

- **Linux (Ubuntu/Debian):** `sudo apt update && sudo apt install nodejs npm` or use [nvm](https://github.com/nvm-sh/nvm): `nvm install 18 && nvm use 18`
- **macOS:** `brew install node` or nvm
- **Windows:** Download from [nodejs.org](https://nodejs.org/) (LTS)

### Install PostgreSQL (if needed)

- **Linux (Ubuntu/Debian):** `sudo apt update && sudo apt install postgresql postgresql-client`
- **macOS:** `brew install postgresql@14` (or latest)
- **Windows:** Download from [postgresql.org](https://www.postgresql.org/download/windows/)

Start PostgreSQL (examples):

- Linux: `sudo systemctl start postgresql` or `sudo service postgresql start`
- macOS: `brew services start postgresql@14`

---

## Part 1: Backend (consent-management-backend)

### Step 1: Get the code

```bash
# If cloning from Git (replace URL with your repo)
git clone <your-repo-url>
cd consent-management-backend

# Or if you already have the folder
cd consent-management-backend
```

### Step 2: Create the master database in PostgreSQL

You need one database for the **master** (auth + tenants). Create it once.

```bash
# Connect as postgres user (Linux/macOS often use peer auth)
sudo -u postgres psql

# Or if you use password auth (replace with your user):
# psql -U postgres -h localhost
```

In the `psql` prompt:

```sql
CREATE DATABASE consent_master;
\q
```

Optional: create a dedicated user and grant access:

```sql
CREATE USER consent_user WITH PASSWORD 'Glob#213';
GRANT ALL PRIVILEGES ON DATABASE consent_master TO consent_user;
\q
```

### Step 3: Create a database for tenant migrations (optional but recommended)

Tenant migrations need to run against *some* existing database to record migration history. Create one (e.g. for local dev):

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE tenant_default;
\q
```

### Step 4: Environment variables

```bash
# From backend root
cp .env.example .env

# Edit .env with your values (use your editor)
nano .env
# or
code .env
```

Set at least these (replace with your PostgreSQL user, password, host, port):

```env
NODE_ENV=development
PORT=3000

# Use the DB you created in Step 2. Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
MASTER_DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/consent_master"
TENANT_DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/tenant_default"

# Use strong random strings in production
JWT_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Frontend URL when running locally (for CORS)
CORS_ORIGIN=http://localhost:5173
CORS_CREDENTIALS=true
```

Save and exit.

### Step 5: Install dependencies

```bash
cd consent-management-backend
npm install
```

This also runs `postinstall`, which runs `prisma:generate` (generates Prisma clients for master and tenant).

### Step 6: Run migrations – master database

Creates tables in the **master** DB: `users`, `tenants`, `user_tenants`.

```bash
npm run prisma:migrate:master
```

When prompted for a migration name, you can use: `init` (or leave default).

Confirm: tables exist in `consent_master`:

```bash
# Optional: connect and list tables
psql -U postgres -d consent_master -c "\dt"
```

You should see: `users`, `tenants`, `user_tenants`, `_prisma_migrations`.

### Step 7: Run migrations – tenant schema (for migration history)

Creates the tenant schema and migration history in the DB pointed to by `TENANT_DATABASE_URL` (e.g. `tenant_default`). New tenant DBs will get the same schema when you create a tenant via API.

```bash
npm run prisma:migrate:tenant
```

When prompted for a migration name, use: `init` (or leave default).

### Step 8: Start the backend server

**Development (with file watch):**

```bash
npm run dev
```

**Production:**

```bash
npm start
```

You should see something like:

```
Server listening on port 3000
```

Backend base URL: **http://localhost:3000**

### Step 9: Verify the backend

In another terminal (or browser):

```bash
# Health check
curl http://localhost:3000/api/health

# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123","name":"Admin"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

If these return JSON (and login returns `accessToken`), the backend is set up correctly.

---

## Part 2: Frontend (consent-management-frontend) – optional

If you have the frontend repo and want to run it on the same machine:

### Step 1: Go to frontend folder

```bash
cd path/to/consent-management-frontend
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Environment (if the app uses an API URL)

If the frontend expects a backend URL (e.g. in `.env` or `.env.local`):

```bash
# Create if needed (check repo for .env.example)
echo "VITE_API_URL=http://localhost:3000" > .env.local
```

### Step 4: Run the frontend

```bash
npm run dev
```

Usually Vite runs at **http://localhost:5173**. Open that in the browser. Ensure backend is running at the URL you configured (e.g. `http://localhost:3000`) so API calls work.

---

## Quick reference – backend only

| Step | Command |
|------|---------|
| 1. Create master DB | `sudo -u postgres psql` → `CREATE DATABASE consent_master;` |
| 2. Create tenant_default DB | In psql: `CREATE DATABASE tenant_default;` |
| 3. Copy env | `cp .env.example .env` then edit `.env` |
| 4. Install | `npm install` |
| 5. Migrate master | `npm run prisma:migrate:master` |
| 6. Migrate tenant | `npm run prisma:migrate:tenant` |
| 7. Run server | `npm run dev` or `npm start` |
| 8. Check | `curl http://localhost:3000/api/health` |

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| `MASTER_DATABASE_URL not configured` | Ensure `.env` exists and `MASTER_DATABASE_URL` is set; run the app from the backend root. |
| **`invalid port number in database URL`** | Your **password** likely contains special characters (`:`, `@`, `#`, `/`, `%`). URL-encode them in the connection string (e.g. `:` → `%3A`, `@` → `%40`, `#` → `%23`) or use a password without special characters for local dev. |
| `connect ECONNREFUSED` (DB) | PostgreSQL is not running or host/port/user/password in URL are wrong. Check with `psql -U postgres -h localhost -d consent_master`. |
| `Prisma migrate` fails | Ensure the database exists and the user in the URL has permission to create tables. |
| Port 3000 in use | Change `PORT` in `.env` (e.g. `3001`) and use that in curl/frontend. |
| CORS errors from frontend | Set `CORS_ORIGIN` in backend `.env` to the frontend origin (e.g. `http://localhost:5173`). |

---

## Summary

1. Install **Node.js 18+** and **PostgreSQL**.
2. Create databases: **consent_master** and (optionally) **tenant_default**.
3. **Backend:** copy `.env.example` → `.env`, set DB URLs and JWT secrets.
4. **Backend:** `npm install` → `npm run prisma:migrate:master` → `npm run prisma:migrate:tenant` → `npm run dev`.
5. **Frontend (optional):** `npm install` → `npm run dev`.
6. Use **http://localhost:3000** for API and **http://localhost:5173** for frontend (if running).
