# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2025-XX-XX

### Added
- **Frontend Split**: Separated documentation from API testing
  - `/public/index.html` - Pure API documentation (no interactive testing)
  - `/public/api-tester.html` - Unified API testing tool with:
    - Endpoint selector dropdown
    - Dynamic parameter forms
    - JSON syntax highlighting
    - cURL generator
    - Request history (localStorage)
- **OpenAPI Specification**: `GET /api/openapi.json` returns complete OpenAPI 3.0 spec
- **Rate Limiting Headers**: All API responses include `X-RateLimit-*` headers
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when window resets
  - Window: 1 hour (100 requests for unauthenticated, 200 for authenticated)
- **Batch Stats Endpoint**: `GET /api/batch/stats?usernames=user1,user2,...` - Fetch stats for up to 10 users in one request
- **Popular Repos Endpoint**: `GET /api/popular/repos?page=1&page_size=25` - Browse popular Docker Hub repositories
- **Error Classes**: Custom error hierarchy in `lib/errors.js`
  - `ValidationError`, `NotFoundError`, `RateLimitError`, `DockerHubError`, etc.
- **Rate Limiter Module**: `lib/rate-limiter.js` with configurable limits
- **Docker Client Module**: `lib/docker-client.js` extracted Docker Hub API client
- **SVG Utils Module**: `lib/svg-utils.js` extracted SVG generation utilities

### Changed
- **Improved Error Messages**: More descriptive error messages with hints
- **Response Enhancement**: All API responses now include rate limit headers
- **Stats Endpoint**: Now tracks calls to new endpoints (batch, popular, openapi)

### Fixed
- Search endpoint now uses correct Docker Hub API parameter naming

## [1.0.0] - 2025-04-13

### Added
- User Statistics: `GET /api/user/stats?username=X`
- Docker Stats Card: `GET /api/docker-stats?username=X` (SVG)
- Repository Details: `GET /api/repo/details?namespace=X&repo=X`
- Repository Tags: `GET /api/repo/tags?namespace=X&repo=X&limit=X`
- Search: `GET /api/search?q=X&page=X&page_size=X`
- Public Stats: `GET /api/stats`
- Health Check: `GET /api/health`
- Internal Refresh: `GET /api/internal/refresh-stats`
- In-memory caching with TTL
- Upstash Redis integration for persistent caching
- Bilingual support (English / Chinese)
- Vercel deployment ready
