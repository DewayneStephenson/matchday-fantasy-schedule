import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedLeagueConfig } from './shared-config.js';

test('four separate fields override old formats and preserve cookie encoding', () => {
  const config = sharedLeagueConfig({ ESPN_LEAGUE_ID: ' 456 ', ESPN_SEASON: ' 2026 ', ESPN_SWID: ' {example} ', ESPN_S2: 'abc%2B=def', SHARED_LEAGUE: 'off', SHARED_ESPN_COOKIE: 'invalid', SHARED_LEAGUE_ENABLED: 'false' });
  assert.deepEqual(config, { enabled: true, slug: 'my-league', leagueId: '456', year: 2026, swid: '{example}', espnS2: 'abc%2B=def' });
  assert.equal(sharedLeagueConfig({ ESPN_LEAGUE_ID: 'off', SHARED_LEAGUE: '123:2026' }).enabled, false);
  assert.equal(sharedLeagueConfig({ ESPN_LEAGUE_ID: '456', ESPN_SEASON: '2026' }).enabled, true);
});

test('separate fields reject missing settings and malformed credentials without exposing them', () => {
  const base = { ESPN_LEAGUE_ID: '456', ESPN_SEASON: '2026', ESPN_SWID: '{private-value}', ESPN_S2: 'private-value' };
  for (const env of [
    { ...base, ESPN_LEAGUE_ID: '' }, { ...base, ESPN_SEASON: '' },
    { ...base, ESPN_SEASON: '2017' }, { ...base, ESPN_S2: '' },
    { ...base, ESPN_SWID: 'SWID={private-value}' },
    { ...base, ESPN_S2: 'espn_s2=private-value' },
    { ...base, ESPN_S2: 'private-value; other=value' },
    { ...base, ESPN_S2: 'private-value\nvalue' },
    { ESPN_S2: 'private-value', SHARED_LEAGUE: '456:2026' }
  ]) {
    const result = sharedLeagueConfig(env);
    assert.ok(result.error);
    assert.ok(!result.error.includes('private-value'));
  }
});

test('compact configuration enables public or private sharing and overrides old values', () => {
  const config = sharedLeagueConfig({ SHARED_LEAGUE: ' 123:2026 ', SHARED_ESPN_COOKIE: 'SWID={example}; espn_s2=abc=def%2B;', SHARED_LEAGUE_ENABLED: 'false', SHARED_LEAGUE_SLUG: 'old' });
  assert.deepEqual(config, { enabled: true, slug: 'my-league', leagueId: '123', year: 2026, swid: '{example}', espnS2: 'abc=def%2B' });
  const publicLeague = sharedLeagueConfig({ SHARED_LEAGUE: '123' });
  assert.equal(publicLeague.year, new Date().getFullYear());
  assert.equal(publicLeague.swid, '');
  assert.equal(publicLeague.enabled, true);
  assert.equal(sharedLeagueConfig({ SHARED_LEAGUE: ' OFF ', SHARED_LEAGUE_ENABLED: 'true' }).enabled, false);
});

test('invalid configuration produces useful errors without exposing values', () => {
  for (const env of [
    { SHARED_LEAGUE: 'not-a-league' },
    { SHARED_LEAGUE: '123:2017' },
    { SHARED_LEAGUE: '123', SHARED_ESPN_COOKIE: 'SWID={secret}' },
    { SHARED_LEAGUE: '123', SHARED_ESPN_COOKIE: 'SWID={secret}; other=secret' },
    { SHARED_LEAGUE: '123', SHARED_ESPN_COOKIE: 'SWID={secret}; espn_s2=secret\n' + 'x' },
    { SHARED_LEAGUE: '123', SHARED_ESPN_COOKIE: 'SWID={secret}; SWID={secret}; espn_s2=secret' }
  ]) {
    const config = sharedLeagueConfig(env);
    assert.ok(config.error);
    assert.ok(!config.error.includes('secret'));
  }
  assert.equal(sharedLeagueConfig({ SHARED_LEAGUE_ENABLED: ' true ', SHARED_LEAGUE_SLUG: 'custom' }).slug, 'custom');
});
