import { useEffect, useState } from 'react';

export async function fetchSharedLeague(slug, signal) {
  const response = await fetch(`/api/shared?slug=${encodeURIComponent(slug)}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load this league.');
  return data;
}

export function RefreshSharedLeague({ slug, onRefresh, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    setLoading(true); setError('');
    try { onRefresh(await fetchSharedLeague(slug)); }
    catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="refresh-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={onClose}>×</button><h2>Update shared league</h2><p>Retrieve the latest ESPN scores while keeping your predictions.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={loading} onClick={refresh}>{loading ? 'Refreshing…' : 'Refresh scores'}</button></div></div>;
}

export default function SharedLeague({ slug, Dashboard }) {
  const [league, setLeague] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const storageKey = `matchday-shared-v1:${slug}`;
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetchSharedLeague(slug, controller.signal).then(fresh => {
      let saved;
      try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
      const sameLeague = saved?.source?.leagueId === fresh.source.leagueId && saved?.source?.year === fresh.source.year;
      setLeague({ ...fresh, ...(sameLeague ? {
        picks: saved.picks || {}, predictedScores: saved.predictedScores || {},
        hypotheticalResults: saved.hypotheticalResults || {}, playoffPicks: saved.playoffPicks || {},
        lockLiveGames: saved.lockLiveGames ?? true
      } : {}) });
    }).catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  }, [slug, storageKey, attempt]);
  useEffect(() => {
    if (league) { try { localStorage.setItem(storageKey, JSON.stringify(league)); } catch {} }
  }, [league, storageKey]);
  if (!league) return <main><section className="dashboard"><h1>{error ? 'League unavailable' : 'Loading shared league…'}</h1>{error && <><p role="alert">{error}</p><button className="refresh-button" onClick={() => setAttempt(value => value + 1)}>Try again</button></>}<p><a href="/">Back to league setup</a></p></section></main>;
  if (!league.schedule.length) return <main><section className="dashboard"><h1>{league.name}</h1><p>This league does not have a schedule yet.</p><a href="/">Back to league setup</a></section></main>;
  return <><div className="bracket-note">Shared league · Your predictions are saved only in this browser. <a href="/">Create or import your own league</a></div><Dashboard league={league} setLeague={setLeague} sharedSlug={slug}/></>;
}
