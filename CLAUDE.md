# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Docker Hub API Gateway - a Hono.js server that proxies Docker Hub statistics. Deployed on Vercel with Upstash Redis for API usage counters.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at localhost:3000
npm run build        # No build step (echo 'No build step required')
npm start            # Production start (node server.js)
```

## Architecture

### Request Flow
All API routes follow this pattern: validate params → `trackCall()` → fetch data → return response with rate limit headers.

### User Stats Data Flow
`lib/user-stats.js` fetches fresh Docker Hub repository data through `getUserStats()` on every user stats request, then sums repository pull and star counts.

### Key Files

- **server.js** - Route definitions and app setup. Routes must be defined before static file serving middleware.
- **lib/cache.js** - In-memory cache used for Docker Hub auth tokens
- **lib/user-stats.js** - Fresh user stats fetching and response building
- **lib/svg-utils.js** - SVG card generation with 5 styles (gradient, minimal, dark, light, github)
- **lib/errors.js** - Error types and handling utilities
- **api/index.js** - Vercel serverless function entry point

### Authentication

- Docker Hub authentication uses `DOCKER_USERNAME` + `DOCKER_PASSWORD` with token cached for 10 minutes
- Public endpoints have no auth but include rate limit headers

### Rate Limiting

In-memory rate limit store (60-minute window, 100 requests for unauthenticated, 200 for authenticated). Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DOCKER_USERNAME` | Docker Hub auth username (optional) |
| `DOCKER_PASSWORD` | Docker Hub auth password (optional) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (auto-configured on Vercel) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token (auto-configured on Vercel) |
