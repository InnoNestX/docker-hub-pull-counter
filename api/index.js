const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { serveStatic } = require('hono/serve-static');
const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');

const app = new Hono();

// CORS for API routes
app.use('/api/*', cors());

const DOCKER_HUB_API = 'https://hub.docker.com/v2';

// Initialize Upstash Redis
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Track API call with Redis persistence
async function trackCall(endpoint) {
  if (redis) {
    await redis.incr('stats:totalCalls');
    await redis.incr(`stats:endpoint:${endpoint}`);
    await redis.set('stats:lastUpdated', new Date().toISOString());
  }
}

// Get stats from Redis
async function getStats() {
  if (!redis) {
    return {
      totalCalls: 0,
      byEndpoint: { 'user/stats': 0, 'repo/details': 0, 'repo/tags': 0, 'search': 0, 'health': 0 },
      lastUpdated: new Date().toISOString(),
      warning: 'Redis not configured'
    };
  }
  
  try {
    const [totalCalls, userStats, repoDetails, repoTags, search, health, lastUpdated] = await Promise.all([
      redis.get('stats:totalCalls') || 0,
      redis.get('stats:endpoint:user/stats') || 0,
      redis.get('stats:endpoint:repo/details') || 0,
      redis.get('stats:endpoint:repo/tags') || 0,
      redis.get('stats:endpoint:search') || 0,
      redis.get('stats:endpoint:health') || 0,
      redis.get('stats:lastUpdated') || new Date().toISOString()
    ]);
    
    return {
      totalCalls: Number(totalCalls),
      byEndpoint: {
        'user/stats': Number(userStats),
        'repo/details': Number(repoDetails),
        'repo/tags': Number(repoTags),
        'search': Number(search),
        'health': Number(health)
      },
      lastUpdated
    };
  } catch (error) {
    console.error('Redis error:', error);
    return {
      totalCalls: 0,
      byEndpoint: { 'user/stats': 0, 'repo/details': 0, 'repo/tags': 0, 'search': 0, 'health': 0 },
      lastUpdated: new Date().toISOString(),
      error: 'Failed to fetch stats'
    };
  }
}

async function fetchDockerHub(endpoint, authToken = null) {
  const headers = { 'User-Agent': 'docker-hub-api-gateway/1.0', 'Accept': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  try {
    const response = await fetch(`${DOCKER_HUB_API}${endpoint}`, { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      if (response.status === 404) throw new Error('Resource not found');
      if (response.status === 429) throw new Error('Docker Hub rate limit exceeded');
      throw new Error(`Docker Hub API error: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('Docker Hub API timeout');
    throw error;
  }
}

async function getAuthToken() {
  const username = process.env.DOCKER_USERNAME;
  const password = process.env.DOCKER_PASSWORD;
  if (!username || !password) return null;
  try {
    const response = await fetch(`${DOCKER_HUB_API}/users/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (response.ok) {
      const data = await response.json();
      return data.token;
    }
  } catch (e) { console.error('Auth failed:', e); }
  return null;
}

// ==================== API ROUTES (必须先定义 API 路由) ====================

// API: User Stats
app.get('/api/user/stats', async (c) => {
  const username = c.req.query('username');
  const fields = c.req.query('fields')?.split(',') || ['name', 'pull_count', 'star_count'];
  if (!username) return c.json({ error: 'username parameter required' }, 400);
  
  await trackCall('user/stats');
  
  try {
    const authToken = await getAuthToken();
    const repos = [];
    let nextUrl = `/repositories/${username}/?page_size=100`;
    
    while (nextUrl) {
      const data = await fetchDockerHub(nextUrl, authToken);
      repos.push(...(data.results || []));
      nextUrl = data.next?.replace('https://hub.docker.com/v2', '') || null;
    }
    
    const totalPulls = repos.reduce((sum, r) => sum + (r.pull_count || 0), 0);
    const totalStars = repos.reduce((sum, r) => sum + (r.star_count || 0), 0);
    
    const filteredRepos = repos.map(r => {
      const repo = {};
      fields.forEach(f => {
        if (f === 'pullCount') repo.pullCount = r.pull_count;
        else if (f === 'starCount') repo.starCount = r.star_count;
        else if (r[f] !== undefined) repo[f] = r[f];
      });
      return repo;
    }).sort((a, b) => (b.pullCount || 0) - (a.pullCount || 0));
    
    return c.json({
      success: true,
      username,
      repositoryCount: repos.length,
      totalPulls,
      totalStars,
      repositories: filteredRepos,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
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
    const data = await fetchDockerHub(`/repositories/search?q=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`);
    return c.json({
      success: true, query, page, pageSize,
      total: data.count,
      results: data.results || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// API: Stats (public)
app.get('/api/stats', async (c) => {
  await trackCall('health');
  return c.json(await getStats());
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
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  return c.html(indexHtml);
});

// Serve static files from public folder
app.get('/favicon.ico', (c) => {
  try {
    const faviconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
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
  const filePath = path.join(__dirname, '..', 'public', reqPath);
  
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
