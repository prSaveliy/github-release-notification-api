# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands are run from the repo root via npm workspaces, or directly inside `server/`.

```bash
npm run dev         # start server with nodemon (hot reload via tsx)
npm run build       # compile TypeScript to dist/
npm run lint        # eslint
npm run lint:fix    # eslint --fix
npm run format      # prettier --write
npm run format:check
npm run test        # (test runner TBD)
```

`server/` uses `node --env-file=.env` for environment variables — create a `server/.env` for local dev.

### Database

```bash
# Start Postgres locally (from server/postgres/)
docker-compose up -d

# Run migrations
npx prisma migrate dev

# Regenerate Prisma client after schema changes
npx prisma generate
```

Prisma client is generated to `server/generated/prisma/` (gitignored). Config is in `server/prisma.config.ts`, schema in `server/prisma/schema.prisma`.

`server/postgres/.env` holds Docker Compose vars (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).
`server/.env` holds the app's `DATABASE_URL=postgresql://user:pass@localhost:5432/dbname?schema=public`.

## Architecture

Single-service monolith with three responsibilities running in the same process:

- **API** — Fastify HTTP handlers for the subscription lifecycle
- **Scanner** — background job that periodically polls GitHub API for new releases across all active subscriptions
- **Notifier** — sends email when the scanner detects a release newer than `last_seen_tag`

Splitting into microservices is not allowed. NestJS is prohibited; Fastify is the chosen framework.

## API Contract

Base path: `/api`. The contracts in `swagger.yaml` must not be changed.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/subscribe` | Subscribe an email to a repo's release notifications |
| GET | `/api/confirm/{token}` | Confirm subscription via emailed token |
| GET | `/api/unsubscribe/{token}` | Unsubscribe via emailed token |
| GET | `/api/subscriptions?email={email}` | List active subscriptions for an email |

### POST /api/subscribe

Body: `{ email: string, repo: string }` — repo in `owner/repo` format (e.g. `golang/go`)

- `400` — invalid repo format
- `404` — repo not found on GitHub
- `409` — email already subscribed to this repo
- Success: send confirmation email with a token

### GET /api/confirm/{token} and GET /api/unsubscribe/{token}

- `400` — invalid token
- `404` — token not found

### GET /api/subscriptions?email={email}

- `400` — invalid email
- `200` — array of `{ email, repo, confirmed, last_seen_tag }`

## Key Constraints

- **GitHub API rate limits**: 60 req/hour unauthenticated, 5000 with token. Must handle `429` correctly.
- **Release scanning**: store `last_seen_tag` per subscription; only notify on a release newer than the stored tag.
- **DB migrations**: must run automatically on service startup (`prisma migrate deploy` on boot).
- **Docker**: full system must be runnable via `docker-compose up`.
- **Tests**: unit tests for business logic are mandatory; integration tests are a bonus.
