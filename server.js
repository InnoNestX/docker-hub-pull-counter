const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');
const { getRateLimitHeaders } = require('./lib/rate-limiter');
const { fetchDockerHub, createDockerClient } = require('./lib/docker-client');
const { buildUserStatsResponse, getUserStats } = require('./lib/user-stats');
const {
  createDockerStatsSvgWithStyle,
  getAvailableStyles,
  getUserFacingStatsError
} = require('./lib/svg-utils');
const { generateOpenApiSpec } = require('./lib/openapi');

const app = new Hono();
const dockerClient = createDockerClient();

app.use('/api/*', cors());

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
  openapi: 0,
  health: 0
};

async function trackCall(endpoint) {
  if (!redis) return;

  try {
    await redis.incr('stats:totalCalls');
    await redis.incr(`stats:endpoint:${endpoint}`);
    await redis.set('stats:lastUpdated', new Date().toISOString());
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
    const [
      totalCalls,
      userStats,
      dockerStats,
      repoDetails,
      repoTags,
      search,
      batchStats,
      popularRepos,
      openapi,
      health,
      lastUpdated
    ] = await Promise.all([
      redis.get('stats:totalCalls') || 0,
      redis.get('stats:endpoint:user/stats') || 0,
      redis.get('stats:endpoint:docker-stats') || 0,
      redis.get('stats:endpoint:repo/details') || 0,
      redis.get('stats:endpoint:repo/tags') || 0,
      redis.get('stats:endpoint:search') || 0,
      redis.get('stats:endpoint:batch/stats') || 0,
      redis.get('stats:endpoint:popular/repos') || 0,
      redis.get('stats:endpoint:openapi') || 0,
      redis.get('stats:endpoint:health') || 0,
      redis.get('stats:lastUpdated') || new Date().toISOString()
    ]);

    return {
      totalCalls: Number(totalCalls),
      byEndpoint: {
        'user/stats': Number(userStats),
        'docker-stats': Number(dockerStats),
        'repo/details': Number(repoDetails),
        'repo/tags': Number(repoTags),
        search: Number(search),
        'batch/stats': Number(batchStats),
        'popular/repos': Number(popularRepos),
        openapi: Number(openapi),
        health: Number(health)
      },
      lastUpdated
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
  return error.message === 'Resource not found';
}

app.get('/api/user/stats', async (c) => {
  const username = c.req.query('username');
  const fieldsParam = c.req.query('fields');
  if (!username) return c.json({ error: 'username parameter required' }, 400);

  await trackCall('user/stats');

  try {
    c.header('Cache-Control', 'no-store, max-age=0');

    const { stats, source } = await getUserStats(username, { dockerClient });
    return c.json(
      { ...buildUserStatsResponse(stats, fieldsParam), source },
      200,
      getRateLimitHeaders(c)
    );
  } catch (error) {
    console.error('[USER STATS] Error:', error.message);
    return c.json(
      {
        success: false,
        error: getUserFacingStatsError(username, error),
        originalError: error.message
      },
      isNotFoundError(error) ? 404 : 500,
      getRateLimitHeaders(c)
    );
  }
});

app.get('/api/docker-stats', async (c) => {
  const username = c.req.query('username');
  const style = c.req.query('style') || 'gradient';

  if (!username) {
    const svg = createDockerStatsSvgWithStyle(style, {
      username: 'missing-user',
      error: 'username parameter required'
    });

    return c.body(svg, 400, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store'
    });
  }

  await trackCall('docker-stats');

  try {
    const { stats } = await getUserStats(username, { dockerClient });

    return c.body(createDockerStatsSvgWithStyle(style, stats), 200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      ...getRateLimitHeaders(c)
    });
  } catch (error) {
    const userMessage = getUserFacingStatsError(username, error);
    const status = isNotFoundError(error) ? 404 : 500;

    return c.body(createDockerStatsSvgWithStyle(style, { username, error: userMessage }), status, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
      ...getRateLimitHeaders(c)
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
    examples: styles.map((style) => ({
      style,
      url: `/api/docker-stats?username=xuxuclassmate&style=${style}`
    }))
  }, 200, getRateLimitHeaders(c));
});

