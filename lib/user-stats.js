const cache = require('./cache');

const USER_STATS_KEY_PREFIX = 'docker:user-stats:';
const KNOWN_USERS_KEY = 'docker:user-stats:usernames';
const DEFAULT_CACHE_TTL = Number(process.env.USER_STATS_CACHE_TTL_MS) > 0
  ? Number(process.env.USER_STATS_CACHE_TTL_MS)
  : 5 * 60 * 1000;
const MAX_REPOSITORIES = 500;
const knownUsers = new Set();

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function getCacheKey(username) {
  return `${USER_STATS_KEY_PREFIX}${normalizeUsername(username)}`;
}

function rememberUsername(username) {
  const normalized = normalizeUsername(username);

  if (normalized) {
    knownUsers.add(normalized);
  }

  return normalized;
}

function parseRedisValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
}

function normalizeStoredStats(stats, username) {
  if (!stats) {
    return null;
  }

  const repositories = Array.isArray(stats.repositories) ? stats.repositories : [];

  return {
    username: normalizeUsername(stats.username || username),
    repositoryCount: Number(stats.repositoryCount) || repositories.length,
    totalPulls: Number(stats.totalPulls) || 0,
    totalStars: Number(stats.totalStars) || 0,
    repositories,
    refreshedAt: stats.refreshedAt || new Date().toISOString()
  };
}

function createStatsSnapshot(username, repositories) {
  return {
    username,
    repositoryCount: repositories.length,
    totalPulls: repositories.reduce((sum, repository) => sum + (repository.pull_count || 0), 0),
    totalStars: repositories.reduce((sum, repository) => sum + (repository.star_count || 0), 0),
    repositories,
    refreshedAt: new Date().toISOString()
  };
}

async function readPersistedStats(redis, username) {
  if (!redis) {
    return null;
  }

  try {
    const cachedStats = await redis.get(getCacheKey(username));
    return normalizeStoredStats(parseRedisValue(cachedStats), username);
  } catch (error) {
    console.error('[USER STATS] Redis read error:', error.message);
    return null;
  }
}

async function persistStats(redis, stats) {
  const username = rememberUsername(stats.username);

  if (!redis || !username) {
    return;
  }

  try {
    await Promise.all([
      redis.set(getCacheKey(username), stats),
      redis.sadd(KNOWN_USERS_KEY, username)
    ]);
  } catch (error) {
    console.error('[USER STATS] Redis write error:', error.message);
  }
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

async function fetchFreshUserStats(username, options) {
  const normalized = rememberUsername(username);
  const repositories = await fetchAllRepositories(normalized, options.dockerClient);
  const stats = createStatsSnapshot(normalized, repositories);
  const ttl = Number(options.ttl) > 0 ? Number(options.ttl) : DEFAULT_CACHE_TTL;

  cache.set(getCacheKey(normalized), stats, ttl);
  await persistStats(options.redis, stats);

  return stats;
}

async function getUserStats(username, options = {}) {
  const normalized = rememberUsername(username);
  const ttl = Number(options.ttl) > 0 ? Number(options.ttl) : DEFAULT_CACHE_TTL;

  // Try in-memory cache first
  const cachedStats = cache.get(getCacheKey(normalized));
  if (cachedStats) {
    return { stats: cachedStats, source: 'memory' };
  }

  // Try Redis if available
  if (options.redis) {
    const redisStats = await readPersistedStats(options.redis, normalized);
    if (redisStats) {
      cache.set(getCacheKey(normalized), redisStats, ttl);
      return { stats: redisStats, source: 'redis' };
    }
  }

  // Fetch from Docker Hub as final fallback
  const freshStats = await fetchFreshUserStats(normalized, options);
  return { stats: freshStats, source: 'dockerhub' };
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
      const leftPulls = left.pullCount ?? left.pull_count ?? 0;
      const rightPulls = right.pullCount ?? right.pull_count ?? 0;
      return rightPulls - leftPulls;
    });

  return response;
}

function projectRepository(repository, fields) {
  const projected = { ...repository };

  if (fields.includes('name')) {
    projected.name = repository.name;
  }
  if (fields.includes('namespace')) {
    projected.namespace = repository.namespace || repository.repo_namespace || repository.namespace;
  }
  if (fields.includes('pullCount')) {
    projected.pullCount = repository.pull_count;
  }
  if (fields.includes('starCount')) {
    projected.starCount = repository.star_count;
  }
  if (fields.includes('lastUpdated')) {
    projected.lastUpdated = repository.last_updated;
  }

  return projected;
}

async function getKnownUsernames(redis) {
  const usernames = new Set(knownUsers);

  if (redis) {
    try {
      const storedUsers = await redis.smembers(KNOWN_USERS_KEY);
      for (const username of storedUsers || []) {
        if (username) {
          usernames.add(normalizeUsername(username));
        }
      }
    } catch (error) {
      console.error('[USER STATS] Redis list error:', error.message);
    }
  }

  return Array.from(usernames);
}

async function refreshKnownUserStats(options = {}) {
  const usernames = await getKnownUsernames(options.redis);
  const refreshed = [];
  const failed = [];

  for (const username of usernames) {
    try {
      await fetchFreshUserStats(username, options);
      refreshed.push(username);
    } catch (error) {
      failed.push({
        username,
        error: error.message
      });
    }
  }

  return {
    total: usernames.length,
    refreshed,
    failed
  };
}

module.exports = {
  DEFAULT_CACHE_TTL,
  buildUserStatsResponse,
  getUserStats,
  refreshKnownUserStats
};
