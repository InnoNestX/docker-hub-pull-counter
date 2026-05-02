const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { serveStatic } = require('hono/serve-static');
const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');
const cache = require('./lib/cache');
const {
  buildUserStatsResponse,
  getUserStats
} = require('./lib/user-stats');
const { createDockerStatsSvgWithStyle, getAvailableStyles } = require('./lib/svg-utils');

// Rate limit configuration
const RATE_LIMIT = {
  WINDOW_MS: 60 * 60 * 1000, // 1 hour window
  MAX_REQUESTS: 100, // 100 requests per window for unauthenticated
  MAX_REQUESTS_AUTH: 200 // 200 requests per window for authenticated
};

// In-memory rate limit tracking
const rateLimitStore = new Map();

function getRateLimitHeaders(c, isAuthenticated = false) {
  const clientIp = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown';
  const key = `${clientIp}:${Math.floor(Date.now() / RATE_LIMIT.WINDOW_MS)}`;
  const maxRequests = isAuthenticated ? RATE_LIMIT.MAX_REQUESTS_AUTH : RATE_LIMIT.MAX_REQUESTS;
  
  let record = rateLimitStore.get(key);
  const now = Date.now();
  
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: Math.floor(now / RATE_LIMIT.WINDOW_MS) * RATE_LIMIT.WINDOW_MS + RATE_LIMIT.WINDOW_MS };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  
  // Cleanup old entries periodically
  if (rateLimitStore.size > 10000) {
    const cutoff = now - RATE_LIMIT.WINDOW_MS * 2;
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < cutoff) rateLimitStore.delete(k);
    }
  }
  
  const remaining = Math.max(0, maxRequests - record.count);
  const resetTime = Math.ceil(record.resetTime / 1000);
  
  return {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetTime)
  };
}

const app = new Hono();

// CORS for API routes
app.use('/api/*', cors());

const DOCKER_HUB_API = 'https://hub.docker.com/v2';
const AUTH_TOKEN_CACHE_KEY = 'docker:auth-token';

// Initialize Upstash Redis
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

console.log('Redis initialized:', !!redis);
if (redis) {
  console.log('Redis URL:', process.env.UPSTASH_REDIS_REST_URL?.substring(0, 20) + '...');
} else {
  console.log('Redis not configured - check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars');
}

// Track API call with Redis persistence
async function trackCall(endpoint) {
  if (redis) {
    try {
      await redis.incr('stats:totalCalls');
      await redis.incr(`stats:endpoint:${endpoint}`);
      await redis.set('stats:lastUpdated', new Date().toISOString());
      console.log(`Tracked call: ${endpoint}`);
    } catch (error) {
      console.error('Track call error:', error);
    }
  }
}

// Get stats from Redis
async function getStats() {
  if (!redis) {
    return {
      totalCalls: 0,
      byEndpoint: {
        'user/stats': 0,
        'docker-stats': 0,
        'repo/details': 0,
        'repo/tags': 0,
        'search': 0,
        'batch/stats': 0,
        'popular/repos': 0,
        'openapi': 0,
        'health': 0
      },
      lastUpdated: new Date().toISOString(),
      warning: 'Redis not configured'
    };
  }
  
  try {
    const [totalCalls, userStats, dockerStats, repoDetails, repoTags, search, batchStats, popularRepos, openapi, health, lastUpdated] = await Promise.all([
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
        'search': Number(search),
        'batch/stats': Number(batchStats),
        'popular/repos': Number(popularRepos),
        'openapi': Number(openapi),
        'health': Number(health)
      },
      lastUpdated
    };
  } catch (error) {
    console.error('Redis error:', error);
    return {
      totalCalls: 0,
      byEndpoint: {
        'user/stats': 0,
        'docker-stats': 0,
        'repo/details': 0,
        'repo/tags': 0,
        'search': 0,
        'batch/stats': 0,
        'popular/repos': 0,
        'openapi': 0,
        'health': 0
      },
      lastUpdated: new Date().toISOString(),
      error: 'Failed to fetch stats'
    };
  }
}

