/**
 * @fileoverview JSDoc Type Definitions for Docker Hub Pull Counter
 * These are documentation-only type annotations for plain JavaScript.
 * For actual type safety, consider migrating to TypeScript.

/**
 * @typedef {Object} UserStats
 * @property {boolean} success - Whether the request was successful
 * @property {string} username - Docker Hub username
 * @property {number} repositoryCount - Total number of repositories
 * @property {number} totalPulls - Total pull count across all repositories
 * @property {number} totalStars - Total star count across all repositories
 * @property {Repository[]} [repositories] - Array of repository details (when fields param is used)
 * @property {string} timestamp - ISO 8601 timestamp of the response
 * @property {string} refreshedAt - ISO 8601 timestamp of when stats were last refreshed
 */

/**
 * @typedef {Object} Repository
 * @property {string} name - Repository name
 * @property {string} namespace - Repository namespace/owner
 * @property {number} pull_count - Pull count for this repository
 * @property {number} star_count - Star count for this repository
 * @property {string} [last_updated] - ISO 8601 timestamp of last update
 */

/**
 * @typedef {Object} DockerHubError
 * @property {boolean} success - Always false for errors
 * @property {string} error - Human-readable error message
 * @property {string} [originalError] - Original error from Docker Hub API
 */

/**
 * @typedef {Object} BatchResult
 * @property {boolean} success - Whether the batch request was successful
 * @property {BatchItem[]} results - Array of successful results
 * @property {BatchError[]} errors - Array of failed items
 */

/**
 * @typedef {Object} BatchItem
 * @property {string} namespace - Namespace of the repository
 * @property {string} repo - Name of the repository
 * @property {Object} data - Repository data (same format as /api/repo/details)
 */

/**
 * @typedef {Object} BatchError
 * @property {string} namespace - Namespace that failed
 * @property {string} repo - Repository that failed
 * @property {string} error - Error message
 */

/**
 * @typedef {Object} HealthStatus
 * @property {string} status - "ok" if healthy
 * @property {string} redis - "connected" or "not-configured"
 * @property {string} timestamp - ISO 8601 timestamp
 */

/**
 * @typedef {Object} ApiStats
 * @property {number} totalCalls - Total API calls
 * @property {Object.<string, number>} byEndpoint - Calls broken down by endpoint
 * @property {string} lastUpdated - ISO 8601 timestamp
 * @property {string} [warning] - Warning message if Redis not configured
 */

/**
 * @typedef {Object} OpenApiSpec
 * @property {string} openapi - OpenAPI version (e.g., "3.0.0")
 * @property {Object} info - API info (title, version, description)
 * @property {Object[]} servers - Array of server objects
 * @property {Object} paths - API endpoints mapped to operations
 * @property {Object} components - Reusable components (schemas, etc.)
 */

module.exports = {};
