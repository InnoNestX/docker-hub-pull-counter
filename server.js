const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');
const { checkRateLimit } = require('./lib/rate-limiter');
const { fetchDockerHub, createDockerClient } = require('./lib/docker-client');
const {
  buildUserStatsResponse,
  getTopRepositories,
  getUserStats
} = require('./lib/user-stats');
const { generateOpenApiSpec } = require('./lib/openapi');
const { buildShieldsBadge, buildUserBadges, formatCompact } = require('./lib/badges');
const {
  getRepoHistory,
  getUserHistory,
  listTrackedUsers,
  recordRepoSnapshot,
  recordUserSnapshot
} = require('./lib/history');
const {
  AppError,
  ValidationError,
  NotFoundError,
  RateLimitError
} = require('./lib/errors');
const {
  createDockerStatsSvgWithStyle,
  createRepoStatsSvgWithStyle,
  createTrendSvgWithStyle,
  getAvailableStyles,
  getUserFacingStatsError
} = require('./lib/svg-utils');

const app = new Hono();
const dockerClient = createDockerClient();
const STATS_CACHE_SECONDS = 120;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://docker-hub-pull-counter.vercel.app';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    })
  : null;

const EMPTY_ENDPOINT_STATS = {
  'user/stats': 0,
  'docker-stats': 0,
  'repo/details': 0,
  'repo/tags': 0,
  search: 0,
  'batch/stats': 0,
  'popular/repos': 0,
  compare: 0,
  embed: 0,
  'user/top-repos': 0,
  'user/history': 0,
  'user/growth': 0,
  'repo/history': 0,
  trend: 0,
  openapi: 0,
  badge: 0,
  'internal/snapshot-history': 0
};

async function trackCall(endpoint) {
  if (!redis) return;

  try {
    const pipeline = redis.pipeline();
    pipeline.incr('stats:totalCalls');
    pipeline.incr(`stats:endpoint:${endpoint}`);
    pipeline.set('stats:lastUpdated', new Date().toISOString());
    await pipeline.exec();
  } catch (error) {
    console.error('Track call error:', error.message);
  }
}

async function getStats() {
  if (!redis) {
    return {
      totalCalls: 0,
      byEndpoint: { ...EMPTY_ENDPOINT_STATS },
      lastUpdated: new Date().toISOString(),
      warning: 'Redis not configured'
    };
  }

  try {
    const keys = [
      'stats:totalCalls',
      ...Object.keys(EMPTY_ENDPOINT_STATS).map((endpoint) => `stats:endpoint:${endpoint}`),
      'stats:lastUpdated'
    ];
    const values = await redis.mget(...keys);
    const byEndpoint = {};
    const endpointKeys = Object.keys(EMPTY_ENDPOINT_STATS);
    endpointKeys.forEach((endpoint, index) => {
      byEndpoint[endpoint] = Number(values[index + 1] || 0);
    });

    return {
      totalCalls: Number(values[0] || 0),
      byEndpoint,
      lastUpdated: values[values.length - 1] || new Date().toISOString()
    };
  } catch (error) {
    console.error('Redis error:', error.message);
    return {
      totalCalls: 0,
      byEndpoint: { ...EMPTY_ENDPOINT_STATS },
      lastUpdated: new Date().toISOString(),
      error: 'Failed to fetch stats'
    };
  }
}

function isNotFoundError(error) {
  return error instanceof NotFoundError || error.message === 'Resource not found';
}

function errorPayload(error, fallbackMessage) {
  if (error instanceof AppError) {
    return error.toJSON();
  }

  return {
    success: false,
    error: fallbackMessage || error.message,
    code: 'INTERNAL_ERROR',
    originalError: error.message
  };
}

function cacheHeaders(source) {
  if (source === 'cache') {
    return {
      'Cache-Control': `public, max-age=${STATS_CACHE_SECONDS}`,
      'X-Cache': 'HIT'
    };
  }

  return {
    'Cache-Control': `public, max-age=${STATS_CACHE_SECONDS}`,
    'X-Cache': 'MISS'
  };
}

function wantsFresh(c) {
  return c.req.query('fresh') === '1' || c.req.query('fresh') === 'true';
}

async function loadUserStats(username, options = {}) {
  const result = await getUserStats(username, {
    dockerClient,
    forceRefresh: Boolean(options.forceRefresh)
  });
  // Await daily snapshot so history/growth reads see today's sample
  await recordUserSnapshot(redis, result.stats).catch(() => {});
  return result;
}

