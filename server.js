const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { serveStatic } = require('hono/serve-static');
const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');
const cache = require('./lib/cache');
const {
  DEFAULT_CACHE_TTL,
  buildUserStatsResponse,
  getUserStats,
  refreshKnownUserStats
} = require('./lib/user-stats');

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
        'internal/refresh-stats': 0,
        'health': 0
      },
      lastUpdated: new Date().toISOString(),
      warning: 'Redis not configured'
    };
  }
  
  try {
    const [totalCalls, userStats, dockerStats, repoDetails, repoTags, search, refreshStats, health, lastUpdated] = await Promise.all([
      redis.get('stats:totalCalls') || 0,
      redis.get('stats:endpoint:user/stats') || 0,
      redis.get('stats:endpoint:docker-stats') || 0,
      redis.get('stats:endpoint:repo/details') || 0,
      redis.get('stats:endpoint:repo/tags') || 0,
      redis.get('stats:endpoint:search') || 0,
      redis.get('stats:endpoint:internal/refresh-stats') || 0,
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
        'internal/refresh-stats': Number(refreshStats),
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
        'internal/refresh-stats': 0,
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

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function createDockerStatsSvg({ username, repositoryCount = 0, totalPulls = 0, totalStars = 0, error = null }) {
  const safeUsername = escapeXml(username || 'unknown');
  const safeError = error ? escapeXml(error) : '';
  const description = error
    ? `Unable to load Docker Hub stats for ${safeUsername}: ${safeError}`
    : `Docker Hub stats for ${safeUsername}. Total pulls ${formatNumber(totalPulls)}, repository count ${formatNumber(repositoryCount)}, total stars ${formatNumber(totalStars)}.`;

  const rows = error
    ? `
      <rect x="24" y="76" width="372" height="78" rx="14" fill="rgba(255,255,255,0.05)" />
      <text x="40" y="108" fill="#fca5a5" font-size="14" font-weight="600">Unable to load stats</text>
      <text x="40" y="132" fill="#d1d5db" font-size="13">${safeError}</text>
    `
    : `
      <g transform="translate(24 76)">
        <rect width="112" height="78" rx="14" fill="rgba(255,255,255,0.05)" />
        <text x="16" y="28" fill="#93c5fd" font-size="12">Total Pulls</text>
        <text x="16" y="56" fill="#ffffff" font-size="22" font-weight="700">${formatNumber(totalPulls)}</text>
      </g>
      <g transform="translate(154 76)">
        <rect width="112" height="78" rx="14" fill="rgba(255,255,255,0.05)" />
        <text x="16" y="28" fill="#93c5fd" font-size="12">Repositories</text>
        <text x="16" y="56" fill="#ffffff" font-size="22" font-weight="700">${formatNumber(repositoryCount)}</text>
      </g>
      <g transform="translate(284 76)">
        <rect width="112" height="78" rx="14" fill="rgba(255,255,255,0.05)" />
        <text x="16" y="28" fill="#93c5fd" font-size="12">Total Stars</text>
        <text x="16" y="56" fill="#ffffff" font-size="22" font-weight="700">${formatNumber(totalStars)}</text>
      </g>
    `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="420" height="180" viewBox="0 0 420 180" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Docker Hub Stats</title>
  <desc id="desc">${description}</desc>
  <defs>
    <linearGradient id="bg" x1="16" y1="10" x2="404" y2="170" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0F172A" />
      <stop offset="1" stop-color="#1D4ED8" />
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="404" height="164" rx="20" fill="url(#bg)" />
  <rect x="8.5" y="8.5" width="403" height="163" rx="19.5" stroke="rgba(255,255,255,0.14)" />
  <text x="24" y="38" fill="#ffffff" font-size="20" font-weight="700">Docker Hub Stats</text>
  <text x="24" y="60" fill="#cbd5e1" font-size="13">@${safeUsername}</text>
  ${rows}
</svg>`;
}

function getUserFacingStatsError(username, error) {
  if (error.message === 'Resource not found') {
    return `User "${username}" not found on Docker Hub. Please check the username.`;
  }

  if (error.message === 'Docker Hub API timeout') {
    return 'Docker Hub API timeout. Please try again later.';
  }

  if (error.message === 'Docker Hub API connection failed') {
    return 'Docker Hub API connection failed. Please try again later.';
  }

  return error.message;
}

function isAuthorizedInternalRequest(c) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }

  return c.req.header('authorization') === `Bearer ${secret}`;
}

// ==================== API ROUTES (必须先定义 API 路由) ====================

// API: User Stats
app.get('/api/user/stats', async (c) => {
  const username = c.req.query('username');
  const fieldsParam = c.req.query('fields');
  if (!username) return c.json({ error: 'username parameter required' }, 400);
  
  await trackCall('user/stats');
  
  try {
    const { stats, source } = await getUserStats(username, {
      redis,
      ttl: DEFAULT_CACHE_TTL,
      dockerClient: {
        fetchDockerHub,
        getAuthToken
      }
    });

    console.log('[USER STATS] Success:', stats.repositoryCount, 'repos,', stats.totalPulls, 'pulls via', source);
    return c.json(buildUserStatsResponse(stats, fieldsParam));
  } catch (error) {
    console.error('[USER STATS] Error:', error.message);
    const userMessage = getUserFacingStatsError(username, error);
    return c.json({ success: false, error: userMessage, originalError: error.message }, 500);
  }
});

// API: Docker Stats SVG Card
app.get('/api/docker-stats', async (c) => {
  const username = c.req.query('username');

  if (!username) {
    const svg = createDockerStatsSvg({
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
      redis,
      ttl: DEFAULT_CACHE_TTL,
      dockerClient: {
        fetchDockerHub,
        getAuthToken
      }
    });

    return c.body(createDockerStatsSvg(stats), 200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
    });
  } catch (error) {
    const userMessage = getUserFacingStatsError(username, error);
    const status = error.message === 'Resource not found' ? 404 : 500;

    return c.body(createDockerStatsSvg({ username, error: userMessage }), status, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store'
    });
  }
});

// API: Repository Details
app.get('/api/repo/details', async (c) => {
  const namespace = c.req.query('namespace');
  const repo = c.req.query('repo');
  if (!namespace || !repo) return c.json({ error: 'namespace and repo parameters required' }, 400);
  
  await trackCall('repo/details');
  
  try {
    const data = await fetchDockerHub(`/repositories/${namespace}/${repo}`);
    return c.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
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
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
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
    });
  } catch (error) {
    console.error('[SEARCH] Error:', error.message, error.stack);
    return c.json({ 
      success: false, 
      error: error.message,
      hint: 'Search API may be temporarily unavailable. Try again or use specific repository endpoints.'
    }, 500);
  }
});

// API: Stats (public) - don't track this call to avoid inflating stats
app.get('/api/stats', async (c) => {
  return c.json(await getStats());
});

// API: Background refresh for known usernames
app.get('/api/internal/refresh-stats', async (c) => {
  if (!isAuthorizedInternalRequest(c)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  await trackCall('internal/refresh-stats');

  try {
    const result = await refreshKnownUserStats({
      redis,
      ttl: DEFAULT_CACHE_TTL,
      dockerClient: {
        fetchDockerHub,
        getAuthToken
      }
    });

    return c.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// API: Health Check
app.get('/api/health', async (c) => {
  await trackCall('health');
  const redisStatus = redis ? 'connected' : 'not-configured';
  return c.json({ 
    status: 'ok', 
    redis: redisStatus,
    timestamp: new Date().toISOString() 
  });
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
