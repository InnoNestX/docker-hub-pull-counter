/**
 * Custom error classes for the Docker Hub Pull Counter API
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code
    };
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      field: this.field
    };
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      retryAfter: this.retryAfter
    };
  }
}

class DockerHubError extends AppError {
  constructor(message, originalError = null) {
    super(message, 502, 'DOCKER_HUB_ERROR');
    this.originalError = originalError;
  }
}

class DockerHubTimeoutError extends DockerHubError {
  constructor() {
    super('Docker Hub API timeout');
    this.code = 'DOCKER_HUB_TIMEOUT';
  }
}

class DockerHubConnectionError extends DockerHubError {
  constructor() {
    super('Docker Hub API connection failed');
    this.code = 'DOCKER_HUB_CONNECTION_FAILED';
  }
}

class DockerHubRateLimitError extends DockerHubError {
  constructor() {
    super('Docker Hub rate limit exceeded');
    this.code = 'DOCKER_HUB_RATE_LIMIT';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  DockerHubError,
  DockerHubTimeoutError,
  DockerHubConnectionError,
  DockerHubRateLimitError,
  AuthenticationError
};
