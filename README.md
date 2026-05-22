# DevRev Object Explorer

Interactive visualization of DevRev's data architecture — a MERN-style app optimized for Vercel deployment with a public presentation, interactive object model explorer, and multi-org customer discovery with relationship graphing.

## Stack

- **Frontend:** React 18 + Vite + React Router (static build → `client/dist`)
- **Backend:** Vercel serverless functions in `/api`
- **Auth:** JWT session cookies (`jose`) + edge middleware, two-tier (admin + org-level)
- **Database:** MongoDB Atlas for customer models, share tokens, annotations, and snapshots

## Routes

| Route | Description |
|-------|-------------|
| `/` | 5-slide data architecture presentation |
| `/objects` | Interactive 45-object / 92-relationship explorer |
| `/admin` | Master password login for DevRev employees |
| `/admin/dashboard` | Org list, create/delete orgs, manage models |
| `/customer/:slug` | Org password gate → object model + relationship graph |
| `/customer/:slug?token=xxx` | Time-limited read-only share link (no password needed) |

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth` | Validate master password, set admin JWT cookie |
| `DELETE` | `/api/auth` | Clear session |
| `GET` | `/api/session` | Check authentication status and role |
| `GET` | `/api/orgs` | List all discovered orgs (admin only) |
| `POST` | `/api/discover` | Discover org model via DevRev PAT or refresh existing (admin only) |
| `POST` | `/api/org-auth` | Authenticate with org password or share token |
| `POST` | `/api/org-delete` | Delete an org and all its data (admin only) |
| `GET` | `/api/customer/:slug` | Load customer model (requires org auth, admin, or share token) |
| `POST` | `/api/share` | Generate a time-limited share link (admin only) |
| `GET` | `/api/share?slug=xxx` | List active share links for an org (admin only) |
| `DELETE` | `/api/share` | Revoke a share link (admin only) |
| `POST` | `/api/annotations` | Add an annotation to an org (admin only) |
| `GET` | `/api/annotations?slug=xxx` | List annotations (org auth or admin) |
| `DELETE` | `/api/annotations` | Remove an annotation (admin only) |

## Authentication model

| Role | How to authenticate | Access |
|------|---------------------|--------|
| DevRev employee (admin) | Master password at `/admin` | Full access: create/delete orgs, manage share links, annotations, re-discovery |
| Customer (org viewer) | Org-specific password at `/customer/:slug` | View-only: object model, relationship graph, annotations |
| Share link recipient | Token in URL query param | Read-only, time-limited, no password needed |

## Features

- **Relationship graph:** Force-directed SVG layout showing type-level connections with animated dots. Click edges to see 2-3 real examples from the org.
- **Re-discovery:** Refresh an org's model using the stored (encrypted) PAT. Previous models saved as snapshots.
- **Diff view:** Compare current model to up to 3 previous snapshots. Shows added/removed/changed categories and relationships.
- **Share links:** Generate time-limited URLs (1 hour to 30 days) for sharing with customers without giving them the org password.
- **Export:** Download the model as JSON or the relationship graph as SVG.
- **Annotations:** Admin-added notes visible to customers. Can be attached to specific object types or left as general notes.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `CUSTOMER_PASSWORD` | Yes | Master password for admin access |
| `JWT_SECRET` | Yes | Secret for signing session tokens |
| `MONGODB_URI` | Yes | MongoDB connection string for all persistent data |
| `PAT_ENCRYPTION_KEY` | No | Key for encrypting stored PATs (falls back to JWT_SECRET) |

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

Configure all required env vars in the Vercel project settings.

`vercel.json` builds the React app, rewrites `/api/customer/:slug` to the dynamic function, and routes all other non-API paths to `index.html`.

## Project Structure

```
api/
  discover.js           POST /api/discover (new + refresh)
  auth.js               POST/DELETE /api/auth
  session.js            GET /api/session
  orgs.js               GET /api/orgs
  org-auth.js           POST /api/org-auth
  org-delete.js         POST /api/org-delete
  share.js              POST/GET/DELETE /api/share
  annotations.js        POST/GET/DELETE /api/annotations
  customer/[slug].js    GET /api/customer/:slug
  _lib/
    auth.js             JWT signing, verification, cookie management
    db.js               MongoDB: CRUD, password hashing, PAT encryption, snapshots, share tokens
    discoverLogic.js    DevRev API calls + relationship extraction
    handler.js          Response helpers
client/
  src/
    components/
      AdminLogin.jsx        Master password form
      AdminDashboard.jsx    Org list + create/delete
      AdminPanel.jsx        Share links, export, annotations management
      CustomerOrgView.jsx   Org password gate + model display
      CustomerGraph.jsx     Force-directed SVG relationship graph
      DiffView.jsx          Snapshot comparison
      ObjectExplorer.jsx    Static 45-object interactive explorer
      Presentation.jsx      5-slide deck
    data/
      objects.js            Static object metadata
      relationships.js      Static relationship definitions
    styles/
      global.css            All styles
middleware.js             Edge middleware protecting admin-only API routes
vercel.json               Build config, rewrites, cache headers
```

## DevRev API endpoints used

- `GET /dev-orgs.get` — Org info
- `POST /parts.list` — Product hierarchy
- `POST /works.list` — Issues, tickets, opportunities
- `POST /accounts.list` — Customer accounts
- `POST /sync-units.list` — Integration connections
- `POST /custom-objects.list` — Custom object types
- `POST /articles.list` — Knowledge base
- `POST /groups.list` — Teams
- `POST /conversations.list` — Support conversations
- `POST /links.list` — Explicit cross-object relationships

PATs are stored encrypted in MongoDB and never exposed to the browser after initial submission.
