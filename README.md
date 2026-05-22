# DevRev Object Explorer

Interactive visualization of DevRev's data architecture — a MERN-style app optimized for Vercel deployment with a public presentation, interactive object model explorer, and password-protected customer discovery.

## Stack

- **Frontend:** React 18 + Vite + React Router (static build → `client/dist`)
- **Backend:** Vercel serverless functions in `/api`
- **Auth:** JWT session cookie (`jose`) + edge middleware
- **Database:** MongoDB Atlas (optional) for cached customer models

## Routes

| Route | Description |
|-------|-------------|
| `/` | 5-slide data architecture presentation |
| `/objects` | Interactive 45-object / 92-relationship explorer |
| `/customer` | Password gate → PAT discovery form |
| `/customer/:slug` | Cached or live customer object model |

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth` | Validate `CUSTOMER_PASSWORD`, set JWT cookie |
| `DELETE` | `/api/auth` | Clear session |
| `GET` | `/api/session` | Check authentication status |
| `POST` | `/api/discover` | Discover org model via DevRev PAT (auth required) |
| `GET` | `/api/customer/:slug` | Load cached customer model (auth required) |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `CUSTOMER_PASSWORD` | Yes | Password for `/customer` access |
| `JWT_SECRET` | Yes | Secret for signing session tokens |
| `MONGODB_URI` | No | Persist discovered models (`customers` collection) |

Copy `.env.example` to `.env` for local development.

## Local Development

```bash
# Install root API dependencies
npm install

# Install and run React dev server (proxies /api to Vercel)
cd client && npm install && npm run dev

# In another terminal, run Vercel dev for API + middleware
npm run dev:api
```

Or use `vercel dev` from the project root (serves both API and built/static assets when configured).

Set env vars in `.env` or via `vercel env pull`.

## Fonts

Place DevRev Chip font files in `client/public/fonts/`:

- `ChipDisp-Bold.otf`, `ChipDisp-Semibold.otf`
- `ChipText-Regular.otf`, `ChipText-Medium.otf`, `ChipText-Semibold.otf`
- `ChipMono-Medium.otf`

The app falls back to system fonts if these are missing.

## Deploy to Vercel

```bash
vercel deploy
```

Configure `CUSTOMER_PASSWORD`, `JWT_SECRET`, and optionally `MONGODB_URI` in the Vercel project settings.

`vercel.json` builds the React app and rewrites all non-API routes to `index.html`.

## Project Structure

```
api/
  discover.js           POST /api/discover
  auth.js               POST/DELETE /api/auth
  session.js            GET /api/session
  customer/[slug].js    GET /api/customer/:slug
  _lib/                 Shared discovery, auth, DB logic
client/
  src/                  React app
  public/legacy/        Original HTML presentation (embedded via iframe)
middleware.js           JWT protection for /customer/* and protected APIs
```

## DevRev API Notes

- Base URL: `https://api.devrev.ai`
- PAT in `Authorization` header as-is (no `Bearer` prefix)
- Discovery never exposes the PAT to the browser after submission
