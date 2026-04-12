# GitHub Release Notification API

An API that allows users to subscribe to email notifications about new releases of GitHub repositories.

## Architecture

Single-service monolith built with **Node.js** and **Fastify**, running three responsibilities in one process:

- **API** -- Fastify HTTP handlers for the subscription lifecycle
- **Scanner** -- background job (via `toad-scheduler`) that periodically polls GitHub for new releases across all confirmed subscriptions
- **Notifier** -- sends emails via Nodemailer/SMTP when the scanner detects a release newer than `last_seen_tag`

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Fastify |
| Language | TypeScript (ES modules) |
| Database | PostgreSQL 18 via Prisma ORM |
| Cache | Redis via @fastify/redis |
| Email | Nodemailer (SMTP) |
| Scheduling | @fastify/schedule + toad-scheduler |
| Validation | Zod schemas |
| Testing | node:test |

## API Endpoints

Base path: `/api`

| Method | Path | Description | Status Codes |
|--------|------|-------------|-------------|
| POST | `/api/subscribe` | Subscribe an email to a repo's release notifications | 200, 400, 404, 409 |
| GET | `/api/confirm/{token}` | Confirm subscription via emailed token | 200, 400, 404 |
| GET | `/api/unsubscribe/{token}` | Unsubscribe via emailed token | 200, 400, 404 |
| GET | `/api/subscriptions?email={email}` | List active subscriptions for an email | 200, 400 |
> NOTE:
> `POST /api/subscribe` may return status codes not listed in the swagger spec:
> - **503 Service Unavailable** — returned when the GitHub API responds with 429 (rate limit exceeded). The spec does not define this case, but silently swallowing a rate limit would be misleading; a 503 signals to the client that the service is temporarily unavailable and the request can be retried later.
> - **502 Bad Gateway** — returned on any other unexpected GitHub API error (5xx, network failure, etc.). Again unspecified, but accurately reflects that the failure is upstream, not in the client's request.

### Subscribe Flow

1. User sends `POST /api/subscribe` with `{ email, repo }` (repo format: `owner/repo`)
2. Service validates repo format (400 if invalid) and verifies repo exists via GitHub API (404 if not found)
3. If already subscribed, returns 409
4. Creates unconfirmed subscription and sends confirmation email with a unique token
5. User clicks confirmation link (`GET /api/confirm/{token}`) to activate the subscription

### Release Scanning

- Runs on a configurable interval (default: 10 minutes)
- Queries all confirmed subscriptions, grouped by distinct repo
- Fetches latest release from GitHub API for each repo
- Compares `tag_name` against stored `last_seen_tag`
- Sends email notification only if a newer release is detected
- Skips releases published before the subscription was created (backfill protection)
- Aborts the scan cycle if GitHub returns 429 (rate limit)

### Environment Variables

All variables with descriptions are listed in [`.env.example`](.env.example). Copy it to get started:

```bash
cp .env.example .env
```

## Running with Docker

```bash
# Build and start all services (Postgres, Redis, App)
docker compose up --build

# SMTP and GitHub token can be provided via a root .env file
```

The app runs database migrations automatically on startup.

## Testing

```bash
# Run all tests (unit + integration)
npm test

# Unit tests only
cd server/ && npm run test:unit

# Integration tests only (requires Postgres and Redis running)
cd server/ npm run test:integration
```

### Test Coverage

**Unit tests** (4 suites):
- `github.service.test.ts` -- GitHub API calls, rate limit handling, error mapping
- `subscription.service.test.ts` -- subscribe, confirm, unsubscribe, list logic
- `scanner.service.test.ts` -- scan cycle, tag comparison, backfill protection, rate limit abort
- `githubCache.test.ts` -- Redis cache hit/miss, TTL, fallback on Redis failure

**Integration tests** (5 suites):
- `subscribe.test.ts` -- POST /api/subscribe
- `confirm.test.ts` -- GET /api/confirm/{token}
- `unsubscribe.test.ts` -- GET /api/unsubscribe/{token}
- `subscriptions.test.ts` -- GET /api/subscriptions
- `redis-cache.test.ts` -- Redis caching integration

## CI/CD

GitHub Actions workflow (`.github/workflows/lint-test.yml`) runs on every push:
1. **Lint** -- ESLint
2. **Test** -- unit and integration tests against Postgres and Redis service containers

## Requirements Checklist

### Core Requirements

- [x] API matches swagger.yaml contract
- [x] Single-service monolith (API + Scanner + Notifier in one process)
- [x] Data stored in PostgreSQL with Prisma ORM
- [x] Database migrations run on service startup (`prisma migrate deploy`)
- [x] Dockerfile and docker-compose.yml for running the entire system
- [x] Scanner periodically checks for new releases and sends email notifications
- [x] Stores `last_seen_tag` per subscription, only notifies on new releases
- [x] Validates repository existence via GitHub API (404 if not found, 400 if invalid format)
- [x] Handles GitHub API 429 rate limit (returns 503 to client, aborts scan cycle)
- [x] Uses Fastify (allowed thin framework)
- [x] Unit tests for business logic
- [x] Integration tests

### Extras

- [x] Deploy to hosting (Heroku) + HTML page for subscribing to releases
- [ ] gRPC interface
- [x] Redis caching of GitHub API responses with TTL 10 minutes
- [ ] API key authentication
- [ ] Prometheus metrics (`/metrics` endpoint)
- [x] GitHub Actions CI pipeline (linter + tests on every push)

## Project Structure

```
.
├── client/                    # Static HTML frontend
│   └── index.html
├── server/
│   ├── src/
│   │   ├── server.ts          # Entry point
│   │   ├── app.ts             # Fastify app builder
│   │   ├── config/            # Env schema
│   │   ├── plugins/           # Fastify plugins (prisma, redis, mail, scanner)
│   │   ├── routes/            # Route definitions
│   │   ├── controllers/       # Request handlers
│   │   ├── services/          # Business logic (github, scanner, mail, cache)
│   │   ├── commons/           # Shared interfaces and schemas
│   │   └── utils/             # Validation helpers
│   ├── tests/
│   │   ├── unit/              # Unit tests
│   │   └── integration/       # Integration tests
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Migration files
│   └── package.json
├── Dockerfile                 # Multi-stage build
├── docker-compose.yml         # Full system (app + Postgres + Redis)
├── docker-entrypoint.sh       # Runs migrations then starts server
├── swagger.yaml               # API contract
└── .github/workflows/         # CI pipeline
```

## Live Demo

The application is deployed on Heroku:
**https://github-release-notification-183ce9fce8ee.herokuapp.com/**

## License

MIT
