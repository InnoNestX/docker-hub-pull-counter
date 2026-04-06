const { Hono } = require('hono');
const { cors } = require('hono/cors');

const app = new Hono();

// Enable CORS for API
app.use('/api/*', cors());

// Docker Hub API base URL
const DOCKER_HUB_API = 'https://hub.docker.com/v2';

/**
 * Fetch all repositories for a user with pagination support
 */
async function fetchAllRepos(username, authToken = null) {
  const repos = [];
  let nextUrl = `${DOCKER_HUB_API}/repositories/${username}/?page_size=100`;
  
  const headers = {
    'User-Agent': 'docker-hub-pull-counter/1.0',
    'Accept': 'application/json'
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  while (nextUrl) {
    const response = await fetch(nextUrl, { headers });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`用户 "${username}" 不存在`);
      }
      if (response.status === 429) {
        throw new Error('Docker Hub API 速率限制，请稍后重试');
      }
      throw new Error(`Docker Hub API 错误：${response.status}`);
    }
    
    const data = await response.json();
    repos.push(...(data.results || []));
    nextUrl = data.next || null;
  }
  
  return repos;
}

/**
 * Get Docker Hub auth token (optional, for higher rate limits)
 */
async function getAuthToken() {
  const username = process.env.DOCKER_USERNAME;
  const password = process.env.DOCKER_PASSWORD;
  
  if (!username || !password) {
    return null;
  }
  
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
  } catch (e) {
    console.error('Failed to get auth token:', e);
  }
  
  return null;
}

