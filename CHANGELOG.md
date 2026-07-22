# Changelog

All notable changes to this project will be documented in this file.

## [2.0.1] - 2026-07-22

### Changed
- Wired `server.js` to shared modules (`lib/rate-limiter.js`, `lib/docker-client.js`, `lib/openapi.js`)
- User stats `fields` projection now returns only requested fields
- Cleaned setup docs and removed unused duplicate OpenAPI / type stub files

### Fixed
- Restored `getUserFacingStatsError` import used by stats card endpoints
- Corrected Docker Hub auth token cache key in the Docker client

## [2.0.0] - 2026-05-02

### Added
- Frontend split between API docs (`public/index.html`) and tester (`public/api-tester.html`)
- OpenAPI specification at `GET /api/openapi.json`
- Rate limit headers on API responses
- Batch stats and popular repos endpoints
- Shared modules for rate limiting, Docker Hub client, errors, and SVG cards

### Changed
- User statistics always fetch fresh Docker Hub data

### Removed
- Scheduled user-stat refresh endpoint
- User statistics snapshot caching in memory and Redis

## [1.0.0] - 2025-04-13

### Added
- User Statistics: `GET /api/user/stats?username=X`
- Docker Stats Card: `GET /api/docker-stats?username=X` (SVG)
- Repository Details: `GET /api/repo/details?namespace=X&repo=X`
- Repository Tags: `GET /api/repo/tags?namespace=X&repo=X&limit=X`
- Search: `GET /api/search?q=X&page=X&page_size=X`
- Public Stats: `GET /api/stats`
- Health Check: `GET /api/health`
- Upstash Redis integration for API usage stats
- Bilingual support (English / Chinese)
- Vercel deployment ready