async function fetchDockerHub(endpoint, authToken = null, timeout = 30000) {
  const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://hub.docker.com/'
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  try {
    const response = await fetch(`${DOCKER_HUB_API}${endpoint}`, { 
      headers, 
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow'
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error('Resource not found');
      if (response.status === 429) throw new Error('Docker Hub rate limit exceeded');
      throw new Error(`Docker Hub API error: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    if (error.name === 'TimeoutError' || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      throw new Error('Docker Hub API timeout');
    }
    if (error.cause?.code === 'ECONNRESET' || error.message === 'fetch failed') {
      throw new Error('Docker Hub API connection failed');
    }
    throw error;
  }
}

async function getAuthToken() {
  const username = process.env.DOCKER_USERNAME;
  const password = process.env.DOCKER_PASSWORD;
  if (!username || !password) return null;

  const cachedToken = cache.get(AUTH_TOKEN_CACHE_KEY);
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const response = await fetch(`${DOCKER_HUB_API}/users/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (response.ok) {
      const data = await response.json();
      cache.set(AUTH_TOKEN_CACHE_KEY, data.token, 10 * 60 * 1000);
      return data.token;
    }
  } catch (e) { console.error('Auth failed:', e); }
  return null;
}

// These functions are now in lib/svg-utils.js

// ==================== API ROUTES (必须先定义 API 路由) ====================

// API: User Stats
app.get('/api/user/stats', async (c) => {
  const username = c.req.query('username');
  const fieldsParam = c.req.query('fields');
  if (!username) return c.json({ error: 'username parameter required' }, 400);
  
  await trackCall('user/stats');
  
  try {
    c.header('Cache-Control', 'no-store, max-age=0');

    const { stats, source } = await getUserStats(username, {
      dockerClient: {
        fetchDockerHub,
        getAuthToken
      }
    });

    console.log('[USER STATS] Success:', stats.repositoryCount, 'repos,', stats.totalPulls, 'pulls via', source);
    return c.json(buildUserStatsResponse(stats, fieldsParam), 200, getRateLimitHeaders(c));
  } catch (error) {
    console.error('[USER STATS] Error:', error.message);
    const userMessage = getUserFacingStatsError(username, error);
    return c.json({ success: false, error: userMessage, originalError: error.message }, 500, getRateLimitHeaders(c));
  }
});

// API: Docker Stats SVG Card
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
    const { stats } = await getUserStats(username, {
      dockerClient: {
        fetchDockerHub,
        getAuthToken
      }
    });

    return c.body(createDockerStatsSvgWithStyle(style, stats), 200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      ...getRateLimitHeaders(c)
    });
  } catch (error) {
    const userMessage = getUserFacingStatsError(username, error);
    const status = error.message === 'Resource not found' ? 404 : 500;

    return c.body(createDockerStatsSvgWithStyle(style, { username, error: userMessage }), status, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
      ...getRateLimitHeaders(c)
    });
  }
});

// API: List available card styles
app.get('/api/docker-stats/styles', async (c) => {
  const styles = getAvailableStyles();
  return c.json({
    success: true,
    styles,
    default: 'gradient',
    usage: '/api/docker-stats?username=xuxuclassmate&style=gradient',
    examples: styles.map(s => ({
      style: s,
      url: `/api/docker-stats?username=xuxuclassmate&style=${s}`
    }))
  });
});

// API: Repository Details
app.get('/api/repo/details', async (c) => {
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  if (!namespace || !repo) return c.json({ error: 'namespace and repo parameters required' }, 400);
  
  await trackCall('repo/details');
  
  try {
    const data = await fetchDockerHub(`/repositories/${namespace}/${repo}`);
    return c.json({ success: true, data, timestamp: new Date().toISOString() }, 200, getRateLimitHeaders(c));
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500, getRateLimitHeaders(c));
  }
});

// API: Repository Tags
app.get('/api/repo/tags', async (c) => {
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  const limit = parseInt(c.req.query('limit') || '100');
  if (!namespace || !repo) return c.json({ error: 'namespace and repo parameters required' }, 400);
  
  await trackCall('repo/tags');
  
  try {
    const data = await fetchDockerHub(`/repositories/${namespace}/${repo}/tags/?page_size=${Math.min(limit, 100)}`);
    return c.json({ 
      success: true, namespace, repo, 
      tags: data.results || [],
      total: data.count,
      timestamp: new Date().toISOString() 
    }, 200, getRateLimitHeaders(c));
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500, getRateLimitHeaders(c));
  }
});

// API: Search
app.get('/api/search', async (c) => {
  const query = c.req.query('q');
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('page_size') || '25');
  if (!query) return c.json({ error: 'q (search query) parameter required' }, 400);
  
  await trackCall('search');
  
  try {
    console.log('[SEARCH] Starting search for:', query, 'page:', page, 'pageSize:', pageSize);
    // Use Docker Hub public search endpoint with correct parameter name: query (not q)
    const endpoint = `/search/repositories/?query=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`;
    console.log('[SEARCH] Calling endpoint:', endpoint);
    const data = await fetchDockerHub(endpoint, null, 30000);
    console.log('[SEARCH] Got response:', JSON.stringify({ count: data.count, results: data.results?.length || 0 }));
    return c.json({
      success: true, query, page, pageSize,
      total: data.count || 0,
      results: data.results || [],
      timestamp: new Date().toISOString()
    }, 200, getRateLimitHeaders(c));
  } catch (error) {
    console.error('[SEARCH] Error:', error.message, error.stack);
    return c.json({ 
      success: false, 
      error: error.message,
      hint: 'Search API may be temporarily unavailable. Try again or use specific repository endpoints.'
    }, 500, getRateLimitHeaders(c));
  }
});