function parseDays(value, fallback = 30) {
  const days = parseInt(value || String(fallback), 10);
  if (!Number.isFinite(days)) return fallback;
  return Math.max(1, Math.min(days, 90));
}

app.use('/api/*', cors());

app.use('/api/*', async (c, next) => {
  const pathName = new URL(c.req.url).pathname;
  // Keep health and public badge total-calls lightly gated but still counted in limiter
  const skipEnforce = pathName === '/api/health';
  const result = await checkRateLimit(c, {
    redis,
    isAuthenticated: Boolean(process.env.DOCKER_USERNAME && process.env.DOCKER_PASSWORD)
  });

  c.set('rateLimitHeaders', result.headers);

  if (!skipEnforce && !result.allowed) {
    const error = new RateLimitError(result.retryAfter || 60);
    return c.json(error.toJSON(), 429, {
      ...result.headers,
      'Retry-After': String(result.retryAfter || 60)
    });
  }

  await next();
});

function rateHeaders(c, extra = {}) {
  return {
    ...(c.get('rateLimitHeaders') || {}),
    ...extra
  };
}

app.get('/api/user/stats', async (c) => {
  const username = c.req.query('username');
  const fieldsParam = c.req.query('fields');
  if (!username) {
    return c.json(new ValidationError('username parameter required', 'username').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('user/stats');

  try {
    const { stats, source } = await loadUserStats(username, {
      forceRefresh: wantsFresh(c)
    });
    return c.json(
      { ...buildUserStatsResponse(stats, fieldsParam), source },
      200,
      rateHeaders(c, cacheHeaders(source))
    );
  } catch (error) {
    console.error('[USER STATS] Error:', error.message);
    return c.json(
      {
        ...errorPayload(error, getUserFacingStatsError(username, error))
      },
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c)
    );
  }
});

app.get('/api/user/top-repos', async (c) => {
  const username = c.req.query('username');
  const limit = parseInt(c.req.query('limit') || '5', 10);
  if (!username) {
    return c.json(new ValidationError('username parameter required', 'username').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('user/top-repos');

  try {
    const { stats, source } = await loadUserStats(username, {
      forceRefresh: wantsFresh(c)
    });
    return c.json(
      {
        success: true,
        username: stats.username,
        limit,
        repositories: getTopRepositories(stats, limit),
        source,
        timestamp: new Date().toISOString()
      },
      200,
      rateHeaders(c, cacheHeaders(source))
    );
  } catch (error) {
    return c.json(
      errorPayload(error, getUserFacingStatsError(username, error)),
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c)
    );
  }
});

app.get('/api/docker-stats', async (c) => {
  const username = c.req.query('username');
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  const style = c.req.query('style') || 'gradient';

  // Repository card mode
  if (namespace && repo) {
    await trackCall('docker-stats');
    try {
      const data = await fetchDockerHub(`/repositories/${namespace}/${repo}`);
      recordRepoSnapshot(redis, namespace, repo, data).catch(() => {});
      return c.body(createRepoStatsSvgWithStyle(style, data), 200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        ...rateHeaders(c, {
          'Cache-Control': `public, max-age=${STATS_CACHE_SECONDS}`
        })
      });
    } catch (error) {
      const message = isNotFoundError(error)
        ? `Repository "${namespace}/${repo}" not found`
        : error.message;
      return c.body(createRepoStatsSvgWithStyle(style, { namespace, repo, error: message }), isNotFoundError(error) ? 404 : 500, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        ...rateHeaders(c, { 'Cache-Control': 'no-store' })
      });
    }
  }

  if (!username) {
    const svg = createDockerStatsSvgWithStyle(style, {
      username: 'missing-user',
      error: 'username parameter required (or namespace + repo)'
    });
    return c.body(svg, 400, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
      ...rateHeaders(c)
    });
  }

  await trackCall('docker-stats');

  try {
    const { stats, source } = await loadUserStats(username, {
      forceRefresh: wantsFresh(c)
    });

    return c.body(createDockerStatsSvgWithStyle(style, stats), 200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      ...rateHeaders(c, cacheHeaders(source))
    });
  } catch (error) {
    const userMessage = getUserFacingStatsError(username, error);
    const status = isNotFoundError(error) ? 404 : 500;
    return c.body(createDockerStatsSvgWithStyle(style, { username, error: userMessage }), status, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
      ...rateHeaders(c)
    });
  }
});

