import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import app from '../api/espn/import.js';
import health from '../api/health.js';

test('Vercel exports handle health, validation, and ESPN import', async () => {
  assert.equal(app, health);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  let espnCalls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith(origin)) return originalFetch(url, options);
    assert.equal(new URL(url).hostname, 'lm-api-reads.fantasy.espn.com');
    espnCalls++;
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
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