// OpenAPI Specification Generator
function generateOpenApiSpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Docker Hub Pull Counter API',
      description: 'API for retrieving Docker Hub user statistics, repository details, and search functionality',
      version: '1.0.0',
      contact: {
        name: 'XuXuClassMate',
        url: 'https://github.com/InnoNestX/docker-hub-pull-counter'
      }
    },
    servers: [
      { url: 'https://docker-hub-pull-counter.vercel.app', description: 'Production' },
      { url: 'http://localhost:3000', description: 'Local Development' }
    ],
    paths: {
      '/api/user/stats': {
        get: {
          summary: 'Get user statistics',
          description: 'Retrieve total pull counts and repository statistics for a Docker Hub user',
          parameters: [
            { name: 'username', in: 'query', required: true, schema: { type: 'string' }, description: 'Docker Hub username' },
            { name: 'fields', in: 'query', required: false, schema: { type: 'string' }, description: 'Comma-separated list of fields to include (name,namespace,pullCount,starCount,lastUpdated)' }
          ],
          responses: {
            '200': { description: 'Successful response', content: { 'application/json': { schema: { '$ref': '#/components/schemas/UserStats' } } } },
            '400': { description: 'Missing required parameter' },
            '500': { description: 'Server error' }
          }
        }
      },
      '/api/docker-stats': {
        get: {
          summary: 'Get Docker stats as SVG',
          description: 'Returns an SVG card displaying Docker Hub stats for a user',
          parameters: [
            { name: 'username', in: 'query', required: true, schema: { type: 'string' }, description: 'Docker Hub username' }
          ],
          responses: {
            '200': { description: 'SVG image', content: { 'image/svg+xml': { schema: { type: 'string' } } } },
            '400': { description: 'Missing required parameter' },
            '404': { description: 'User not found' },
            '500': { description: 'Server error' }
          }
        }
      },
      '/api/repo/details': {
        get: {
          summary: 'Get repository details',
          description: 'Retrieve detailed information about a specific repository',
          parameters: [
            { name: 'namespace', in: 'query', required: true, schema: { type: 'string' }, description: 'Docker Hub namespace' },
            { name: 'repo', in: 'query', required: true, schema: { type: 'string' }, description: 'Repository name' }
          ],
          responses: {
            '200': { description: 'Successful response' },
            '400': { description: 'Missing required parameters' },
            '500': { description: 'Server error' }
          }
        }
      },
      '/api/repo/tags': {
        get: {
          summary: 'List repository tags',
          description: 'List all image tags for a repository',
          parameters: [
            { name: 'namespace', in: 'query', required: true, schema: { type: 'string' }, description: 'Docker Hub namespace' },
            { name: 'repo', in: 'query', required: true, schema: { type: 'string' }, description: 'Repository name' },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 100 }, description: 'Maximum number of tags to return' }
          ],
          responses: {
            '200': { description: 'Successful response' },
            '400': { description: 'Missing required parameters' },
            '500': { description: 'Server error' }
          }
        }
      },
      '/api/search': {
        get: {
          summary: 'Search repositories',
          description: 'Search Docker Hub repositories',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 }, description: 'Page number' },
            { name: 'page_size', in: 'query', required: false, schema: { type: 'integer', default: 25 }, description: 'Results per page' }
          ],
          responses: {
            '200': { description: 'Successful response' },
            '400': { description: 'Missing required parameter' },
            '500': { description: 'Server error' }
          }
        }
      },
      '/api/batch/stats': {
        get: {
          summary: 'Batch user statistics',
          description: 'Retrieve statistics for multiple Docker Hub users in a single request',
          parameters: [
            { name: 'usernames', in: 'query', required: true, schema: { type: 'string' }, description: 'Comma-separated list of usernames (max 10)' }
          ],
          responses: {
            '200': { description: 'Successful response' },
            '400': { description: 'Missing required parameter or too many usernames' },
            '500': { description: 'Server error' }
          }
        }
      },
      '/api/popular/repos': {
        get: {
          summary: 'Get popular repositories',
          description: 'Retrieve popular Docker Hub repositories',
          parameters: [
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 }, description: 'Page number' },
            { name: 'page_size', in: 'query', required: false, schema: { type: 'integer', default: 25 }, description: 'Results per page (max 100)' }
          ],
          responses: {
            '200': { description: 'Successful response' },
            '500': { description: 'Server error' }
          }
        }
      },
      '/api/stats': {
        get: {
          summary: 'Get API statistics',
          description: 'Retrieve usage statistics for this API',
          responses: {
            '200': { description: 'Successful response' }
          }
        }
      },
      '/api/health': {
        get: {
          summary: 'Health check',
          description: 'Check the health status of the API',
          responses: {
            '200': { description: 'Service is healthy' }
          }
        }
      }
    },
    components: {
      schemas: {
        UserStats: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            username: { type: 'string' },
            repositoryCount: { type: 'integer' },
            totalPulls: { type: 'integer' },
            totalStars: { type: 'integer' },
            repositories: { type: 'array', items: { '$ref': '#/components/schemas/Repository' } },
            timestamp: { type: 'string', format: 'date-time' },
            refreshedAt: { type: 'string', format: 'date-time' }
          }
        },
        Repository: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            namespace: { type: 'string' },
            pull_count: { type: 'integer' },
            star_count: { type: 'integer' },
            last_updated: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  };
}

