/**
 * SVG generation utilities - Multi-style Docker Hub stats cards
 */

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

/**
 * Card styles configuration
 */
const CARD_STYLES = {
  gradient: {
    name: 'gradient',
    bg: { start: '#0F172A', end: '#1D4ED8' },
    text: '#ffffff',
    dimText: '#cbd5e1',
    accent: '#93c5fd',
    cardBg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.14)',
    errorColor: '#fca5a5'
  },
  minimal: {
    name: 'minimal',
    bg: { start: '#ffffff', end: '#f8fafc' },
    text: '#1f2328',
    dimText: '#656d76',
    accent: '#0969da',
    cardBg: '#f6f8fa',
    border: '#d0d7de',
    errorColor: '#cf222e'
  },
  dark: {
    name: 'dark',
    bg: { start: '#000000', end: '#1a1a1a' },
    text: '#ffffff',
    dimText: '#8b949e',
    accent: '#58a6ff',
    cardBg: '#161b22',
    border: '#30363d',
    errorColor: '#f85149'
  },
  light: {
    name: 'light',
    bg: { start: '#f0f9ff', end: '#e0f2fe' },
    text: '#0c4a6e',
    dimText: '#0369a1',
    accent: '#0284c7',
    cardBg: '#ffffff',
    border: '#bae6fd',
    errorColor: '#dc2626'
  },
  github: {
    name: 'github',
    bg: { start: '#161b22', end: '#0d1117' },
    text: '#e6edf3',
    dimText: '#8b949e',
    accent: '#58a6ff',
    cardBg: '#21262d',
    border: '#30363d',
    errorColor: '#f85149'
  }
};

/**
 * Get style config or default to gradient
 */
function getStyleConfig(style) {
  return CARD_STYLES[style] || CARD_STYLES.gradient;
}

/**
 * Generate SVG with specific style
 */
function generateStyledSvg(styleConfig, data) {
  const { username, repositoryCount = 0, totalPulls = 0, totalStars = 0, error = null } = data;
  const safeUsername = escapeXml(username || 'unknown');
  const safeError = error ? escapeXml(error) : '';
  const description = error
    ? `Unable to load Docker Hub stats for ${safeUsername}: ${safeError}`
    : `Docker Hub stats for ${safeUsername}. Total pulls ${formatNumber(totalPulls)}, repository count ${formatNumber(repositoryCount)}, total stars ${formatNumber(totalStars)}.`;

  const rows = error
    ? `
      <rect x="24" y="76" width="372" height="78" rx="14" fill="${styleConfig.cardBg}" />
      <text x="40" y="108" fill="${styleConfig.errorColor}" font-size="14" font-weight="600">Unable to load stats</text>
      <text x="40" y="132" fill="${styleConfig.dimText}" font-size="13">${safeError}</text>
    `
    : `
      <g transform="translate(24 76)">
        <rect width="112" height="78" rx="14" fill="${styleConfig.cardBg}" />
        <text x="16" y="28" fill="${styleConfig.accent}" font-size="12">Total Pulls</text>
        <text x="16" y="56" fill="${styleConfig.text}" font-size="22" font-weight="700">${formatNumber(totalPulls)}</text>
      </g>
      <g transform="translate(154 76)">
        <rect width="112" height="78" rx="14" fill="${styleConfig.cardBg}" />
        <text x="16" y="28" fill="${styleConfig.accent}" font-size="12">Repositories</text>
        <text x="16" y="56" fill="${styleConfig.text}" font-size="22" font-weight="700">${formatNumber(repositoryCount)}</text>
      </g>
      <g transform="translate(284 76)">
        <rect width="112" height="78" rx="14" fill="${styleConfig.cardBg}" />
        <text x="16" y="28" fill="${styleConfig.accent}" font-size="12">Total Stars</text>
        <text x="16" y="56" fill="${styleConfig.text}" font-size="22" font-weight="700">${formatNumber(totalStars)}</text>
      </g>
    `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="420" height="180" viewBox="0 0 420 180" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Docker Hub Stats</title>
  <desc id="desc">${description}</desc>
  <defs>
    <linearGradient id="bg" x1="16" y1="10" x2="404" y2="170" gradientUnits="userSpaceOnUse">
      <stop stop-color="${styleConfig.bg.start}" />
      <stop offset="1" stop-color="${styleConfig.bg.end}" />
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="404" height="164" rx="20" fill="url(#bg)" />
  <rect x="8.5" y="8.5" width="403" height="163" rx="19.5" stroke="${styleConfig.border}" />
  <text x="24" y="38" fill="${styleConfig.text}" font-size="20" font-weight="700">Docker Hub Stats</text>
  <text x="24" y="60" fill="${styleConfig.dimText}" font-size="13">@${safeUsername}</text>
  ${rows}
</svg>`;
}

/**
 * Create Docker Stats SVG card (legacy function - uses gradient style)
 */
function createDockerStatsSvg({ username, repositoryCount = 0, totalPulls = 0, totalStars = 0, error = null }) {
  return generateStyledSvg(CARD_STYLES.gradient, { username, repositoryCount, totalPulls, totalStars, error });
}

/**
 * Create Docker Stats SVG card with specified style
 */
function createDockerStatsSvgWithStyle(style, data) {
  const styleConfig = getStyleConfig(style);
  return generateStyledSvg(styleConfig, data);
}

/**
 * Get list of available styles
 */
function getAvailableStyles() {
  return Object.keys(CARD_STYLES);
}

/**
 * Get user-friendly error message for stats errors
 */
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

module.exports = {
  escapeXml,
  formatNumber,
  createDockerStatsSvg,
  createDockerStatsSvgWithStyle,
  getAvailableStyles,
  getStyleConfig,
  getUserFacingStatsError,
  CARD_STYLES
};
