# Docker Hub API Gateway

[![GitHub stars](https://img.shields.io/github/stars/InnoNestX/docker-hub-pull-counter?style=social)](https://github.com/InnoNestX/docker-hub-pull-counter)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Total API Calls](https://img.shields.io/endpoint?url=https://docker-hub-pull-counter.vercel.app/api/badge/total-calls)](https://github.com/InnoNestX/docker-hub-pull-counter)

🐛 [Report Bug](https://github.com/InnoNestX/docker-hub-pull-counter/issues) · 🔧 [Submit PR](https://github.com/InnoNestX/docker-hub-pull-counter/pulls) · ⭐ [Star Repo](https://github.com/InnoNestX/docker-hub-pull-counter) · 💖 [Sponsor](https://github.com/sponsors/InnoNestX) · 💬 [Discussions](https://github.com/InnoNestX/docker-hub-pull-counter/discussions)

## ✨ Features

📊 **User Statistics** - Get total pull counts across all repositories
🖼️ **Docker Stats Card** - Embed Docker Hub stats as an SVG card
📦 **Repository Details** - Fetch detailed repository information
🏷️ **Tag Listing** - List all image tags for a repository
🔍 **Search** - Search Docker Hub repositories
📋 **Batch Stats** - Get stats for multiple users in one request
🏆 **Popular Repos** - Discover popular Docker Hub repositories
📄 **OpenAPI Spec** - Full OpenAPI specification endpoint
🌐 **Bilingual** - English & Chinese support
🧪 **Interactive Testing** - Try APIs directly in the documentation
⚡ **Fast** - Built with Hono.js plus in-memory and Redis-backed caching
📊 **Rate Limiting** - Built-in rate limit headers for API protection

## 🚀 Quick Start

### Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

### Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## 📖 API Endpoints

### GET /api/user/stats

Get total pull counts for a Docker Hub user.

| Parameter | Type   | Required | Description                      |
|-----------|--------|----------|----------------------------------|
| username  | string | ✅       | Docker Hub username              |
| fields    | string | ❌       | Comma-separated fields to return |

Example:

```bash
curl "http://localhost:3000/api/user/stats?username=xuxuclassmate"
```

Response:

```json
{
  "success": true,
  "username": "xuxuclassmate",
  "repositoryCount": 5,
  "totalPulls": 123456,
  "totalStars": 789,
  "repositories": [...],
  "timestamp": "2026-04-06T10:00:00.000Z"
}
```

### GET /api/docker-stats

Returns an SVG card for Docker Hub stats.

| Parameter | Type   | Required | Description                      |
|-----------|--------|----------|----------------------------------|
| username  | string | ✅       | Docker Hub username              |
| style     | string | ❌       | Card style: gradient, minimal, dark, light, github (default: gradient) |

Example:

```html
<img src="https://docker-hub-pull-counter.vercel.app/api/docker-stats?username=xuxuclassmate" alt="Docker Hub Stats Card" />
```

#### Available Card Styles

| Style     | Description                          |
|-----------|--------------------------------------|
| gradient  | Blue gradient (default)              |
| minimal   | Clean white minimal style            |
| dark      | Pure black dark style               |
| light     | Light blue sky style                 |
| github    | GitHub-inspired dark style           |

Example URLs for each style:

```html
<img src="https://docker-hub-pull-counter.vercel.app/api/docker-stats?username=xuxuclassmate&style=gradient" alt="Gradient Card" />
<img src="https://docker-hub-pull-counter.vercel.app/api/docker-stats?username=xuxuclassmate&style=minimal" alt="Minimal Card" />
<img src="https://docker-hub-pull-counter.vercel.app/api/docker-stats?username=xuxuclassmate&style=dark" alt="Dark Card" />
<img src="https://docker-hub-pull-counter.vercel.app/api/docker-stats?username=xuxuclassmate&style=light" alt="Light Card" />
<img src="https://docker-hub-pull-counter.vercel.app/api/docker-stats?username=xuxuclassmate&style=github" alt="GitHub Card" />
```

### GET /api/docker-stats/styles

List all available card styles.

```bash
curl "https://docker-hub-pull-counter.vercel.app/api/docker-stats/styles"
```

Response:

```json
{
  "success": true,
  "styles": ["gradient", "minimal", "dark", "light", "github"],
  "default": "gradient"
}
```

### GET /api/repo/details

Get detailed information about a repository.

| Parameter | Type   | Required | Description          |
|-----------|--------|----------|----------------------|
| namespace | string | ✅       | Docker Hub namespace |
| repo      | string | ✅       | Repository name      |

### GET /api/repo/tags

List all tags for a repository.

| Parameter | Type    | Required | Description                    |
|-----------|---------|----------|--------------------------------|
| namespace | string  | ✅       | Docker Hub namespace           |
| repo      | string  | ✅       | Repository name                |
| limit     | integer | ❌       | Max tags to return (default: 100) |

### GET /api/search

Search Docker Hub repositories.

| Parameter | Type    | Required | Description                    |
|-----------|---------|----------|--------------------------------|
| q         | string  | ✅       | Search query                   |
| page      | integer | ❌       | Page number (default: 1)       |
| page_size | integer | ❌       | Results per page (default: 25)|

### GET /api/batch/stats

Get statistics for multiple Docker Hub users in a single request.

| Parameter  | Type   | Required | Description                           |
|------------|--------|----------|---------------------------------------|
| usernames  | string | ✅       | Comma-separated list of usernames (max 10) |

Example:

```bash
curl "http://localhost:3000/api/batch/stats?usernames=node,python,golang"
```

Response:

```json
{
  "success": true,
  "total": 3,
  "successful": 3,
  "failed": 0,
  "results": [...],
  "timestamp": "2026-04-06T10:00:00.000Z"
}
```

### GET /api/popular/repos

Get popular Docker Hub repositories.

| Parameter | Type    | Required | Description                        |
|-----------|---------|----------|------------------------------------|
| page      | integer | ❌       | Page number (default: 1)           |
| page_size | integer | ❌       | Results per page (default: 25, max: 100) |

Example:

```bash
curl "http://localhost:3000/api/popular/repos?page=1&page_size=10"
```

### GET /api/openapi.json

Get the OpenAPI specification for this API in JSON format.

Example:

```bash
curl "http://localhost:3000/api/openapi.json"
```

### GET /api/internal/refresh-stats

Force-refresh cached stats for all known usernames. This endpoint is designed for scheduled refreshes from Vercel Pro cron jobs or any external scheduler (e.g., GitHub Actions, cron services).

If `CRON_SECRET` environment variable is set, requests must include `Authorization: Bearer <CRON_SECRET>` header.

**Note:** If deploying on Vercel Hobby, built-in cron jobs are limited to once per day. For 5-10 minute refresh intervals, use an external scheduler or upgrade to Vercel Pro.

Example:

```bash
# Without secret (if CRON_SECRET is not set)
curl "https://docker-hub-pull-counter.vercel.app/api/internal/refresh-stats"

# With secret
curl -H "Authorization: Bearer my-secret" "https://docker-hub-pull-counter.vercel.app/api/internal/refresh-stats"
```

Response:

```json
{
  "success": true,
  "total": 1,
  "refreshed": ["xuxuclassmate"],
  "failed": [],
  "timestamp": "2026-04-24T11:14:28.109Z"
}
```

## Docker Hub Stats Card

Embed a live SVG card anywhere that supports an image tag. The card reuses the internal cached stats pipeline, so it does not need to call the public JSON endpoint first.

```html
<img src="https://docker-hub-pull-counter.vercel.app/api/docker-stats?username=xuxuclassmate" alt="Docker Hub Stats Card" />
```

The card includes:
- Total Pulls
- Repository Count
- Total Stars

## ⚡ Performance & Caching

User statistics are loaded through a shared data layer designed for reuse by future endpoints such as badges or org stats.

- In-memory cache is the first read layer with a default TTL of 5 minutes
- Redis stores the latest user snapshot so cold starts can skip Docker Hub fetches
- `/api/internal/refresh-stats` is available for scheduled refreshes from Vercel Pro cron jobs or any external scheduler
- On cache miss, the service falls back to Redis, then to Docker Hub as the final source of truth

> **Note:** If you deploy on Vercel Hobby, built-in cron jobs are limited to once per day. For 5-10 minute refresh intervals, use an external scheduler or upgrade the project to Vercel Pro.

## 🌍 Interactive Documentation

Visit the deployed URL to access the interactive API documentation with:

- Live testing interface
- Parameter customization
- SVG card preview
- Real-time response display
- Language switcher (EN/中文)

## ⚠️ Rate Limiting

- Unauthenticated: ~100-200 requests/hour
- Authenticated: Higher limits (configure DOCKER_USERNAME and DOCKER_PASSWORD)

## 🔐 Environment Variables

| Variable                  | Description                                                        |
|---------------------------|--------------------------------------------------------------------|
| DOCKER_USERNAME           | Docker Hub username for authenticated Docker Hub requests (optional)|
| DOCKER_PASSWORD           | Docker Hub password for authenticated Docker Hub requests (optional)|
| UPSTASH_REDIS_REST_URL   | Upstash Redis REST URL for usage stats and cached user snapshots  |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis REST token                                           |
| CRON_SECRET               | Optional secret used to protect the scheduled refresh endpoint     |
| USER_STATS_CACHE_TTL_MS  | Optional in-memory cache TTL in milliseconds (default: 300000)     |

## 📄 License

MIT

## 💖 Support

If this project helps you, consider supporting us:

- 🌟 [GitHub Sponsors](https://github.com/sponsors/InnoNestX) - Become a sponsor
- ☕ [Buy Me a Coffee](https://buymeacoffee.com/xuxuclassmate) - One-time support
- ⭐ [Star this repo](https://github.com/InnoNestX/docker-hub-pull-counter) - It's free and means a lot!

## 👤 Author

**XuXuClassMate**

- GitHub: [@XuXuClassMate](https://github.com/XuXuClassMate)
- Docker Hub: [xuxuclassmate](https://hub.docker.com/u/xuxuclassmate)
- Organization: [InnoNestX](https://github.com/InnoNestX)
