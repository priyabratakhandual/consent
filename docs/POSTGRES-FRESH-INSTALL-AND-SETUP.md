# PostgreSQL: Uninstall, fresh install, and app setup

Use this on **Ubuntu/Debian** (e.g. Linux). Adjust for your OS if different.

---

## Part 1: Uninstall old PostgreSQL

Run these in order.

### 1.1 Stop PostgreSQL

```bash
sudo systemctl stop postgresql
# Or if using older service name:
sudo service postgresql stop
```

### 1.2 Remove PostgreSQL packages

```bash
sudo apt-get purge postgresql* -y
sudo apt-get remove postgresql* -y
sudo apt-get autoremove -y
```

### 1.3 (Optional) Remove data and config

Only do this if you want to wipe all existing databases and start completely fresh.

```bash
# Remove data directory (all databases will be lost)
sudo rm -rf /var/lib/postgresql

# Remove config
sudo rm -rf /etc/postgresql
```

### 1.4 Clean up

```bash
sudo apt-get autoclean
```

---

## Part 2: Fresh install PostgreSQL

### 2.1 Update and install

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
```

### 2.2 Start and enable

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.3 Check it’s running

```bash
sudo systemctl status postgresql
```

You should see `active (running)`.

---

## Part 3: Create user and databases for the app

We’ll create:

- A dedicated OS user (optional; you can use `postgres` instead).
- A **PostgreSQL role** (login user) for the app: `consent_app` with password `consent_app_password` (change in production).
- Databases: **consent_master**, **tenant_default**.

### 3.1 Switch to postgres system user and open psql

```bash
sudo -u postgres psql
```

You should see a prompt like `postgres=#`.

### 3.2 Create the app user and set password

Run these **one by one** in the `psql` prompt (change the password for production):

```sql
-- Create role that can log in
CREATE ROLE consent_app WITH LOGIN PASSWORD 'consent123';

-- Allow creating databases (needed so the app can create tenant DBs)
ALTER ROLE consent_app CREATEDB;

-- Optional: make it a superuser only if you need it to create DBs and manage extensions
-- ALTER ROLE consent_app SUPERUSER;
```

### 3.3 Create the databases and grant access

```sql
-- Master DB (auth + tenants)
CREATE DATABASE consent_master OWNER consent_app;

-- Default tenant DB (for running tenant migrations; optional but recommended)
CREATE DATABASE tenant_default OWNER consent_app;

-- Grant all on schema public (PostgreSQL 15+)
\c consent_master
GRANT ALL ON SCHEMA public TO consent_app;
GRANT ALL PRIVILEGES ON DATABASE consent_master TO consent_app;

\c tenant_default
GRANT ALL ON SCHEMA public TO consent_app;
GRANT ALL PRIVILEGES ON DATABASE tenant_default TO consent_app;
```

### 3.4 Allow local password auth (if needed)

If you get “password authentication failed” when the app connects, enable `md5` or `scram-sha-256` for local connections:

```bash
# Exit psql first: \q
# Find your version: ls /etc/postgresql/  (e.g. 14, 15, 16)
sudo nano /etc/postgresql/14/postgresql.conf
```

Find and set (or add):

```
listen_addresses = 'localhost'
```

Then:

```bash
sudo nano /etc/postgresql/14/pg_hba.conf
```

Find the line for IPv4 local connections and use `md5` or `scram-sha-256`:

```
# TYPE  DATABASE        USER            ADDRESS         METHOD
host    all             all             127.0.0.1/32    scram-sha-256
```

(Version might be 15 or 16; check with `ls /etc/postgresql/`.)

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### 3.5 Exit psql

```sql
\q
```

---

## Part 4: Update your .env

In your backend `.env`, use the new user and password (no special characters, so no encoding needed):

```env
MASTER_DATABASE_URL="postgresql://consent_app:consent_app_password@localhost:5432/consent_master"
TENANT_DATABASE_URL="postgresql://consent_app:consent_app_password@localhost:5432/tenant_default"
```

If PostgreSQL version is 15+ and you use a different port, adjust the port in the URL. Default is `5432`.

---

## Part 5: Verify from the app user

```bash
psql -U consent_app -h localhost -d consent_master -c "\conninfo"
```

You should see connection info. If it asks for a password, use `consent_app_password`.

---

## Quick copy-paste (all SQL in one block)

After `sudo -u postgres psql`:

```sql
-- User
CREATE ROLE consent_app WITH LOGIN PASSWORD 'consent_app_password';
ALTER ROLE consent_app CREATEDB;

-- Databases
CREATE DATABASE consent_master OWNER consent_app;
CREATE DATABASE tenant_default OWNER consent_app;

-- Grants (PostgreSQL 15+)
\c consent_master
GRANT ALL ON SCHEMA public TO consent_app;
GRANT ALL PRIVILEGES ON DATABASE consent_master TO consent_app;

\c tenant_default
GRANT ALL ON SCHEMA public TO consent_app;
GRANT ALL PRIVILEGES ON DATABASE tenant_default TO consent_app;

\q
```

Then set in `.env`:

```env
MASTER_DATABASE_URL="postgresql://consent_app:consent_app_password@localhost:5432/consent_master"
TENANT_DATABASE_URL="postgresql://consent_app:consent_app_password@localhost:5432/tenant_default"
```

Run migrations:

```bash
npm run prisma:migrate:master
npm run prisma:migrate:tenant
```
