# Changelog

All notable changes to this project will be documented in this file.

## [2.3.0] - 2026-07-22

### Added
- **Signal Bridge** unified docs + live testing console (`public/index.html`)
- Single endpoint catalog driving briefing text and request forms together
- Deep links via `/#signal=<endpoint-id>`

### Changed
- `api-tester.html` now redirects into Signal Bridge
- README entry point updated for the new console experience

## [2.2.0] - 2026-07-22

### Added
- Daily Redis history snapshots for users and repositories
- `/api/user/history`, `/api/user/growth`, `/api/repo/history`
- Trend SVG card `/api/trend` and Shields growth badge `/api/badge/growth`
- Vercel cron `/api/internal/snapshot-history` (daily 06:00 UTC)
- Embed snippets now include growth badge + trend card Markdown

### Changed
- Stats fetches automatically record one snapshot per user/day

## [2.1.0] - 2026-07-22

### Added
- Enforced rate limiting with Redis-backed counters and HTTP `429`
- Short user-stats cache (2 minutes) with `?fresh=1` bypass
- Shields badges: `/api/badge/pulls`, `/api/badge/stars`, `/api/badge/repos`
- Compare API: `/api/compare`
- Embed helper: `/api/embed` plus docs-page snippet generator
- Top repos API: `/api/user/top-repos`
- Repository SVG cards via `/api/docker-stats?namespace=&repo=`

### Changed
- Popular repos now lists a namespace ordered by `-pull_count` (default `library`)
- Health checks no longer inflate total API call stats
- API usage tracking uses Redis pipeline / mget
- Docs and API tester cover the new endpoints

### Fixed
- Unified validation/error payloads with `code` fields
- SVG/JSON responses now send short `Cache-Control` headers for embed-friendly caching

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
