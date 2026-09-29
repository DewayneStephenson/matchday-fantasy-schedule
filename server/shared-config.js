export function sharedLeagueConfig(env = process.env) {
  // The compact setup takes precedence over every legacy setting.
  if (env.SHARED_LEAGUE !== undefined) {
    const value = env.SHARED_LEAGUE.trim();
    if (!value || value.toLowerCase() === 'off') return { enabled: false };
    const match = value.match(/^(\d{1,15})(?::(\d{4}))?$/);
    if (!match) return { error: 'Set SHARED_LEAGUE to your league ID and season, for example 123456:2026, then redeploy.' };
    const year = Number(match[2] || new Date().getFullYear());
    if (year < 2018 || year > new Date().getFullYear() + 1) return { error: 'SHARED_LEAGUE contains an invalid season. Use a season from 2018 through next year.' };
    const cookie = (env.SHARED_ESPN_COOKIE || '').trim();
    const values = {};
    if (cookie) {
      if (cookie.length > 2200 || /[\r\n]/.test(cookie)) return { error: 'SHARED_ESPN_COOKIE must be a single line containing SWID and espn_s2.' };
      for (const part of cookie.split(';').map(value => value.trim()).filter(Boolean)) {
        const separator = part.indexOf('=');
        const key = part.slice(0, separator).toLowerCase();
        if (separator < 1 || !['swid', 'espn_s2'].includes(key) || values[key]) {
          return { error: 'Use this format for SHARED_ESPN_COOKIE: SWID={your-swid}; espn_s2=your-cookie' };
        }
        values[key] = part.slice(separator + 1).trim();
      }
      if (!values.swid || !values.espn_s2) return { error: 'SHARED_ESPN_COOKIE needs both SWID and espn_s2 for a private league.' };
    }
    return { enabled: true, slug: 'my-league', leagueId: match[1], year, swid: values.swid || '', espnS2: values.espn_s2 || '' };
  }
  return {
    enabled: env.SHARED_LEAGUE_ENABLED?.trim().toLowerCase() === 'true',
    slug: env.SHARED_LEAGUE_SLUG?.trim() || 'my-league',
    leagueId: env.SHARED_LEAGUE_ID, year: env.SHARED_LEAGUE_YEAR,
    swid: env.SHARED_LEAGUE_SWID || '', espnS2: env.SHARED_LEAGUE_ESPN_S2 || ''
  };
}
