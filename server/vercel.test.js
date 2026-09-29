import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import app from '../api/espn/import.js';
import health from '../api/health.js';
import shared from '../api/shared.js';

test('Vercel exports handle health, validation, and ESPN import', async () => {
  assert.equal(app, health);
  assert.equal(app, shared);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  let espnCalls = 0;
  const envNames = ['ESPN_LEAGUE_ID', 'ESPN_SEASON', 'ESPN_SWID', 'ESPN_S2', 'SHARED_LEAGUE', 'SHARED_ESPN_COOKIE', 'SHARED_LEAGUE_ENABLED', 'SHARED_LEAGUE_SLUG', 'SHARED_LEAGUE_ID', 'SHARED_LEAGUE_YEAR', 'SHARED_LEAGUE_SWID', 'SHARED_LEAGUE_ESPN_S2'];
  const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  for (const name of envNames) delete process.env[name];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith(origin)) return originalFetch(url, options);
    assert.equal(new URL(url).hostname, 'lm-api-reads.fantasy.espn.com');
    espnCalls++;
    if (espnCalls >= 2) {
      assert.match(String(url), /leagues\/456\?/);
      assert.equal(options.headers.Cookie, 'espn_s2=test-private-cookie; SWID={test-swid}');
    }
    return Response.json({ id: 123, settings: { name: 'Test league', scheduleSettings: {} },
      teams: [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }],
      schedule: [{ home: { teamId: 1, totalPoints: 100 }, away: { teamId: 2, totalPoints: 90 }, winner: 'HOME', matchupPeriodId: 1 }] });
  };
  try {
    const healthResponse = await fetch(`${origin}/api/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), { ok: true });
    const invalid = await fetch(`${origin}/api/espn/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leagueId: 'invalid', year: 2025 })
    });
    assert.equal(invalid.status, 400);
    assert.equal(espnCalls, 0);
    const imported = await fetch(`${origin}/api/espn/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leagueId: '123', year: 2025 })
    });
    assert.equal(imported.status, 200);
    const league = await imported.json();
    assert.equal(league.name, 'Test league');
    assert.equal(league.teams.length, 2);
    assert.equal(league.schedule[0].games[0].homeScore, 100);
    assert.equal(espnCalls, 1);

    process.env.SHARED_LEAGUE_ENABLED = 'false';
    assert.equal((await fetch(`${origin}/api/shared?slug=my-league`)).status, 503);
    Object.assign(process.env, {
      SHARED_LEAGUE_ENABLED: 'true', SHARED_LEAGUE_SLUG: 'my-league',
      SHARED_LEAGUE_ID: '456', SHARED_LEAGUE_YEAR: '2026',
      SHARED_LEAGUE_SWID: '{test-swid}', SHARED_LEAGUE_ESPN_S2: 'test-private-cookie'
    });
    assert.equal((await fetch(`${origin}/api/shared?slug=wrong`)).status, 404);
    const sharedResponse = await fetch(`${origin}/api/shared?slug=my-league&leagueId=999&swid=attacker`);
    assert.equal(sharedResponse.status, 200);
    assert.equal(sharedResponse.headers.get('cache-control'), 'no-store');
    const sharedText = await sharedResponse.text();
    assert.equal(JSON.parse(sharedText).name, 'Test league');
    assert.ok(!sharedText.includes('test-private-cookie'));
    assert.ok(!sharedText.includes('test-swid'));
    assert.equal(espnCalls, 2);
    Object.assign(process.env, { SHARED_LEAGUE: '456:2026', SHARED_ESPN_COOKIE: 'SWID={test-swid}; espn_s2=test-private-cookie', SHARED_LEAGUE_ENABLED: 'false', SHARED_LEAGUE_SLUG: 'old-link' });
    const compact = await fetch(`${origin}/api/shared?slug=my-league&leagueId=999`);
    assert.equal(compact.status, 200);
    const compactText = await compact.text();
    assert.ok(!compactText.includes('test-private-cookie'));
    assert.ok(!compactText.includes('test-swid'));
    assert.equal(espnCalls, 3);
    process.env.SHARED_LEAGUE = 'off';
    assert.equal((await fetch(`${origin}/api/shared?slug=my-league`)).status, 503);
    assert.equal(espnCalls, 3);
    delete process.env.SHARED_LEAGUE;
    process.env.SHARED_LEAGUE_ENABLED = 'true';
    process.env.SHARED_LEAGUE_SLUG = 'my-league';
    delete process.env.SHARED_LEAGUE_ID;
    assert.equal((await fetch(`${origin}/api/shared?slug=my-league`)).status, 503);
    assert.equal(espnCalls, 3);
    Object.assign(process.env, { ESPN_LEAGUE_ID: '456', ESPN_SEASON: '2026', ESPN_SWID: '{test-swid}', ESPN_S2: 'test-private-cookie', SHARED_LEAGUE: 'off' });
    const separate = await fetch(`${origin}/api/shared?slug=my-league&leagueId=999`);
    assert.equal(separate.status, 200);
    const separateText = await separate.text();
    assert.equal(JSON.parse(separateText).name, 'Test league');
    assert.ok(!separateText.includes('test-private-cookie'));
    assert.ok(!separateText.includes('test-swid'));
    assert.equal(espnCalls, 4);
  } finally {
    for (const name of envNames) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
    globalThis.fetch = originalFetch;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
