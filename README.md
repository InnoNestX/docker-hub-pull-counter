# Docker Hub API Gateway

[![GitHub stars](https://img.shields.io/github/stars/InnoNestX/docker-hub-pull-counter?style=flat-square)](https://github.com/InnoNestX/docker-hub-pull-counter)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

## ✨ Features

- 📊 **User Statistics** - Get total pull counts across all repositories
- 📦 **Repository Details** - Fetch detailed repository information
- 🏷️ **Tag Listing** - List all image tags for a repository
- 🔍 **Search** - Search Docker Hub repositories
- 🌐 **Bilingual** - English & Chinese support
- 🧪 **Interactive Testing** - Try APIs directly in the documentation
- ⚡ **Fast** - Built with Hono.js for optimal performance

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| username | string | ✅ | Docker Hub username |
| fields | string | ❌ | Comma-separated fields to return |

**Example:**
```bash
curl "http://localhost:3000/api/user/stats?username=xuxuclassmate"
```

**Response:**
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

### GET /api/repo/details

Get detailed information about a repository.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| namespace | string | ✅ | Docker Hub namespace |
| repo | string | ✅ | Repository name |

### GET /api/repo/tags

List all tags for a repository.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| namespace | string | ✅ | Docker Hub namespace |
| repo | string | ✅ | Repository name |
| limit | integer | ❌ | Max tags to return (default: 100) |

### GET /api/search

Search Docker Hub repositories.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | ✅ | Search query |
| page | integer | ❌ | Page number (default: 1) |
| page_size | integer | ❌ | Results per page (default: 25) |

## 🌍 Interactive Documentation

Visit the deployed URL to access the interactive API documentation with:
- Live testing interface
- Parameter customization
- Real-time response display
- Language switcher (EN/中文)

## ⚠️ Rate Limiting

- Unauthenticated: ~100-200 requests/hour
- Authenticated: Higher limits (configure `DOCKER_USERNAME` and `DOCKER_PASSWORD`)

## 🔐 Environment Variables

| Variable | Description |
|----------|-------------|
| DOCKER_USERNAME | Docker Hub username (optional) |
| DOCKER_PASSWORD | Docker Hub password (optional) |

## 📄 License

MIT

---

## 👤 Author

**XuXuClassMate**

- GitHub: [@XuXuClassMate](https://github.com/XuXuClassMate)
- Docker Hub: [xuxuclassmate](https://hub.docker.com/u/xuxuclassmate)
