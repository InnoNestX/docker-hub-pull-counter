# Upstash Redis Setup

## Database

- **Database Name:** `docker-hub-pull-counter`
- **Region:** `us-east-1`
- **Status:** Active

## Environment Variables

Vercel auto-provisions these for the linked Upstash integration:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional Docker Hub credentials for higher rate limits:

- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`
