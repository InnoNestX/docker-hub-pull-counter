const MAX_REPOSITORIES = 500;

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
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
  const repositories = await fetchAllRepositories(normalized, options.dockerClient);
  const freshStats = createUserStats(normalized, repositories);

  return { stats: freshStats, source: 'docker-hub' };
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

module.exports = {
  buildUserStatsResponse,
  getUserStats
};