app.get('/api/docker-stats/styles', async (c) => {
  const styles = getAvailableStyles();
  return c.json({
    success: true,
    styles,
    default: 'gradient',
    usage: '/api/docker-stats?username=xuxuclassmate&style=gradient',
    repoUsage: '/api/docker-stats?namespace=library&repo=nginx&style=gradient',
    examples: styles.map((style) => ({
      style,
      url: `/api/docker-stats?username=xuxuclassmate&style=${style}`
    }))
  }, 200, rateHeaders(c));
});

app.get('/api/repo/details', async (c) => {
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  if (!namespace || !repo) {
    return c.json(
      new ValidationError('namespace and repo parameters required').toJSON(),
      400,
      rateHeaders(c)
    );
  }

  await trackCall('repo/details');

  try {
    const data = await fetchDockerHub(`/repositories/${namespace}/${repo}`);
    recordRepoSnapshot(redis, namespace, repo, data).catch(() => {});
    return c.json(
      { success: true, data, timestamp: new Date().toISOString() },
      200,
      rateHeaders(c, { 'Cache-Control': `public, max-age=${STATS_CACHE_SECONDS}` })
    );
  } catch (error) {
    return c.json(
      errorPayload(error),
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c)
    );
  }
});

app.get('/api/repo/tags', async (c) => {
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  const limit = parseInt(c.req.query('limit') || '100', 10);
  if (!namespace || !repo) {
    return c.json(
      new ValidationError('namespace and repo parameters required').toJSON(),
      400,
      rateHeaders(c)
    );
  }

  await trackCall('repo/tags');

  try {
    const data = await fetchDockerHub(
      `/repositories/${namespace}/${repo}/tags/?page_size=${Math.min(limit, 100)}`
    );
    return c.json(
      {
        success: true,
        namespace,
        repo,
        tags: data.results || [],
        total: data.count,
        timestamp: new Date().toISOString()
      },
      200,
      rateHeaders(c, { 'Cache-Control': `public, max-age=${STATS_CACHE_SECONDS}` })
    );
  } catch (error) {
    return c.json(
      errorPayload(error),
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c)
    );
  }
});

