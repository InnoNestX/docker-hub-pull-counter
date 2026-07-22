/**
 * OpenAPI 3.0 specification for the Docker Hub Pull Counter API
 */

function generateOpenApiSpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Docker Hub Pull Counter API',
      description: 'API gateway for Docker Hub stats, SVG cards, shields badges, compare, and embed helpers',
      version: '2.3.3',
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
          parameters: [
            { name: 'username', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'fields', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'fresh', in: 'query', required: false, schema: { type: 'string', enum: ['1', 'true'] }, description: 'Bypass short cache' }
          ],
          responses: {
            '200': { description: 'Successful response' },
            '400': { description: 'Validation error' },
            '429': { description: 'Rate limit exceeded' },
            '500': { description: 'Server error' }
          }
        }
      },
      '/api/user/top-repos': {
        get: {
          summary: 'Get top repositories by pulls',
          parameters: [
            { name: 'username', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 5 } }
          ],
          responses: { '200': { description: 'Successful response' } }
        }
      },
      '/api/docker-stats': {
        get: {
          summary: 'SVG stats card for a user or repository',
          description: 'Provide username for a user card, or namespace+repo for a repository card. style controls the visual theme.',
          parameters: [
            { name: 'username', in: 'query', required: false, schema: { type: 'string' }, description: 'User card mode' },
            { name: 'namespace', in: 'query', required: false, schema: { type: 'string' }, description: 'Repo card mode (with repo)' },
            { name: 'repo', in: 'query', required: false, schema: { type: 'string' }, description: 'Repo card mode (with namespace)' },
            {
              name: 'style',
              in: 'query',
              required: false,
              description: 'Card visual theme. Unknown values fall back to gradient. See also GET /api/docker-stats/styles and /docs.html#docker-stats',
              schema: {
                type: 'string',
                default: 'gradient',
                enum: ['gradient', 'minimal', 'dark', 'light', 'github', 'compact']
              }
            }
          ],
          responses: { '200': { description: 'SVG image' } }
        }
      },
      '/api/docker-stats/styles': {
        get: {
          summary: 'List available SVG card styles',
          responses: { '200': { description: 'Style enum list and example URLs' } }
        }
      },
      '/api/compare': {
        get: {
          summary: 'Compare multiple Docker Hub users',
          parameters: [
            { name: 'usernames', in: 'query', required: true, schema: { type: 'string' }, description: 'Comma-separated usernames (2-5)' }
          ],
          responses: { '200': { description: 'Ranked comparison' } }
        }
      },
      '/api/embed': {
        get: {
          summary: 'Generate README badge and card snippets',
          parameters: [
            { name: 'username', in: 'query', required: true, schema: { type: 'string' } }
          ],
          responses: { '200': { description: 'Markdown/HTML snippets' } }
        }
      },
      '/api/user/history': {
        get: {
          summary: 'Daily pull/star history for a user',
          parameters: [
            { name: 'username', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'days', in: 'query', required: false, schema: { type: 'integer', default: 30 } }
          ],
          responses: { '200': { description: 'Time series with deltas' } }
        }
      },
      '/api/user/growth': {
        get: {
          summary: 'Pull growth summary for a user',
          parameters: [
            { name: 'username', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'days', in: 'query', required: false, schema: { type: 'integer', default: 7 } }
          ],
          responses: { '200': { description: 'Growth window summary' } }
        }
      },
      '/api/repo/history': {
        get: {
          summary: 'Daily pull/star history for a repository',
          parameters: [
            { name: 'namespace', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'repo', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'days', in: 'query', required: false, schema: { type: 'integer', default: 30 } }
          ],
          responses: { '200': { description: 'Repository time series' } }
        }
      },
      '/api/trend': {
        get: {
          summary: 'SVG sparkline card for pull trend',
          parameters: [
            { name: 'username', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'namespace', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'repo', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'days', in: 'query', required: false, schema: { type: 'integer', default: 30 } },
            {
              name: 'style',
              in: 'query',
              required: false,
              description: 'Same style enum as /api/docker-stats',
              schema: {
                type: 'string',
                default: 'gradient',
                enum: ['gradient', 'minimal', 'dark', 'light', 'github', 'compact']
              }
            }
          ],
          responses: { '200': { description: 'SVG trend card' } }
        }
      },
      '/api/badge/growth': {
        get: {
          summary: 'Shields.io growth badge',
          parameters: [
            { name: 'username', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'days', in: 'query', required: false, schema: { type: 'integer', default: 7 } }
          ],
          responses: { '200': { description: 'Shields endpoint JSON' } }
        }
      },
      '/api/badge/pulls': {
        get: {
          summary: 'Shields.io endpoint badge for total pulls',
          parameters: [{ name: 'username', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Shields endpoint JSON' } }
        }
      },
      '/api/badge/stars': {
        get: {
          summary: 'Shields.io endpoint badge for total stars',
          parameters: [{ name: 'username', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Shields endpoint JSON' } }
        }
      },
      '/api/badge/repos': {
        get: {
          summary: 'Shields.io endpoint badge for repository count',
          parameters: [{ name: 'username', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Shields endpoint JSON' } }
        }
      },
      '/api/repo/details': {
        get: {
          summary: 'Get repository details',
          parameters: [
            { name: 'namespace', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'repo', in: 'query', required: true, schema: { type: 'string' } }
          ],
          responses: { '200': { description: 'Successful response' } }
        }
      },
      '/api/repo/tags': {
        get: {
          summary: 'List repository tags',
          parameters: [
            { name: 'namespace', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'repo', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 100 } }
          ],
          responses: { '200': { description: 'Successful response' } }
        }
      },
      '/api/search': {
        get: {
          summary: 'Search repositories',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
            { name: 'page_size', in: 'query', required: false, schema: { type: 'integer', default: 25 } }
          ],
          responses: { '200': { description: 'Successful response' } }
        }
      },
      '/api/batch/stats': {
        get: {
          summary: 'Batch user statistics',
          parameters: [
            { name: 'usernames', in: 'query', required: true, schema: { type: 'string' } }
          ],
          responses: { '200': { description: 'Successful response' } }
        }
      },
      '/api/popular/repos': {
        get: {
          summary: 'Popular repositories ordered by pull count',
          parameters: [
            { name: 'namespace', in: 'query', required: false, schema: { type: 'string', default: 'library' } },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
            { name: 'page_size', in: 'query', required: false, schema: { type: 'integer', default: 25 } }
          ],
          responses: { '200': { description: 'Successful response' } }
        }
      },
      '/api/stats': {
        get: {
          summary: 'Get API usage statistics',
          responses: { '200': { description: 'Successful response' } }
        }
      },
      '/api/health': {
        get: {
          summary: 'Health check',
          responses: { '200': { description: 'Service is healthy' } }
        }
      }
    }
  };
}

module.exports = { generateOpenApiSpec };
