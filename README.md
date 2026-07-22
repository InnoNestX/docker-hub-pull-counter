# Docker Hub API Gateway

[![GitHub stars](https://img.shields.io/github/stars/InnoNestX/docker-hub-pull-counter?style=social)](https://github.com/InnoNestX/docker-hub-pull-counter)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Total API Calls](https://img.shields.io/endpoint?url=https://docker-hub-pull-counter.vercel.app/api/badge/total-calls)](https://github.com/InnoNestX/docker-hub-pull-counter)

🐛 [Report Bug](https://github.com/InnoNestX/docker-hub-pull-counter/issues) · 🔧 [Submit PR](https://github.com/InnoNestX/docker-hub-pull-counter/pulls) · ⭐ [Star Repo](https://github.com/InnoNestX/docker-hub-pull-counter) · 💖 [Sponsor](https://github.com/sponsors/InnoNestX) · 💬 [Discussions](https://github.com/InnoNestX/docker-hub-pull-counter/discussions)

## ✨ Features

📊 **User Statistics** - Get total pull counts across all repositories
🖼️ **Docker Stats Card** - Embed user or repository SVG cards
🏷️ **Shields Badges** - Pulls / stars / repos badges for README
⚔️ **Compare Users** - Rank 2–5 accounts by pulls and stars
📈 **Pull History** - Daily snapshots with growth deltas
📉 **Trend Cards** - Sparkline SVG + Shields growth badges
🧩 **Embed Helper** - One API call returns ready-to-paste Markdown
📦 **Repository Details** - Fetch detailed repository information
🏷️ **Tag Listing** - List all image tags for a repository
🔍 **Search** - Search Docker Hub repositories
📋 **Batch Stats** - Get stats for multiple users in one request
🏆 **Popular Repos** - Browse namespaces ordered by pull count
📄 **OpenAPI Spec** - Full OpenAPI specification endpoint
🌐 **Bilingual** - English & Chinese support
🧪 **Signal Bridge** - Docs and live API testing in one sci-fi console
⚡ **Short Cache** - 2-minute cache with `?fresh=1` escape hatch
🛡 **Enforced Rate Limits** - Redis-backed limits with HTTP 429

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

List repositories for a namespace ordered by pull count (default namespace: `library`).

| Parameter | Type    | Required | Description                        |
|-----------|---------|----------|------------------------------------|
| namespace | string  | ❌       | Namespace (default: library)       |
| page      | integer | ❌       | Page number (default: 1)           |
| page_size | integer | ❌       | Results per page (default: 25, max: 100) |

Example:

```bash
curl "http://localhost:3000/api/popular/repos?namespace=library&page=1&page_size=10"
```

### GET /api/compare

Compare 2–5 Docker Hub users and rank them by total pulls.

```bash
curl "http://localhost:3000/api/compare?usernames=library,bitnami"
```

### GET /api/embed

Return README-ready Markdown/HTML for badges and SVG cards.

```bash
curl "http://localhost:3000/api/embed?username=xuxuclassmate"
```

### Pull history & growth

Docker Hub only exposes cumulative pull counts. This gateway snapshots them daily (on request + Vercel cron) so you can show growth.

```bash
curl "http://localhost:3000/api/user/history?username=xuxuclassmate&days=30"
curl "http://localhost:3000/api/user/growth?username=xuxuclassmate&days=7"
curl "http://localhost:3000/api/repo/history?namespace=library&repo=nginx&days=30"
```

Trend SVG card:

```html
<img src="https://docker-hub-pull-counter.vercel.app/api/trend?username=xuxuclassmate&days=30" alt="Pull trend" />
```

Growth badge:

```md
![Pull Growth](https://img.shields.io/endpoint?url=https%3A%2F%2Fdocker-hub-pull-counter.vercel.app%2Fapi%2Fbadge%2Fgrowth%3Fusername%3Dxuxuclassmate%26days%3D7)
```

> First day shows `collecting` until a second daily snapshot exists.

### Shields badges

```md
![Docker Pulls](https://img.shields.io/endpoint?url=https%3A%2F%2Fdocker-hub-pull-counter.vercel.app%2Fapi%2Fbadge%2Fpulls%3Fusername%3Dxuxuclassmate)
![Docker Stars](https://img.shields.io/endpoint?url=https%3A%2F%2Fdocker-hub-pull-counter.vercel.app%2Fapi%2Fbadge%2Fstars%3Fusername%3Dxuxuclassmate)
![Docker Repos](https://img.shields.io/endpoint?url=https%3A%2F%2Fdocker-hub-pull-counter.vercel.app%2Fapi%2Fbadge%2Frepos%3Fusername%3Dxuxuclassmate)
```

### GET /api/openapi.json

Get the OpenAPI specification for this API in JSON format.

Example:

```bash
curl "http://localhost:3000/api/openapi.json"
```

## Docker Hub Stats Card

Embed a live SVG card anywhere that supports an image tag.

```html
<img src="https://docker-hub-pull-counter.vercel.app/api/docker-stats?username=xuxuclassmate" alt="Docker Hub Stats Card" />
```

Repository card:

```html
<img src="https://docker-hub-pull-counter.vercel.app/api/docker-stats?namespace=library&repo=nginx" alt="nginx stats" />
```

## ⚡ Data Freshness

User stats responses use a short in-memory cache (default 2 minutes) and return `Cache-Control: public, max-age=120`. Pass `?fresh=1` to bypass the cache.

## 🌍 Signal Bridge Console

Open the deployed site to enter **Signal Bridge** — a unified console where documentation and live requests share one screen:

- **Endpoints** — pick any API
- **Docs** — path, params, and examples for the selection
- **Request** — fill params, send, inspect JSON/SVG responses

Deep links work via hash, e.g. `/#signal=compare`. Legacy `/api-tester.html` redirects into the bridge.

## ⚠️ Rate Limiting

- Unauthenticated: 100 requests/hour per IP
- With Docker Hub credentials configured: 200 requests/hour per IP
- Exceeding the limit returns HTTP `429` with `Retry-After`
- Counters use Upstash Redis when configured (recommended on Vercel)

## 🔐 Environment Variables

| Variable                  | Description                                                        |
|---------------------------|--------------------------------------------------------------------|
| DOCKER_USERNAME           | Docker Hub username for authenticated Docker Hub requests (optional)|
| DOCKER_PASSWORD           | Docker Hub password for authenticated Docker Hub requests (optional)|
| UPSTASH_REDIS_REST_URL   | Upstash Redis REST URL for API usage stats and rate limits         |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis REST token                                           |
| USER_STATS_CACHE_TTL_MS  | Optional user-stats cache TTL in milliseconds (default: 120000)    |
| PUBLIC_BASE_URL          | Public site URL used by `/api/embed` snippets                      |
| CRON_SECRET              | Optional secret for protecting `/api/internal/snapshot-history`    |

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
