const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { serveStatic } = require('hono/serve-static');

const app = new Hono();
app.use('/api/*', cors());

// Serve static files
app.use('/*', serveStatic({ root: './public' }));

const DOCKER_HUB_API = 'https://hub.docker.com/v2';

// In-memory stats (resets on cold start)
let stats = {
  totalCalls: 0,
  byEndpoint: { 'user/stats': 0, 'repo/details': 0, 'repo/tags': 0, 'search': 0, 'health': 0 }
};

// Track API call (no user/daily tracking for privacy)
function trackCall(endpoint) {
  stats.totalCalls++;
  if (stats.byEndpoint[endpoint] !== undefined) {
    stats.byEndpoint[endpoint]++;
  }
}

// Get public stats (no user/daily tracking for privacy)
function getPublicStats() {
  return {
    totalCalls: stats.totalCalls,
    byEndpoint: stats.byEndpoint,
    lastUpdated: new Date().toISOString()
  };
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

// API: User Stats
app.get('/api/user/stats', async (c) => {
  const username = c.req.query('username');
  const fields = c.req.query('fields')?.split(',') || ['name', 'pull_count', 'star_count'];
  if (!username) return c.json({ error: 'username parameter required' }, 400);
  
  trackCall('user/stats');
  
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
  
  trackCall('repo/details');
  
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
  
  trackCall('repo/tags');
  
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
  
  trackCall('search');
  
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
app.get('/api/stats', (c) => {
  trackCall('health');
  return c.json(getPublicStats());
});

// API: Health Check
app.get('/api/health', (c) => {
  trackCall('health');
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
