export function calculateAverages(league, scope = 'completed', resolveOutcome) {
  const overall = league.teams.map(team => ({ ...team, total: 0, count: 0 }));
  const byId = new Map(overall.map(team => [team.id, team]));
  const weeks = league.schedule.map((week, w) => {
    const scores = new Map();
    week.games.forEach((game, g) => {
      if (game.isPlayoff || (scope === 'completed' && !game.completed)) return;
      const result = scope === 'completed' ? game : resolveOutcome(league, game, `${w}-${g}`);
      for (const side of ['home', 'away']) {
        const score = result[`${side}Score`];
        if (byId.has(game[side]) && Number.isFinite(score)) scores.set(game[side], score);
      }
    });
    const total = [...scores.values()].reduce((sum, score) => sum + score, 0);
    scores.forEach((score, id) => { byId.get(id).total += score; byId.get(id).count++; });
    return { label: week.label, scores, average: scores.size ? total / scores.size : null };
  });
  const total = overall.reduce((sum, team) => sum + team.total, 0);
  const count = overall.reduce((sum, team) => sum + team.count, 0);
  return { weeks, average: count ? total / count : null, count,
    teams: overall.map(team => ({ ...team, average: team.count ? team.total / team.count : null })) };
}
