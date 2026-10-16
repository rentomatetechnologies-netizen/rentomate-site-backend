# RentOMate Backend

The REST API behind **rentomate.life**: admin authentication, blog posts and image uploads. It is the **only service that connects to PostgreSQL**. The website (`rentomate-frontend`), including the admin panel at `/admin`, talks to it over HTTP.

```
Browser ──► rentomate-frontend (Next.js) ──► rentomate-backend (Express + Prisma) ──► PostgreSQL
            /            public site          /api/auth/*   login, logout, me
            /blog        reads /api/public    /api/admin/*  posts, media, admins, password (login required)
            /admin       admin panel UI       /api/public/* published posts
            /api/auth/*, /api/admin/*, /media/*  ─ forwarded to the backend (same origin, so cookies stay first-party)
```

## Project layout

```
src/
  routes/        URL → controller wiring (auth, admin, public)
  controllers/   HTTP layer: read request, call service, send response
  services/      Business logic + database access (auth, posts, admins, media, revalidate)
  middleware/    requireAdmin (session check), CSRF header check, error handling
  auth/          Password hashing (scrypt) and session token helpers
  validation/    zod schemas for request bodies
  lib/           Prisma client, HttpError, param parsing
  scripts/       seed.ts (first admin + starter posts), create-admin.ts
  app.ts         Express app (helmet, JSON, cookies, routes)
  server.ts      Entry point
prisma/
  schema.prisma  Admin, Session, LoginAttempt, Post, Media
  migrations/
Dockerfile
docker-compose.yml   Postgres + backend (the website runs outside Docker)
```

## API

| Method | Path | Auth | |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | – | `{ username, password }` → sets session cookie |
| POST | `/api/auth/logout` | – | Ends the session |
| GET | `/api/auth/me` | admin | Current admin |
| GET | `/api/admin/dashboard` | admin | Post/admin counts, recently updated posts |
| GET / POST | `/api/admin/posts` | admin | List / create posts |
| GET / PUT / DELETE | `/api/admin/posts/:id` | admin | Read / update / delete a post |
| POST | `/api/admin/media` | admin | Multipart `image` → `{ url }` |
| GET / POST | `/api/admin/admins` | admin | List / add admins |
| DELETE | `/api/admin/admins/:id` | admin | Remove an admin (not yourself) |
| PUT | `/api/admin/account/password` | admin | `{ currentPassword, newPassword }` |
| GET | `/api/public/posts`, `/api/public/posts/:slug` | – | Published posts for the website |
| GET | `/media/:id` | – | Uploaded image |
| GET | `/health` | – | Liveness check |

All `POST`/`PUT`/`DELETE` requests under `/api/auth` and `/api/admin` must send the header `x-rentomate-admin: 1`.

## Security

- **Passwords** are hashed with scrypt; plain passwords are never stored.
- **Sessions:** a random token goes in an `HttpOnly`, `SameSite=Strict` cookie (HTTPS-only in production), and only its SHA-256 hash is stored. **Every admin request is checked against the database**, so logging out, removing an admin or changing a password takes effect immediately. Sessions expire after 12 hours.
- **CSRF:** writes require the custom header above. Other sites can't send it, and the API has no CORS.
- **Brute force:** login is blocked for 15 minutes after 8 failures for a username, or 30 from one IP. The real client IP is taken from `X-Forwarded-For`, trusting only loopback and private-network proxies (`TRUST_PROXY`).
- **Validation:** all input is validated on the server with zod. Images are checked by file content (JPG, PNG, WebP, GIF, AVIF; no SVG) and must be 8 MB or smaller.
- `helmet` security headers.

## Local development

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, ADMIN_PASSWORD, REVALIDATE_SECRET
npm run db:migrate        # create tables
npm run db:seed           # first admin + 3 starter posts
npm run dev               # http://localhost:4000
```

No local Postgres? `npx prisma dev -d -n rentomate` starts one and prints its URL.

Then run the website (`npm run dev` in `rentomate-frontend`, with `BACKEND_URL=http://localhost:4000` and the same `REVALIDATE_SECRET` in `.env.local`) and open **http://localhost:3000/admin**.

Create or reset an admin from the terminal: `npm run admin:create -- <username>`.

## Docker

```bash
cp .env.example .env      # set POSTGRES_PASSWORD, ADMIN_PASSWORD, REVALIDATE_SECRET
docker compose up -d --build
```

Docker runs **only the backend**: PostgreSQL (data kept in the `pgdata` volume, not exposed outside Docker) and the API, published on `BACKEND_PORT` (default 4000). On every start the API applies migrations and, if the database is empty, creates the first admin and the starter posts.

- Admin CLI inside Docker: `docker compose exec backend node dist/scripts/create-admin.js <username>`
- Back up the database: `docker compose exec db pg_dump -U rentomate rentomate > backup.sql`

### Connecting the website

The website is not in Docker. It finds the API only through environment variables (`.env.local` locally, or the host's env settings in production):

```bash
BACKEND_URL=http://localhost:4000     # or the API server's address, e.g. http://10.0.0.5:4000
REVALIDATE_SECRET=<same as backend>
```

`BACKEND_URL` is read when the website is **built** (it's baked into the `/api/*` and `/media/*` forwarding), so rebuild the website after changing it. In the other direction, the API reaches the website through `DOCKER_FRONTEND_REVALIDATE_URL` (the default points at a website running on the Docker host).

**Production:** keep port 4000 private. Only the website server needs to reach it (firewall, or bind it as `127.0.0.1:4000:4000` when both run on one machine). Serve `rentomate.life` over HTTPS. Session cookies are HTTPS-only (`COOKIE_SECURE=true`, the default in Docker); browsers allow them on `http://localhost` for local testing.