// API: OpenAPI Spec
app.get('/api/openapi.json', async (c) => {
  await trackCall('openapi');
  return c.json(generateOpenApiSpec(), 200, {
    'Content-Type': 'application/json; charset=utf-8',
    ...getRateLimitHeaders(c)
  });
});

// API: Batch User Stats
app.get('/api/batch/stats', async (c) => {
  const usernamesParam = c.req.query('usernames');
  if (!usernamesParam) return c.json({ error: 'usernames parameter required' }, 400);
  
  const usernames = usernamesParam.split(',').map(u => u.trim()).filter(Boolean);
  if (usernames.length === 0) return c.json({ error: 'at least one username required' }, 400);
  if (usernames.length > 10) return c.json({ error: 'maximum 10 usernames allowed' }, 400);
  
  await trackCall('batch/stats');
  
  const results = [];
  const errors = [];
  
  await Promise.allSettled(
    usernames.map(async (username) => {
      try {
        const { stats, source } = await getUserStats(username, {
          dockerClient: { fetchDockerHub, getAuthToken }
        });
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
  
  return c.json({
    success: true,
    total: usernames.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString()
  }, 200, getRateLimitHeaders(c));
});

// API: Popular Repositories
app.get('/api/popular/repos', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '25')));
  
  await trackCall('popular/repos');
  
  try {
    // Docker Hub doesn't have a direct "popular" endpoint, so we search for 
    // popular repositories by using the star_count sort via search
    const data = await fetchDockerHub(
      `/search/repositories/?query=orderby=stars&page=${page}&page_size=${pageSize}`,
      null,
      30000
    );
    
    return c.json({
      success: true,
      page,
      pageSize,
      total: data.count || 0,
      results: data.results || [],
      timestamp: new Date().toISOString()
    }, 200, getRateLimitHeaders(c));
  } catch (error) {
    console.error('[POPULAR REPOS] Error:', error.message);
    return c.json({
      success: false,
      error: error.message
    }, 500, getRateLimitHeaders(c));
  }
});

// API: Stats (public) - don't track this call to avoid inflating stats
app.get('/api/stats', async (c) => {
  const stats = await getStats();
  return c.json({
    totalCalls: stats.totalCalls,
    byEndpoint: stats.byEndpoint,
    lastUpdated: stats.lastUpdated
  });
});

// API: Badge endpoint (shields.io-compatible) - returns ONLY shields.io fields
app.get('/api/badge/total-calls', async (c) => {
  const stats = await getStats();
  return c.json({
    schemaVersion: 1,
    label: "total calls",
    message: String(stats.totalCalls),
    color: "blue"
  });
});

// API: Health Check
app.get('/api/health', async (c) => {
  await trackCall('health');
  const redisStatus = redis ? 'connected' : 'not-configured';
  return c.json({ 
    status: 'ok', 
    redis: redisStatus,
    timestamp: new Date().toISOString() 
  }, 200, getRateLimitHeaders(c));
});

// ==================== 静态文件服务 (必须放在最后) ====================

// Serve index.html for root
app.get('/', (c) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  return c.html(indexHtml);
});

// Serve static files from public folder
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
    if (!fs.existsSync(filePath)) {
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
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    const fileContent = fs.readFileSync(filePath);
    
    return c.body(fileContent, 200, {
      'Content-Type': mimeType
    });
  } catch (error) {
    console.error('Static file error:', error);
    return c.notFound();
  }
});

module.exports = app;
