import express from 'express';

const app = express();
const port = Number(process.env.PORT || 8787);
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

const espnRequestWindows = new Map();
const espnLeagueCooldowns = new Map();
const ESPN_WINDOW_MS = Number(process.env.ESPN_RATE_WINDOW_MS || 60_000);
const ESPN_MAX_REQUESTS = Number(process.env.ESPN_RATE_MAX || 6);
const ESPN_COOLDOWN_MS = Number(process.env.ESPN_LEAGUE_COOLDOWN_MS || 15_000);

function espnRateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const previous = espnRequestWindows.get(ip);
  const window = !previous || now >= previous.resetAt ? { count: 0, resetAt: now + ESPN_WINDOW_MS } : previous;
  window.count += 1;
  espnRequestWindows.set(ip, window);
  res.set('RateLimit-Limit', String(ESPN_MAX_REQUESTS));
  res.set('RateLimit-Remaining', String(Math.max(0, ESPN_MAX_REQUESTS - window.count)));
  res.set('RateLimit-Reset', String(Math.ceil(window.resetAt / 1000)));
  if (window.count > ESPN_MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: `Too many ESPN requests. Try again in ${retryAfter} seconds.` });
  }
  const leagueId = String(req.body?.leagueId || 'unknown');
  const year = String(req.body?.year || 'unknown');
  const cooldownKey = `${ip}:${leagueId}:${year}`;
  const availableAt = espnLeagueCooldowns.get(cooldownKey) || 0;
  if (now < availableAt) {
    const retryAfter = Math.max(1, Math.ceil((availableAt - now) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: `That league was just refreshed. Try again in ${retryAfter} seconds.` });
  }
  espnLeagueCooldowns.set(cooldownKey, now + ESPN_COOLDOWN_MS);
  // Opportunistically remove expired entries so this in-memory limiter stays small.
  if (espnRequestWindows.size > 5_000) for (const [key, value] of espnRequestWindows) if (now >= value.resetAt) espnRequestWindows.delete(key);
  if (espnLeagueCooldowns.size > 5_000) for (const [key, value] of espnLeagueCooldowns) if (now >= value) espnLeagueCooldowns.delete(key);
  return next();
}

const PALETTE = ['#FF6B3D','#216869','#5C4DFF','#E05252','#F3A712','#8C5EFC','#E8488A','#1479FF','#0D9F6E','#AD5D4E','#3B4CCA','#EF8354'];

app.get('/api/health', (_req, res) => res.json({ ok: true }));

function matchupScore(side, period, settings) {
  if (!side) return 0;
  const scoringPeriods = settings.matchupPeriods?.[String(period)] || settings.matchupPeriods?.[period] || [period];
  const byPeriod = side.pointsByScoringPeriod || {};
  const periodTotal = scoringPeriods.reduce((sum, id) => sum + Number(byPeriod[id] ?? byPeriod[String(id)] ?? 0), 0);
  const candidates = [side.totalPointsLive, side.totalPoints, side.adjustedPoints, side.points];
  const nonzero = candidates.map(Number).find((value) => Number.isFinite(value) && value !== 0);
  if (Number.isFinite(nonzero)) return nonzero;
  if (Number.isFinite(periodTotal) && periodTotal !== 0) return periodTotal;
  return 0;
}

