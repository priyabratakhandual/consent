# Consent Management – Backend API

Node.js (Express) API with logging, security, and auth.

## Features

- **Logging**: Winston with request logging, levels, and optional file transport in production
- **Security**: Helmet, CORS, rate limiting, request sanitization (NoSQL injection prevention)
- **Auth**: JWT access + refresh tokens, bcrypt password hashing, register / login / refresh / me
- **Error handling**: Central error middleware, `ApiError` class, async handler wrapper
- **Exception handling**: Global `uncaughtException` and `unhandledRejection` handlers, graceful shutdown

## Folder structure

```
src/
├── config/          # Environment and app config
├── controllers/     # Route handlers
├── middleware/      # Auth, validation, security, error handler, request logger
├── routes/          # Route definitions (auth, health, etc.)
├── services/        # Business logic (auth service)
├── utils/           # Logger, ApiError, asyncHandler
├── app.js           # Express app setup
└── server.js        # Server start, exception handlers, graceful shutdown
```

## Setup

```bash
cd consent-management-backend
cp .env.example .env
# Edit .env and set JWT_SECRET, JWT_REFRESH_SECRET (and optionally PORT, CORS_ORIGIN)
npm install
```

## Run

```bash
# Development (with file watch)
npm run dev

# Production
npm start
```

## API

- `GET /api/health` – Health check
- `POST /api/auth/register` – Register (body: `email`, `password`, optional `name`)
- `POST /api/auth/login` – Login (body: `email`, `password`) → returns `accessToken`, `refreshToken`
- `POST /api/auth/refresh` – Refresh access token (body: `refreshToken` or header `x-refresh-token`)
- `GET /api/auth/me` – Current user (header: `Authorization: Bearer <accessToken>`)

## Environment variables

See `.env.example`. Required for production: `JWT_SECRET`, `JWT_REFRESH_SECRET`. Optional: `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `RATE_LIMIT_*`, `BCRYPT_ROUNDS`, etc.

## Replacing in-memory users

The auth service currently uses an in-memory `Map` for users. To persist data, replace the store in `src/services/auth.service.js` with your database (e.g. MongoDB, PostgreSQL).
