import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedLeagueConfig } from './shared-config.js';

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