app.get('/api/repo/details', async (c) => {
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  if (!namespace || !repo) return c.json({ error: 'namespace and repo parameters required' }, 400);

  await trackCall('repo/details');

  try {
    const data = await fetchDockerHub(`/repositories/${namespace}/${repo}`);
    return c.json(
      { success: true, data, timestamp: new Date().toISOString() },
      200,
      getRateLimitHeaders(c)
    );
  } catch (error) {
    return c.json(
      { success: false, error: error.message },
      isNotFoundError(error) ? 404 : 500,
      getRateLimitHeaders(c)
    );
  }
});

app.get('/api/repo/tags', async (c) => {
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  const limit = parseInt(c.req.query('limit') || '100', 10);
  if (!namespace || !repo) return c.json({ error: 'namespace and repo parameters required' }, 400);

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
      getRateLimitHeaders(c)
    );
  } catch (error) {
    return c.json(
      { success: false, error: error.message },
      isNotFoundError(error) ? 404 : 500,
      getRateLimitHeaders(c)
    );
  }
});

app.get('/api/search', async (c) => {
  const query = c.req.query('q');
  const page = parseInt(c.req.query('page') || '1', 10);
  const pageSize = parseInt(c.req.query('page_size') || '25', 10);
  if (!query) return c.json({ error: 'q (search query) parameter required' }, 400);

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
      getRateLimitHeaders(c)
    );
  } catch (error) {
    console.error('[SEARCH] Error:', error.message);
    return c.json(
      {
        success: false,
        error: error.message,
        hint: 'Search API may be temporarily unavailable. Try again or use specific repository endpoints.'
      },
      500,
      getRateLimitHeaders(c)
    );
  }
});

app.get('/api/openapi.json', async (c) => {
  await trackCall('openapi');
  return c.json(generateOpenApiSpec(), 200, {
    'Content-Type': 'application/json; charset=utf-8',
    ...getRateLimitHeaders(c)
  });
});

app.get('/api/batch/stats', async (c) => {
  const usernamesParam = c.req.query('usernames');
  if (!usernamesParam) return c.json({ error: 'usernames parameter required' }, 400);

  const usernames = usernamesParam.split(',').map((username) => username.trim()).filter(Boolean);
  if (usernames.length === 0) return c.json({ error: 'at least one username required' }, 400);
  if (usernames.length > 10) return c.json({ error: 'maximum 10 usernames allowed' }, 400);

  await trackCall('batch/stats');

  const results = [];
  const errors = [];

  await Promise.allSettled(
    usernames.map(async (username) => {
      try {
        const { stats, source } = await getUserStats(username, { dockerClient });
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
    getRateLimitHeaders(c)
  );
});

app.get('/api/popular/repos', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '25', 10)));

  await trackCall('popular/repos');

  try {
    const data = await fetchDockerHub(
      `/search/repositories/?query=library&page=${page}&page_size=${pageSize}`,
      null,
      30000
    );

    return c.json(
      {
        success: true,
        page,
        pageSize,
        total: data.count || 0,
        results: data.results || [],
        timestamp: new Date().toISOString()
      },
      200,
      getRateLimitHeaders(c)
    );
  } catch (error) {
    console.error('[POPULAR REPOS] Error:', error.message);
    return c.json({ success: false, error: error.message }, 500, getRateLimitHeaders(c));
  }
});

app.get('/api/stats', async (c) => {
  const stats = await getStats();
  return c.json({
    totalCalls: stats.totalCalls,
    byEndpoint: stats.byEndpoint,
    lastUpdated: stats.lastUpdated
  });
});

app.get('/api/badge/total-calls', async (c) => {
  const stats = await getStats();
  return c.json({
    schemaVersion: 1,
    label: 'total calls',
    message: String(stats.totalCalls),
    color: 'blue'
  });
});

app.get('/api/health', async (c) => {
  await trackCall('health');
  return c.json(
    {
      status: 'ok',
      redis: redis ? 'connected' : 'not-configured',
      timestamp: new Date().toISOString()
    },
    200,
    getRateLimitHeaders(c)
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
