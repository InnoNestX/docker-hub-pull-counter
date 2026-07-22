/**
 * Daily pull/star history for users and repositories.
 * Prefers Redis; falls back to process memory for local/dev.
 */

const { normalizeUsername } = require('./user-stats');

const HISTORY_TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_HISTORY_DAYS = 90;
const memoryStore = new Map();

function todayUTC(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysAgoUTC(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return todayUTC(date);
}

function listDatesInclusive(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) {
    return dates;
  }
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function userHistoryKey(username) {
  return `history:user:${normalizeUsername(username)}`;
}

function repoHistoryKey(namespace, repo) {
  return `history:repo:${String(namespace || '').trim().toLowerCase()}/${String(repo || '').trim().toLowerCase()}`;
}

function parseSnapshot(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function memoryGetAll(key) {
  return memoryStore.get(key) || {};
}

function memorySet(key, date, snapshot) {
  const current = { ...memoryGetAll(key), [date]: snapshot };
  memoryStore.set(key, current);
}

async function recordSnapshot(redis, key, snapshot, indexKey, indexValue) {
  const date = todayUTC();
  const payload = {
    totalPulls: Number(snapshot.totalPulls) || 0,
    totalStars: Number(snapshot.totalStars) || 0,
    repositoryCount: Number(snapshot.repositoryCount) || 0,
    at: new Date().toISOString()
  };

  if (!redis) {
    const existing = memoryGetAll(key)[date];
    if (existing) return { recorded: false, date, source: 'memory' };
    memorySet(key, date, payload);
    return { recorded: true, date, source: 'memory' };
  }

  try {
    const existing = await redis.hget(key, date);
    if (existing) {
      return { recorded: false, date, source: 'redis' };
    }

    await redis.hset(key, { [date]: JSON.stringify(payload) });
    await redis.expire(key, HISTORY_TTL_SECONDS);
    if (indexKey && indexValue) {
      await redis.sadd(indexKey, indexValue);
    }
    return { recorded: true, date, source: 'redis' };
  } catch (error) {
    console.error('[HISTORY] record error:', error.message);
    return { recorded: false, date, error: error.message };
  }
}

async function recordUserSnapshot(redis, stats) {
  if (!stats?.username) return { recorded: false };
  return recordSnapshot(
    redis,
    userHistoryKey(stats.username),
    stats,
    'history:users',
    normalizeUsername(stats.username)
  );
}

async function recordRepoSnapshot(redis, namespace, repo, data) {
  if (!namespace || !repo) return { recorded: false };
  return recordSnapshot(
    redis,
    repoHistoryKey(namespace, repo),
    {
      totalPulls: data.pull_count ?? data.pullCount ?? 0,
      totalStars: data.star_count ?? data.starCount ?? 0,
      repositoryCount: 1
    },
    'history:repos',
    `${String(namespace).toLowerCase()}/${String(repo).toLowerCase()}`
  );
}

async function readHistoryMap(redis, key) {
  if (!redis) {
    return memoryGetAll(key);
  }

  try {
    const raw = await redis.hgetall(key);
    if (!raw || typeof raw !== 'object') return {};
    const mapped = {};
    for (const [date, value] of Object.entries(raw)) {
      const parsed = parseSnapshot(value);
      if (parsed) mapped[date] = parsed;
    }
    return mapped;
  } catch (error) {
    console.error('[HISTORY] read error:', error.message);
    return {};
  }
}

function buildSeries(historyMap, days = 30) {
  const windowDays = Math.max(1, Math.min(Number(days) || 30, MAX_HISTORY_DAYS));
  const to = todayUTC();
  const from = daysAgoUTC(windowDays - 1);

  const recorded = Object.entries(historyMap || {})
    .filter(([date]) => date >= from && date <= to)
    .map(([date, snapshot]) => ({
      date,
      totalPulls: Number(snapshot.totalPulls) || 0,
      totalStars: Number(snapshot.totalStars) || 0,
      repositoryCount: Number(snapshot.repositoryCount) || 0,
      at: snapshot.at || `${date}T00:00:00.000Z`,
      recorded: true
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const recordedByDate = Object.fromEntries(recorded.map((point) => [point.date, point]));
  const firstRecorded = recorded[0] || null;
  const lastRecorded = recorded[recorded.length - 1] || null;

  let points;
  if (!recorded.length) {
    points = listDatesInclusive(from, to).map((date) => ({
      date,
      totalPulls: 0,
      totalStars: 0,
      repositoryCount: 0,
      at: `${date}T00:00:00.000Z`,
      recorded: false,
      missing: true,
      pullDelta: 0,
      starDelta: 0
    }));
  } else {
    // Continuous daily timeline from first sample through window end.
    // Gaps are carried forward (marked carried) so trend charts stay readable.
    let carry = null;
    const dense = listDatesInclusive(firstRecorded.date, to).map((date) => {
      const hit = recordedByDate[date];
      if (hit) {
        carry = hit;
        return { ...hit };
      }
      return {
        date,
        totalPulls: carry.totalPulls,
        totalStars: carry.totalStars,
        repositoryCount: carry.repositoryCount,
        at: carry.at,
        recorded: false,
        carried: true
      };
    });

    points = dense.map((point, index) => {
      const previous = index > 0 ? dense[index - 1] : null;
      return {
        ...point,
        pullDelta: previous ? point.totalPulls - previous.totalPulls : 0,
        starDelta: previous ? point.totalStars - previous.totalStars : 0
      };
    });
  }

  const pullGrowth = firstRecorded && lastRecorded
    ? lastRecorded.totalPulls - firstRecorded.totalPulls
    : 0;
  const starGrowth = firstRecorded && lastRecorded
    ? lastRecorded.totalStars - firstRecorded.totalStars
    : 0;
  const insufficientHistory = recorded.length < 2;
  const pullGrowthPercent = !insufficientHistory && firstRecorded && firstRecorded.totalPulls > 0
    ? Number(((pullGrowth / firstRecorded.totalPulls) * 100).toFixed(2))
    : null;

  return {
    days: windowDays,
    from,
    to,
    points,
    sampleCount: recorded.length,
    insufficientHistory,
    growth: {
      pulls: pullGrowth,
      stars: starGrowth,
      pullPercent: pullGrowthPercent,
      // Always the requested window, not just the sparse sample span
      from,
      to,
      baselineDate: firstRecorded?.date || null,
      latestDate: lastRecorded?.date || null
    }
  };
}

async function getUserHistory(redis, username, days = 30) {
  const map = await readHistoryMap(redis, userHistoryKey(username));
  return {
    username: normalizeUsername(username),
    ...buildSeries(map, days)
  };
}

async function getRepoHistory(redis, namespace, repo, days = 30) {
  const map = await readHistoryMap(redis, repoHistoryKey(namespace, repo));
  return {
    namespace: String(namespace || '').toLowerCase(),
    repo: String(repo || '').toLowerCase(),
    ...buildSeries(map, days)
  };
}

async function listTrackedUsers(redis) {
  if (!redis) return [];
  try {
    return (await redis.smembers('history:users')) || [];
  } catch {
    return [];
  }
}

module.exports = {
  MAX_HISTORY_DAYS,
  buildSeries,
  getRepoHistory,
  getUserHistory,
  listTrackedUsers,
  recordRepoSnapshot,
  recordUserSnapshot,
  todayUTC
};
