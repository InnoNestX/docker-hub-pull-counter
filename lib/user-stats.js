const cache = require('./cache');

const MAX_REPOSITORIES = 500;
const DEFAULT_CACHE_TTL_MS = Number(process.env.USER_STATS_CACHE_TTL_MS) > 0
  ? Number(process.env.USER_STATS_CACHE_TTL_MS)
  : 2 * 60 * 1000;

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function getCacheKey(username) {
  return `docker:user-stats:${normalizeUsername(username)}`;
}

function createUserStats(username, repositories) {
  return {
    username,
    repositoryCount: repositories.length,
    totalPulls: repositories.reduce((sum, repository) => sum + (repository.pull_count || 0), 0),
    totalStars: repositories.reduce((sum, repository) => sum + (repository.star_count || 0), 0),
    repositories,
    refreshedAt: new Date().toISOString()
  };
}

async function fetchAllRepositories(username, dockerClient) {
  const repositories = [];
  const authToken = await dockerClient.getAuthToken();
  let nextUrl = `/repositories/${username}/?page_size=100`;

  while (nextUrl) {
    const data = await dockerClient.fetchDockerHub(nextUrl, authToken);
    repositories.push(...(data.results || []));
    nextUrl = data.next ? data.next.replace('https://hub.docker.com/v2', '') : null;

    if (repositories.length >= MAX_REPOSITORIES) {
      return repositories.slice(0, MAX_REPOSITORIES);
    }
  }

  return repositories;
}

async function getUserStats(username, options = {}) {
  const normalized = normalizeUsername(username);
  const ttl = Number(options.ttl) > 0 ? Number(options.ttl) : DEFAULT_CACHE_TTL_MS;
  const cacheKey = getCacheKey(normalized);
  const forceRefresh = Boolean(options.forceRefresh);

  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return { stats: cached, source: 'cache' };
    }
  }

  const repositories = await fetchAllRepositories(normalized, options.dockerClient);
  const freshStats = createUserStats(normalized, repositories);
  cache.set(cacheKey, freshStats, ttl);

  return { stats: freshStats, source: 'docker-hub' };
}

function projectRepository(repository, fields) {
  const projected = {};

  if (fields.includes('name')) {
    projected.name = repository.name;
  }
  if (fields.includes('namespace')) {
    projected.namespace = repository.namespace || repository.repo_namespace || null;
  }
  if (fields.includes('pullCount')) {
    projected.pullCount = repository.pull_count || 0;
  }
  if (fields.includes('starCount')) {
    projected.starCount = repository.star_count || 0;
  }
  if (fields.includes('lastUpdated')) {
    projected.lastUpdated = repository.last_updated || null;
  }

  return projected;
}

function buildUserStatsResponse(stats, fieldsParam) {
  const response = {
    success: true,
    username: stats.username,
    repositoryCount: stats.repositoryCount,
    totalPulls: stats.totalPulls,
    totalStars: stats.totalStars,
    timestamp: new Date().toISOString(),
    refreshedAt: stats.refreshedAt
  };

  if (!fieldsParam) {
    return response;
  }

  const fields = fieldsParam
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);

  response.repositories = stats.repositories
    .map((repository) => projectRepository(repository, fields))
    .sort((left, right) => {
      const leftPulls = left.pullCount ?? 0;
      const rightPulls = right.pullCount ?? 0;
      return rightPulls - leftPulls;
    });

  return response;
}

function getTopRepositories(stats, limit = 5) {
  return [...(stats.repositories || [])]
    .sort((left, right) => (right.pull_count || 0) - (left.pull_count || 0))
    .slice(0, Math.max(1, Math.min(limit, 25)))
    .map((repository) => ({
      name: repository.name,
      namespace: repository.namespace || repository.repo_namespace || stats.username,
      pullCount: repository.pull_count || 0,
      starCount: repository.star_count || 0,
      lastUpdated: repository.last_updated || null
    }));
}

module.exports = {
  DEFAULT_CACHE_TTL_MS,
  buildUserStatsResponse,
  getTopRepositories,
  getUserStats,
  normalizeUsername
};