// API endpoint
app.get('/api/stats', async (c) => {
  const username = c.req.query('username');
  
  if (!username) {
    return c.json({ error: '请提供 username 参数' }, 400);
  }
  
  // Clean username
  const cleanUsername = username.trim().toLowerCase();
  
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/i.test(cleanUsername)) {
    return c.json({ error: '无效的 Docker Hub 用户名' }, 400);
  }
  
  try {
    // Get auth token if configured
    const authToken = await getAuthToken();
    
    // Fetch all repositories
    const repos = await fetchAllRepos(cleanUsername, authToken);
    
    // Calculate total pulls
    const totalPulls = repos.reduce((sum, repo) => sum + (repo.pull_count || 0), 0);
    
    // Sort by pull count
    const sortedRepos = repos
      .map(r => ({
        name: r.name,
        pullCount: r.pull_count || 0,
        starCount: r.star_count || 0,
        isPrivate: r.is_private || false,
        description: r.description || ''
      }))
      .sort((a, b) => b.pullCount - a.pullCount);
    
    return c.json({
      success: true,
      username: cleanUsername,
      repositoryCount: sortedRepos.length,
      totalPulls,
      totalPullsFormatted: totalPulls.toLocaleString(),
      repositories: sortedRepos,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, error.message.includes('不存在') ? 404 : 500);
  }
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Frontend page
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Docker Hub Pull Counter</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 {
      text-align: center;
      margin-bottom: 10px;
      font-size: 2.5em;
    }
    .subtitle {
      text-align: center;
      color: #8892b0;
      margin-bottom: 40px;
    }
    .search-box {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
    }
    input {
      flex: 1;
      padding: 15px 20px;
      font-size: 18px;
      border: 2px solid #3a4a6b;
      border-radius: 10px;
      background: #0f1623;
      color: #fff;
      outline: none;
    }
    input:focus { border-color: #00d9ff; }
    button {
      padding: 15px 30px;
      font-size: 18px;
      background: #00d9ff;
      color: #1a1a2e;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-weight: bold;
      transition: transform 0.2s;
    }
    button:hover { transform: scale(1.05); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .stats-card {
      background: #1e2a4a;
      border-radius: 15px;
      padding: 30px;
      margin-bottom: 20px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .stat-item {
      text-align: center;
      padding: 20px;
      background: #0f1623;
      border-radius: 10px;
    }
    .stat-value {
      font-size: 2.5em;
      font-weight: bold;
      color: #00d9ff;
    }
    .stat-label { color: #8892b0; margin-top: 5px; }
    
    .repo-list {
      background: #1e2a4a;
      border-radius: 15px;
      padding: 20px;
    }
    .repo-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px;
      border-bottom: 1px solid #3a4a6b;
    }
    .repo-item:last-child { border-bottom: none; }
    .repo-name {
      font-size: 1.2em;
      font-weight: bold;
      color: #00d9ff;
    }
    .repo-stats {
      display: flex;
      gap: 20px;
      color: #8892b0;
    }
    .repo-stats span {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .error {
      background: #ff4757;
      color: #fff;
      padding: 15px 20px;
      border-radius: 10px;
      margin-bottom: 20px;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #8892b0;
    }
    .hidden { display: none; }
    
    footer {
      text-align: center;
      margin-top: 40px;
      color: #8892b0;
      font-size: 0.9em;
    }
    footer a { color: #00d9ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🐳 Docker Hub Pull Counter</h1>
    <p class="subtitle">查询用户名下所有镜像的总拉取次数</p>
    
    <div class="search-box">
      <input type="text" id="usernameInput" placeholder="输入 Docker Hub 用户名" 
             autocomplete="off" autofocus>
      <button id="searchBtn" onclick="search()">查询</button>
    </div>
    
    <div id="error" class="error hidden"></div>
    
    <div id="loading" class="loading hidden">
      <p>🔄 正在查询 Docker Hub...</p>
    </div>
    
    <div id="results" class="hidden">
      <div class="stats-card">
        <h2 id="resultTitle"></h2>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value" id="totalPulls">-</div>
            <div class="stat-label">总 Pull 次数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" id="repoCount">-</div>
            <div class="stat-label">仓库数量</div>
          </div>
        </div>
      </div>
      
      <div class="repo-list">
        <h3 style="margin-bottom: 15px;">📦 仓库详情</h3>
        <div id="repoList"></div>
      </div>
    </div>
    
    <footer>
      <p>Powered by Docker Hub API | 
         <a href="https://github.com/xuxuclassmate" target="_blank">GitHub</a>
      </p>
    </footer>
  </div>
  
  <script>
    const input = document.getElementById('usernameInput');
    const searchBtn = document.getElementById('searchBtn');
    const errorDiv = document.getElementById('error');
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') search();
    });
    
    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const usernameParam = params.get('username');
    if (usernameParam) {
      input.value = usernameParam;
      search();
    }
    
    async function search() {
      const username = input.value.trim();
      if (!username) return;
      
      // Reset UI
      errorDiv.classList.add('hidden');
      resultsDiv.classList.add('hidden');
      loadingDiv.classList.remove('hidden');
      searchBtn.disabled = true;
      
      try {
        const response = await fetch(\`/api/stats?username=\${encodeURIComponent(username)}\`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || '查询失败');
        }
        
        // Update stats
        document.getElementById('resultTitle').textContent = \`🐳 @\${data.username}\`;
        document.getElementById('totalPulls').textContent = data.totalPullsFormatted;
        document.getElementById('repoCount').textContent = data.repositoryCount;
        
        // Update repo list
        const repoList = document.getElementById('repoList');
        repoList.innerHTML = data.repositories.map(repo => \`
          <div class="repo-item">
            <div>
              <div class="repo-name">\${repo.name}</div>
              <div style="color: #8892b0; font-size: 0.9em; margin-top: 5px;">
                \${repo.description || '无描述'}
              </div>
            </div>
            <div class="repo-stats">
              <span>📥 \${repo.pullCount.toLocaleString()} pulls</span>
              <span>⭐ \${repo.starCount.toLocaleString()}</span>
            </div>
          </div>
        \`).join('');
        
        resultsDiv.classList.remove('hidden');
        
      } catch (err) {
        errorDiv.textContent = '❌ ' + err.message;
        errorDiv.classList.remove('hidden');
      } finally {
        loadingDiv.classList.add('hidden');
        searchBtn.disabled = false;
      }
    }
  </script>
</body>
</html>`);
});

// Export for Vercel
export default app;