app.get('/api/search', async (c) => {
  const query = c.req.query('q');
  const page = parseInt(c.req.query('page') || '1', 10);
  const pageSize = parseInt(c.req.query('page_size') || '25', 10);
  if (!query) {
    return c.json(new ValidationError('q (search query) parameter required', 'q').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('search');

  try {
    const endpoint = `/search/repositories/?query=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`;
    const data = await fetchDockerHub(endpoint, null, 30000);
    return c.json(
      {
        success: true,
        query,
        page,
        pageSize,
        total: data.count || 0,
        results: data.results || [],
        timestamp: new Date().toISOString()
      },
      200,
      rateHeaders(c)
    );
  } catch (error) {
    console.error('[SEARCH] Error:', error.message);
    return c.json(
      {
        ...errorPayload(error),
        hint: 'Search API may be temporarily unavailable. Try again or use specific repository endpoints.'
      },
      500,
      rateHeaders(c)
    );
  }
});

app.get('/api/openapi.json', async (c) => {
  await trackCall('openapi');
  return c.json(generateOpenApiSpec(), 200, {
    'Content-Type': 'application/json; charset=utf-8',
    ...rateHeaders(c, { 'Cache-Control': 'public, max-age=300' })
  });
});

app.get('/api/batch/stats', async (c) => {
  const usernamesParam = c.req.query('usernames');
  if (!usernamesParam) {
    return c.json(new ValidationError('usernames parameter required', 'usernames').toJSON(), 400, rateHeaders(c));
  }

  const usernames = usernamesParam.split(',').map((username) => username.trim()).filter(Boolean);
  if (usernames.length === 0) {
    return c.json(new ValidationError('at least one username required', 'usernames').toJSON(), 400, rateHeaders(c));
  }
  if (usernames.length > 10) {
    return c.json(new ValidationError('maximum 10 usernames allowed', 'usernames').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('batch/stats');

  const results = [];
  const errors = [];
  const forceRefresh = wantsFresh(c);

  await Promise.allSettled(
    usernames.map(async (username) => {
      try {
        const { stats, source } = await loadUserStats(username, { forceRefresh });
        results.push({
          username,
          ...buildUserStatsResponse(stats, null),
          source
        });
      } catch (error) {
        errors.push({ username, error: error.message });
      }
    })
  );

  return c.json(
    {
      success: true,
      total: usernames.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    },
    200,
    rateHeaders(c)
  );
});

app.get('/api/compare', async (c) => {
  const usernamesParam = c.req.query('usernames') || c.req.query('users');
  if (!usernamesParam) {
    return c.json(new ValidationError('usernames parameter required', 'usernames').toJSON(), 400, rateHeaders(c));
  }

  const usernames = usernamesParam.split(',').map((username) => username.trim()).filter(Boolean);
  if (usernames.length < 2) {
    return c.json(new ValidationError('provide at least 2 usernames to compare', 'usernames').toJSON(), 400, rateHeaders(c));
  }
  if (usernames.length > 5) {
    return c.json(new ValidationError('maximum 5 usernames allowed for compare', 'usernames').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('compare');

  const profiles = [];
  const errors = [];

  await Promise.allSettled(
    usernames.map(async (username) => {
      try {
        const { stats, source } = await loadUserStats(username, {
          forceRefresh: wantsFresh(c)
        });
        profiles.push({
          username: stats.username,
          repositoryCount: stats.repositoryCount,
          totalPulls: stats.totalPulls,
          totalStars: stats.totalStars,
          topRepos: getTopRepositories(stats, 3),
          source,
          refreshedAt: stats.refreshedAt
        });
      } catch (error) {
        errors.push({ username, error: error.message });
      }
    })
  );

  profiles.sort((left, right) => right.totalPulls - left.totalPulls);

  return c.json(
    {
      success: true,
      winner: profiles[0]?.username || null,
      rankedBy: 'totalPulls',
      profiles,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    },
    200,
    rateHeaders(c)
  );
});

app.get('/api/embed', async (c) => {
  const username = c.req.query('username');
  if (!username) {
    return c.json(new ValidationError('username parameter required', 'username').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('embed');

  try {
    const { stats, source } = await loadUserStats(username, {
      forceRefresh: wantsFresh(c)
    });
    const payload = buildUserBadges(stats, PUBLIC_BASE_URL);
    return c.json(
      {
        success: true,
        ...payload,
        source,
        timestamp: new Date().toISOString()
      },
      200,
      rateHeaders(c, cacheHeaders(source))
    );
  } catch (error) {
    return c.json(
      errorPayload(error, getUserFacingStatsError(username, error)),
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c)
    );
  }
});

app.get('/api/popular/repos', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '25', 10)));
  const namespace = (c.req.query('namespace') || 'library').trim() || 'library';

  await trackCall('popular/repos');

  try {
    // Official/org catalogs support ordering by pull_count
    const data = await fetchDockerHub(
      `/repositories/${encodeURIComponent(namespace)}/?page=${page}&page_size=${pageSize}&ordering=-pull_count`,
      null,
      30000
    );

    return c.json(
      {
        success: true,
        namespace,
        page,
        pageSize,
        total: data.count || 0,
        results: data.results || [],
        ordering: '-pull_count',
        timestamp: new Date().toISOString()
      },
      200,
      rateHeaders(c, { 'Cache-Control': `public, max-age=${STATS_CACHE_SECONDS}` })
    );
  } catch (error) {
    console.error('[POPULAR REPOS] Error:', error.message);
    return c.json(errorPayload(error), 500, rateHeaders(c));
  }
});

app.get('/api/user/history', async (c) => {
  const username = c.req.query('username');
  const days = parseDays(c.req.query('days'), 30);
  if (!username) {
    return c.json(new ValidationError('username parameter required', 'username').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('user/history');

  try {
    // Ensure today's snapshot exists when history is requested
    await loadUserStats(username, { forceRefresh: wantsFresh(c) });
    const history = await getUserHistory(redis, username, days);
    return c.json(
      {
        success: true,
        ...history,
        timestamp: new Date().toISOString()
      },
      200,
      rateHeaders(c, { 'Cache-Control': 'public, max-age=60' })
    );
  } catch (error) {
    return c.json(
      errorPayload(error, getUserFacingStatsError(username, error)),
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c)
    );
  }
});

app.get('/api/user/growth', async (c) => {
  const username = c.req.query('username');
  const days = parseDays(c.req.query('days'), 7);
  if (!username) {
    return c.json(new ValidationError('username parameter required', 'username').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('user/growth');

  try {
    await loadUserStats(username, { forceRefresh: wantsFresh(c) });
    const history = await getUserHistory(redis, username, days);
    return c.json(
      {
        success: true,
        username: history.username,
        days: history.days,
        from: history.from,
        to: history.to,
        insufficientHistory: history.insufficientHistory,
        message: history.insufficientHistory
          ? `Need at least 2 daily snapshots in this window. Collected ${history.sampleCount} so far${history.growth.latestDate ? ` (latest: ${history.growth.latestDate})` : ''}.`
          : undefined,
        growth: history.growth,
        latest: history.points.filter((point) => point.recorded).slice(-1)[0]
          || history.points[history.points.length - 1]
          || null,
        sampleCount: history.sampleCount,
        timestamp: new Date().toISOString()
      },
      200,
      rateHeaders(c, { 'Cache-Control': 'public, max-age=60' })
    );
  } catch (error) {
    return c.json(
      errorPayload(error, getUserFacingStatsError(username, error)),
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c)
    );
  }
});

app.get('/api/repo/history', async (c) => {
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  const days = parseDays(c.req.query('days'), 30);
  if (!namespace || !repo) {
    return c.json(new ValidationError('namespace and repo parameters required').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('repo/history');

  try {
    const data = await fetchDockerHub(`/repositories/${namespace}/${repo}`);
    await recordRepoSnapshot(redis, namespace, repo, data);
    const history = await getRepoHistory(redis, namespace, repo, days);
    return c.json(
      {
        success: true,
        ...history,
        timestamp: new Date().toISOString()
      },
      200,
      rateHeaders(c, { 'Cache-Control': 'public, max-age=60' })
    );
  } catch (error) {
    return c.json(
      errorPayload(error),
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c)
    );
  }
});

app.get('/api/trend', async (c) => {
  const username = c.req.query('username');
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  const style = c.req.query('style') || 'gradient';
  const days = parseDays(c.req.query('days'), 30);

  await trackCall('trend');

  try {
    if (namespace && repo) {
      const data = await fetchDockerHub(`/repositories/${namespace}/${repo}`);
      await recordRepoSnapshot(redis, namespace, repo, data);
      const history = await getRepoHistory(redis, namespace, repo, days);
      return c.body(
        createTrendSvgWithStyle(style, {
          username: `${history.namespace}/${history.repo}`,
          ...history
        }),
        200,
        {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          ...rateHeaders(c, { 'Cache-Control': 'public, max-age=120' })
        }
      );
    }

    if (!username) {
      return c.body(
        createTrendSvgWithStyle(style, {
          username: 'missing-user',
          error: 'username parameter required (or namespace + repo)',
          points: [],
          growth: { pulls: 0 }
        }),
        400,
        {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          ...rateHeaders(c, { 'Cache-Control': 'no-store' })
        }
      );
    }

    await loadUserStats(username, { forceRefresh: wantsFresh(c) });
    const history = await getUserHistory(redis, username, days);
    return c.body(createTrendSvgWithStyle(style, history), 200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      ...rateHeaders(c, { 'Cache-Control': 'public, max-age=120' })
    });
  } catch (error) {
    const label = username || `${namespace}/${repo}`;
    return c.body(
      createTrendSvgWithStyle(style, {
        username: label,
        error: getUserFacingStatsError(label, error),
        points: [],
        growth: { pulls: 0 }
      }),
      isNotFoundError(error) ? 404 : 500,
      {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        ...rateHeaders(c, { 'Cache-Control': 'no-store' })
      }
    );
  }
});

app.get('/api/stats', async (c) => {
  const stats = await getStats();
  return c.json({
    totalCalls: stats.totalCalls,
    byEndpoint: stats.byEndpoint,
    lastUpdated: stats.lastUpdated
  }, 200, rateHeaders(c, { 'Cache-Control': 'public, max-age=15' }));
});

async function userBadgeHandler(c, type) {
  const username = c.req.query('username');
  if (!username) {
    return c.json(new ValidationError('username parameter required', 'username').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('badge');

  try {
    const { stats, source } = await loadUserStats(username, {
      forceRefresh: wantsFresh(c)
    });

    const configs = {
      pulls: { label: 'docker pulls', message: formatCompact(stats.totalPulls), color: 'blue' },
      stars: { label: 'docker stars', message: formatCompact(stats.totalStars), color: 'yellow' },
      repos: { label: 'docker repos', message: String(stats.repositoryCount), color: 'informational' }
    };

    return c.json(buildShieldsBadge(configs[type]), 200, rateHeaders(c, cacheHeaders(source)));
  } catch (error) {
    return c.json(
      buildShieldsBadge({ label: `docker ${type}`, message: 'error', color: 'red' }),
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c, { 'Cache-Control': 'no-store' })
    );
  }
}

app.get('/api/badge/pulls', (c) => userBadgeHandler(c, 'pulls'));
app.get('/api/badge/stars', (c) => userBadgeHandler(c, 'stars'));
app.get('/api/badge/repos', (c) => userBadgeHandler(c, 'repos'));

app.get('/api/badge/growth', async (c) => {
  const username = c.req.query('username');
  const days = parseDays(c.req.query('days'), 7);
  if (!username) {
    return c.json(new ValidationError('username parameter required', 'username').toJSON(), 400, rateHeaders(c));
  }

  await trackCall('badge');

  try {
    await loadUserStats(username, { forceRefresh: wantsFresh(c) });
    const history = await getUserHistory(redis, username, days);

    if (history.insufficientHistory) {
      return c.json(
        buildShieldsBadge({
          label: `pulls/${days}d`,
          message: 'collecting',
          color: 'lightgrey'
        }),
        200,
        rateHeaders(c, { 'Cache-Control': 'public, max-age=60' })
      );
    }

    const delta = history.growth.pulls;
    const message = `${delta >= 0 ? '+' : ''}${formatCompact(delta)}`;
    return c.json(
      buildShieldsBadge({
        label: `pulls/${days}d`,
        message,
        color: delta >= 0 ? 'brightgreen' : 'red'
      }),
      200,
      rateHeaders(c, { 'Cache-Control': 'public, max-age=60' })
    );
  } catch (error) {
    return c.json(
      buildShieldsBadge({ label: `pulls/${days}d`, message: 'error', color: 'red' }),
      isNotFoundError(error) ? 404 : 500,
      rateHeaders(c, { 'Cache-Control': 'no-store' })
    );
  }
});

app.get('/api/badge/total-calls', async (c) => {
  const stats = await getStats();
  return c.json(
    buildShieldsBadge({
      label: 'total calls',
      message: String(stats.totalCalls),
      color: 'blue'
    }),
    200,
    rateHeaders(c, { 'Cache-Control': 'public, max-age=30' })
  );
});

app.get('/api/internal/snapshot-history', async (c) => {
  const cronHeader = c.req.header('x-vercel-cron');
  const authHeader = c.req.header('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const authorized = Boolean(cronHeader)
    || (cronSecret && authHeader === `Bearer ${cronSecret}`)
    || c.req.query('secret') === cronSecret;

  if (!authorized) {
    return c.json({ success: false, error: 'Unauthorized', code: 'AUTHENTICATION_ERROR' }, 401, rateHeaders(c));
  }

  await trackCall('internal/snapshot-history');

  const usernames = await listTrackedUsers(redis);
  const refreshed = [];
  const failed = [];

  for (const username of usernames.slice(0, 50)) {
    try {
      await loadUserStats(username, { forceRefresh: true });
      refreshed.push(username);
    } catch (error) {
      failed.push({ username, error: error.message });
    }
  }

  return c.json(
    {
      success: true,
      tracked: usernames.length,
      refreshed: refreshed.length,
      failed: failed.length,
      users: refreshed,
      errors: failed.length > 0 ? failed : undefined,
      timestamp: new Date().toISOString()
    },
    200,
    rateHeaders(c)
  );
});

app.get('/api/health', async (c) => {
  return c.json(
    {
      status: 'ok',
      redis: redis ? 'connected' : 'not-configured',
      rateLimit: 'enforced',
      cacheTtlSeconds: STATS_CACHE_SECONDS,
      history: redis ? 'redis' : 'memory',
      timestamp: new Date().toISOString()
    },
    200,
    rateHeaders(c)
  );
});

app.get('/', (c) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  return c.html(indexHtml);
});

app.get('/favicon.ico', (c) => {
  try {
    const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
    const favicon = fs.readFileSync(faviconPath);
    return c.body(favicon, 200, {
      'Content-Type': 'image/x-icon'
    });
  } catch {
    return c.notFound();
  }
});

app.get('/*', (c) => {
  const reqPath = c.req.path;
  const filePath = path.join(__dirname, 'public', reqPath);

  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return c.notFound();
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    return c.body(fs.readFileSync(filePath), 200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream'
    });
  } catch (error) {
    console.error('Static file error:', error.message);
    return c.notFound();
  }
});

module.exports = app;
