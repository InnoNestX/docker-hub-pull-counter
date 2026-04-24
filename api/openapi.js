/**
 * OpenAPI Specification API Route
 */

const { getRateLimitHeaders } = require('../lib/rate-limiter');

/**
 * Generate OpenAPI specification
 */
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

/**
 * @param {Object} deps
 * @param {import('hono').Context} deps.c
 * @param {Function} deps.trackCall
 */
async function openApiRoute({ c, trackCall }) {
  await trackCall('openapi');
  return c.json(generateOpenApiSpec(), 200, {
    'Content-Type': 'application/json; charset=utf-8',
    ...getRateLimitHeaders(c)
  });
}

module.exports = { openApiRoute, generateOpenApiSpec };
