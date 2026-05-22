# DevRev Object Explorer

Interactive visualization of DevRev's data architecture - Object Model, AirSync, and Shared Memory.

## Structure

```
public/
  index.html                    - Data architecture presentation (5 slides)
  devrev-objects-diagram.html   - Full interactive object model (45 objects, 92 relationships)
  customer.html                 - Customer-specific object model explorer (PAT-based)
api/
  discover.js                   - Serverless function: discovers customer object model via PAT
middleware.js                   - Password-protects /customer/* routes
```

## Public pages (no auth)

- `/` - 5-slide presentation: Object Model → AirSync → Memory → Data Flow → Complete Architecture
- `/devrev-objects-diagram.html` - Interactive explorer with primary/secondary tiering

## Customer pages (password-protected)

- `/customer` - PAT input form
- `/customer/[org-name]` - Auto-generated URL after discovery

## Setup

1. Deploy to Vercel: `vercel deploy`
2. Set environment variable: `CUSTOMER_PASSWORD=your-password-here`
3. Public pages are open, `/customer/*` requires basic auth

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CUSTOMER_PASSWORD` | Password for accessing /customer/* routes |
