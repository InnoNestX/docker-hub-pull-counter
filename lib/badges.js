/**
 * Shields.io-compatible badge helpers and embed snippets.
 */

const { formatNumber } = require('./svg-utils');

function formatCompact(value) {
  const number = Number(value) || 0;
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(number);
}

function buildShieldsBadge({ label, message, color = 'blue' }) {
  return {
    schemaVersion: 1,
    label,
    message: String(message),
    color
  };
}

function buildUserBadges(stats, baseUrl) {
  const username = stats.username;
  const pullsBadge = `${baseUrl}/api/badge/pulls?username=${encodeURIComponent(username)}`;
  const starsBadge = `${baseUrl}/api/badge/stars?username=${encodeURIComponent(username)}`;
  const reposBadge = `${baseUrl}/api/badge/repos?username=${encodeURIComponent(username)}`;
  const cardUrl = `${baseUrl}/api/docker-stats?username=${encodeURIComponent(username)}&style=gradient`;

  return {
    username,
    badges: {
      pulls: {
        endpoint: pullsBadge,
        markdown: `![Docker Pulls](https://img.shields.io/endpoint?url=${encodeURIComponent(pullsBadge)})`,
        value: stats.totalPulls,
        display: formatCompact(stats.totalPulls)
      },
      stars: {
        endpoint: starsBadge,
        markdown: `![Docker Stars](https://img.shields.io/endpoint?url=${encodeURIComponent(starsBadge)})`,
        value: stats.totalStars,
        display: formatCompact(stats.totalStars)
      },
      repos: {
        endpoint: reposBadge,
        markdown: `![Docker Repos](https://img.shields.io/endpoint?url=${encodeURIComponent(reposBadge)})`,
        value: stats.repositoryCount,
        display: formatNumber(stats.repositoryCount)
      }
    },
    card: {
      url: cardUrl,
      markdown: `[![Docker Hub Stats](${cardUrl})](https://hub.docker.com/u/${username})`,
      html: `<a href="https://hub.docker.com/u/${username}"><img src="${cardUrl}" alt="Docker Hub Stats for ${username}" /></a>`
    }
  };
}

module.exports = {
  buildShieldsBadge,
  buildUserBadges,
  formatCompact
};