function normalizeLeague(data, year) {
  const teams = (data.teams || []).slice(0, 32).map((team, index) => ({
    id: `espn-${team.id}`,
    espnId: team.id,
    name: team.name || [team.location, team.nickname].filter(Boolean).join(' ') || team.abbrev || `Team ${team.id}`,
    abbrev: team.abbrev || '',
    logo: team.logo || '',
    color: PALETTE[index % PALETTE.length],
    divisionId: team.divisionId ?? 0,
    playoffSeed: Number(team.playoffSeed || 0),
    record: {
      wins: Number(team.record?.overall?.wins || 0), losses: Number(team.record?.overall?.losses || 0), ties: Number(team.record?.overall?.ties || 0),
      pointsFor: Number(team.record?.overall?.pointsFor || 0), pointsAgainst: Number(team.record?.overall?.pointsAgainst || 0), percentage: Number(team.record?.overall?.percentage || 0)
    }
  }));
  const validIds = new Set(teams.map(({ espnId }) => espnId));
  const settings = data.settings?.scheduleSettings || {};
  const regularWeeks = Number(settings.matchupPeriodCount || 0);
  const currentPeriod = Number(data.status?.currentMatchupPeriod || 0);
  const grouped = new Map();
  for (const matchup of data.schedule || []) {
    const homeId = matchup.home?.teamId;
    const awayId = matchup.away?.teamId;
    if (!validIds.has(homeId) || !validIds.has(awayId)) continue;
    const period = Number(matchup.matchupPeriodId || 1);
    if (!grouped.has(period)) grouped.set(period, []);
    const homeScore = matchupScore(matchup.home, period, settings);
    const awayScore = matchupScore(matchup.away, period, settings);
    const completed = matchup.winner === 'HOME' || matchup.winner === 'AWAY' || matchup.winner === 'TIE';
    const inProgress = !completed && period === currentPeriod;
    grouped.get(period).push({
      home: `espn-${homeId}`, away: `espn-${awayId}`, homeScore, awayScore, completed, inProgress,
      actualWinner: matchup.winner === 'HOME' ? `espn-${homeId}` : matchup.winner === 'AWAY' ? `espn-${awayId}` : null,
      isPlayoff: regularWeeks > 0 && period > regularWeeks
    });
  }
  const periods = [...grouped.keys()].sort((a,b) => a-b);
  return {
    name: data.settings?.name || `ESPN League ${data.id || ''}`.trim(),
    source: { provider: 'ESPN', leagueId: String(data.id || ''), year, importedAt: new Date().toISOString(), currentMatchupPeriod: currentPeriod },
    teams,
    schedule: periods.map((period) => ({ label: `Week ${period}`, period, games: grouped.get(period) })),
    picks: {},
    predictedScores: {},
    hypotheticalResults: {},
    playoffPicks: {},
    lockLiveGames: true,
    playoffTeamCount: Number(settings.playoffTeamCount || 4),
    regularSeasonWeeks: regularWeeks || periods.length,
    playoffSettings: {
      teamCount: Number(settings.playoffTeamCount || 4),
      matchupPeriodLength: Number(settings.playoffMatchupPeriodLength || 1),
      seedingRule: settings.playoffSeedingRule || 'TOTAL_POINTS_SCORED',
      seedingRuleBy: settings.playoffSeedingRuleBy ?? 0,
      matchupPeriods: settings.matchupPeriods || {},
      divisions: settings.divisions || [],
      manuallyEdited: Boolean(data.status?.isPlayoffMatchupEdited)
    }
  };
}

app.post('/api/espn/import', espnRateLimit, async (req, res) => {
  const { leagueId, year, espnS2 = '', swid = '' } = req.body || {};
  const currentYear = new Date().getFullYear();
  if (!/^\d{1,15}$/.test(String(leagueId || ''))) return res.status(400).json({ error: 'Enter a valid numeric ESPN league ID.' });
  if (!Number.isInteger(Number(year)) || Number(year) < 2018 || Number(year) > currentYear + 1) return res.status(400).json({ error: 'Enter a valid ESPN season.' });
  if ((espnS2 && !swid) || (!espnS2 && swid)) return res.status(400).json({ error: 'Private leagues require both ESPN_S2 and SWID.' });
  if (String(espnS2).length > 2000 || String(swid).length > 100) return res.status(400).json({ error: 'Credential value is too long.' });

  const views = ['mTeam','mMatchup','mMatchupScore','mSettings','mStatus','mLiveScoring','mScoreboard'];
  const url = new URL(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${Number(year)}/segments/0/leagues/${leagueId}`);
  views.forEach((view) => url.searchParams.append('view', view));
  const headers = { Accept: 'application/json', 'User-Agent': 'Matchday schedule importer' };
  if (espnS2 && swid) headers.Cookie = `espn_s2=${espnS2}; SWID=${swid}`;
  try {
    let response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    // ESPN stores completed seasons on a separate leagueHistory route.
    if (response.status === 404 && Number(year) < currentYear) {
      const historyUrl = new URL(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}`);
      historyUrl.searchParams.set('seasonId', String(Number(year)));
      views.forEach((view) => historyUrl.searchParams.append('view', view));
      response = await fetch(historyUrl, { headers, signal: AbortSignal.timeout(15000) });
    }
    if (response.status === 401 || response.status === 403) return res.status(401).json({ error: 'ESPN denied access. Check the league ID and refresh your ESPN_S2 and SWID cookies.' });
    if (!response.ok) return res.status(response.status).json({ error: `ESPN returned ${response.status}. The league or season may not exist.` });
    const payload = await response.json();
    const leagueData = Array.isArray(payload) ? payload[0] : payload;
    if (!leagueData) return res.status(404).json({ error: `No ESPN league data was found for the ${year} season.` });
    const league = normalizeLeague(leagueData, Number(year));
    if (!league.teams.length) return res.status(422).json({ error: 'ESPN returned the league, but no teams were found.' });
    return res.json(league);
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'ESPN took too long to respond.' : 'Could not reach ESPN. Try again shortly.';
    return res.status(502).json({ error: message });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError) return res.status(400).json({ error: 'The request contained invalid JSON.' });
  console.error('Unhandled API error:', error);
  return res.status(500).json({ error: 'The import server encountered an unexpected error.' });
});

app.listen(port, () => console.log(`Matchday API listening on http://localhost:${port}`));
