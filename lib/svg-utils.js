/**
 * SVG generation utilities
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
 * Create Docker Stats SVG card
 */
function createDockerStatsSvg({ username, repositoryCount = 0, totalPulls = 0, totalStars = 0, error = null }) {
  const safeUsername = escapeXml(username || 'unknown');
  const safeError = error ? escapeXml(error) : '';
  const description = error
    ? `Unable to load Docker Hub stats for ${safeUsername}: ${safeError}`
    : `Docker Hub stats for ${safeUsername}. Total pulls ${formatNumber(totalPulls)}, repository count ${formatNumber(repositoryCount)}, total stars ${formatNumber(totalStars)}.`;

  const rows = error
    ? `
      <rect x="24" y="76" width="372" height="78" rx="14" fill="rgba(255,255,255,0.05)" />
      <text x="40" y="108" fill="#fca5a5" font-size="14" font-weight="600">Unable to load stats</text>
      <text x="40" y="132" fill="#d1d5db" font-size="13">${safeError}</text>
    `
    : `
      <g transform="translate(24 76)">
        <rect width="112" height="78" rx="14" fill="rgba(255,255,255,0.05)" />
        <text x="16" y="28" fill="#93c5fd" font-size="12">Total Pulls</text>
        <text x="16" y="56" fill="#ffffff" font-size="22" font-weight="700">${formatNumber(totalPulls)}</text>
      </g>
      <g transform="translate(154 76)">
        <rect width="112" height="78" rx="14" fill="rgba(255,255,255,0.05)" />
        <text x="16" y="28" fill="#93c5fd" font-size="12">Repositories</text>
        <text x="16" y="56" fill="#ffffff" font-size="22" font-weight="700">${formatNumber(repositoryCount)}</text>
      </g>
      <g transform="translate(284 76)">
        <rect width="112" height="78" rx="14" fill="rgba(255,255,255,0.05)" />
        <text x="16" y="28" fill="#93c5fd" font-size="12">Total Stars</text>
        <text x="16" y="56" fill="#ffffff" font-size="22" font-weight="700">${formatNumber(totalStars)}</text>
      </g>
    `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="420" height="180" viewBox="0 0 420 180" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Docker Hub Stats</title>
  <desc id="desc">${description}</desc>
  <defs>
    <linearGradient id="bg" x1="16" y1="10" x2="404" y2="170" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0F172A" />
      <stop offset="1" stop-color="#1D4ED8" />
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="404" height="164" rx="20" fill="url(#bg)" />
  <rect x="8.5" y="8.5" width="403" height="163" rx="19.5" stroke="rgba(255,255,255,0.14)" />
  <text x="24" y="38" fill="#ffffff" font-size="20" font-weight="700">Docker Hub Stats</text>
  <text x="24" y="60" fill="#cbd5e1" font-size="13">@${safeUsername}</text>
  ${rows}
</svg>`;
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
  getUserFacingStatsError
};
