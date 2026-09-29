import { useMemo, useState } from 'react';
import { calculateAverages } from './averages.js';
import './averages.css';

function Comparison({ score, average }) {
  if (score == null || average == null) return <span>—</span>;
  const difference = Math.round((score - average) * 100) / 100;
  return <span className={`average-difference ${difference > 0 ? 'above' : difference < 0 ? 'below' : ''}`}>
    {difference > 0 ? '+' : ''}{difference.toFixed(2)} · {difference > 0 ? 'Above' : difference < 0 ? 'Below' : 'At average'}
  </span>;
}

export default function Averages({ league, resolveOutcome }) {
  const [scope, setScope] = useState('completed');
  const [view, setView] = useState('overall');
  const data = useMemo(() => calculateAverages(league, scope, resolveOutcome), [league, scope, resolveOutcome]);
  const selected = view === 'overall' ? null : data.weeks[Number(view)];
  const average = selected ? selected.average : data.average;
  const rows = data.teams.map(team => ({ ...team, score: selected ? selected.scores.get(team.id) ?? null : team.average }))
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.name.localeCompare(b.name));
  return <div className="tab-panel">
    <div className="standings-controls"><div><label htmlFor="average-view">Compare scoring</label><select id="average-view" value={view} onChange={event => setView(event.target.value)}>
      <option value="overall">Overall</option>{data.weeks.map((week, index) => <option key={index} value={index}>{week.label}</option>)}
    </select></div><div className="scope-toggle"><button className={scope === 'completed' ? 'active' : ''} onClick={() => setScope('completed')}>Completed only</button><button className={scope === 'projected' ? 'active' : ''} onClick={() => setScope('projected')}>Live + predictions</button></div></div>
    <div className="average-summary"><span>{selected ? `${selected.label} league average` : 'Overall league average'}<strong>{average == null ? '—' : average.toFixed(2)} <small>pts / team{selected ? '' : ' / week'}</small></strong></span><p>{selected ? `${selected.scores.size} of ${league.teams.length} teams with scores` : `${data.count} team scores included`}</p></div>
    <p className="average-note">Regular season only. Overall compares each team’s average points per scored week with the league average across all available team scores. Missing scores and winner-only picks are excluded; zero scores count.{scope === 'projected' && ' Includes live, predicted, and hypothetical scores as shown in Schedule; live scores are provisional.'}</p>
    {average == null && <p className="average-empty">No {scope === 'completed' ? 'completed ' : ''}scores available{selected ? ` for ${selected.label}` : ''}. {scope === 'completed' ? 'Try Live + predictions to compare entered scores.' : 'Enter scores in Schedule to see comparisons.'}</p>}
    <div className="table-wrap"><table><thead><tr><th>Team</th>{!selected && <><th>Scored weeks</th><th>Total points</th></>}<th>{selected ? 'Points' : 'Avg / week'}</th><th>Vs. league avg</th></tr></thead><tbody>{rows.map(team => <tr key={team.id}><td><span className="stand-team"><i style={{ background: team.color }}/>{team.name}</span></td>{!selected && <><td>{team.count}</td><td>{team.count ? team.total.toFixed(2) : '—'}</td></>}<td>{team.score == null ? '—' : team.score.toFixed(2)}</td><td><Comparison score={team.score} average={average}/></td></tr>)}</tbody></table></div>
  </div>;
}
