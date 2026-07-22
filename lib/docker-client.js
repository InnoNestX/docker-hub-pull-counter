/**
 * Docker Hub API client
 */

const DOCKER_HUB_API = 'https://hub.docker.com/v2';
const AUTH_TOKEN_CACHE_KEY = 'docker:auth-token';

const {
  DockerHubTimeoutError,
  DockerHubConnectionError,
  DockerHubRateLimitError,
  DockerHubError
} = require('./errors');

const cache = require('./cache');

async function fetchDockerHub(endpoint, authToken = null, timeout = 30000) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://hub.docker.com/'
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  try {
    const response = await fetch(`${DOCKER_HUB_API}${endpoint}`, {
      headers,
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow'
    });

    if (!response.ok) {
      if (response.status === 404) throw new Error('Resource not found');
      if (response.status === 429) throw new DockerHubRateLimitError();
      throw new DockerHubError(`Docker Hub API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof DockerHubRateLimitError || error instanceof DockerHubError) {
      throw error;
    }
    if (error.message === 'Resource not found') {
      throw error;
    }
    if (error.name === 'TimeoutError' || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      throw new DockerHubTimeoutError();
    }
    if (error.cause?.code === 'ECONNRESET' || error.message === 'fetch failed') {
      throw new DockerHubConnectionError();
    }
    throw new DockerHubError(error.message, error);
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
  } catch (error) {
    console.error('Docker Hub auth failed:', error.message);
  }
  return null;
}

function createDockerClient() {
  return {
    fetchDockerHub,
    getAuthToken
  };
}

module.exports = {
  fetchDockerHub,
  getAuthToken,
  createDockerClient,
  DOCKER_HUB_API
};
