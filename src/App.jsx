import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'matchday-league-v3';
const COLORS = ['#FF6B3D','#216869','#5C4DFF','#E05252','#F3A712','#8C5EFC','#E8488A','#1479FF','#0D9F6E','#AD5D4E','#3B4CCA','#EF8354','#2E86AB','#A23B72','#3C896D','#DAA520'];
const EMPTY = { name:'', teams:[], schedule:[], picks:{}, predictedScores:{}, hypotheticalResults:{}, playoffPicks:{}, lockLiveGames:true, playoffTeamCount:4, regularSeasonWeeks:14, playoffSettings:null };

function loadLeague(){try{return {...EMPTY,...JSON.parse(localStorage.getItem(STORAGE_KEY))}}catch{return {...EMPTY}}}
function textColor(hex){const c=hex.replace('#','');const [r,g,b]=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16));return(r*299+g*587+b*114)/1000>145?'#071512':'#fff'}
function buildSchedule(teams,weekCount){
  const ids=teams.map(t=>t.id);if(ids.length%2)ids.push(null);const rounds=[];
  for(let r=0;r<ids.length-1;r++){const games=[];for(let i=0;i<ids.length/2;i++){const a=ids[i],b=ids[ids.length-1-i];if(a&&b)games.push(r%2?{home:b,away:a}:{home:a,away:b})}rounds.push(games);ids.splice(1,0,ids.pop())}
  return Array.from({length:weekCount},(_,i)=>({label:`Week ${i+1}`,period:i+1,games:rounds[i%rounds.length].map((g)=>i<rounds.length?g:{home:g.away,away:g.home})}));
}

function outcomeFor(league,game,key){
  const hypothetical=league.hypotheticalResults?.[key];
  if(hypothetical){
    const homeScore=hypothetical.home===''||hypothetical.home==null?null:Number(hypothetical.home),awayScore=hypothetical.away===''||hypothetical.away==null?null:Number(hypothetical.away);
    const scoreWinner=Number.isFinite(homeScore)&&Number.isFinite(awayScore)?(homeScore===awayScore?null:homeScore>awayScore?game.home:game.away):null;
    return {winner:scoreWinner||hypothetical.winner||null,homeScore,awayScore,actual:false,hypothetical:true};
  }
  if(game.completed)return {winner:game.actualWinner,homeScore:game.homeScore,awayScore:game.awayScore,actual:true};
  const predicted=league.predictedScores?.[key];
  if(game.inProgress&&((league.lockLiveGames??true)||(!predicted&&!league.picks[key]))){
    const homeScore=Number(game.homeScore||0),awayScore=Number(game.awayScore||0);
    return {winner:homeScore===awayScore?null:homeScore>awayScore?game.home:game.away,homeScore,awayScore,actual:false,live:true};
  }
  const homeScore=predicted?.home===''||predicted?.home==null?null:Number(predicted.home);
  const awayScore=predicted?.away===''||predicted?.away==null?null:Number(predicted.away);
  if(Number.isFinite(homeScore)&&Number.isFinite(awayScore))return {winner:homeScore===awayScore?null:homeScore>awayScore?game.home:game.away,homeScore,awayScore,actual:false};
  return {winner:league.picks[key]||null,homeScore,awayScore,actual:false};
}

function liveOutcome(game){
  const homeScore=Number(game.homeScore||0),awayScore=Number(game.awayScore||0);
  return {winner:homeScore===awayScore?null:homeScore>awayScore?game.home:game.away,homeScore,awayScore,live:true};
}

function bracketSeedOrder(size){
  let order=[1];
  while(order.length<size){const nextSize=order.length*2;order=order.flatMap(seed=>[seed,nextSize+1-seed])}
  return order;
}

function projectedBracketRounds(seeded,size,picks={}){
  const bySeed=Object.fromEntries(seeded.map(entry=>[entry.seed,entry]));
  let slots=bracketSeedOrder(size).map(seed=>bySeed[seed]||null);const rounds=[],validPicks={};let round=0;
  while(slots.length>1){
    const games=[];for(let i=0;i<slots.length;i+=2){const a=slots[i],b=slots[i+1],key=`r${round}-g${i/2}`,saved=picks[key],pick=typeof saved==='string'?saved:saved?.winner,signature=`${a?.team?.id||'TBD'}|${b?.team?.id||'TBD'}`,selectable=Boolean(a?.team&&b?.team),sameMatchup=typeof saved==='object'&&saved?.participants===signature,winner=selectable&&sameMatchup&&[a.team.id,b.team.id].includes(pick)?(a.team.id===pick?a:b):null;if(winner)validPicks[key]={winner:pick,participants:signature};games.push({a,b,key,winner,selectable,signature})}rounds.push(games);
    slots=games.map(({a,b,winner})=>{if(round===0&&a&&!b)return a;if(round===0&&b&&!a)return b;return winner||{label:'TBD',pending:true}});round++;
  }
  return {rounds,validPicks};
}

function Header({active,onReset}){return <header className="topbar"><a className="brand" href="#"><span className="brand-mark">M</span><span>matchday</span></a><div className="top-actions"><span className="save-state"><span/> Saved locally</span>{active&&<button className="icon-button" onClick={onReset} aria-label="Start a new league">↻</button>}</div></header>}

function TeamLogo({team}){
  const [failed,setFailed]=useState(false);
  if(team.logo&&!failed)return <img src={team.logo} alt="" onError={()=>setFailed(true)}/>;
  return <svg className="helmet-fallback" viewBox="0 0 64 64" aria-hidden="true"><path fill="#fff" d="M11 35C11 19 21 9 37 9c13 0 21 9 21 23v7H43c-3 0-5 2-5 5v4H25v-9H11v-4Z"/><path fill={team.color} d="M16 34c0-13 8-20 21-20 10 0 16 7 16 18v2H39c-4 0-7 3-7 7v2h-3v-9H16Z"/><path fill="#071512" d="M25 34h5v19h17v-5H35v-7c0-5 3-8 8-8h15v6H43c-2 0-3 1-3 3v1h12v15H24V40H11v-6h14Z"/><path fill="#fff" opacity=".75" d="M20 27c3-7 8-10 16-11-5 3-8 7-9 12l-7-1Z"/></svg>;
}

function EspnImport({onImport,onBack}){
  const [form,setForm]=useState({leagueId:'',year:String(new Date().getFullYear()),espnS2:'',swid:''});
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const change=e=>setForm({...form,[e.target.name]:e.target.value});
  async function submit(e){
    e.preventDefault();setLoading(true);setError('');
    try{
      const response=await fetch('/api/espn/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const body=await response.text();
      let data;
      try{data=body?JSON.parse(body):null}catch{throw new Error(`The import server returned an unreadable response (${response.status}).`)}
      if(!response.ok)throw new Error(data?.error||`Import failed (${response.status}).`);
      if(!data)throw new Error('The import server returned no data. Make sure you started the app with “npm run dev”, not only the Vite web server.');
      onImport(data);
    }catch(err){
      setError(err instanceof TypeError?'Could not reach the import server. Start both services with “npm run dev” and try again.':err.message);
    }finally{setLoading(false)}
  }
  return <div><button className="back-button" onClick={onBack}>← Back</button><span className="step-label">ESPN IMPORT</span><h2>Bring in your league.</h2><p>Import teams, the full weekly schedule, completed scores, and ESPN playoff matchups.</p><form className="import-form" onSubmit={submit}><div className="field-grid"><div><label htmlFor="leagueId">League ID</label><input id="leagueId" name="leagueId" inputMode="numeric" value={form.leagueId} onChange={change} placeholder="123456789" required/></div><div><label htmlFor="year">Season</label><input id="year" name="year" type="number" min="2018" max={new Date().getFullYear()+1} value={form.year} onChange={change} required/></div></div><details><summary>Private league credentials</summary><div className="credential-note">These values are sent only to this server for the import and are not saved by Matchday. Treat ESPN_S2 like a password.</div><label htmlFor="swid">SWID</label><input id="swid" name="swid" type="password" autoComplete="off" value={form.swid} onChange={change} placeholder="{XXXXXXXX-...}"/><label htmlFor="espnS2">ESPN_S2</label><textarea id="espnS2" name="espnS2" autoComplete="off" value={form.espnS2} onChange={change} rows="3" placeholder="Paste the full cookie value"/></details>{error&&<div className="form-error">{error}</div>}<button className="primary-button" disabled={loading}>{loading?'Connecting to ESPN…':'Import league'} <span>→</span></button></form></div>
}

function Setup({league,setLeague,onCreate}){
  const [mode,setMode]=useState(league.name?'manual':null);const [step,setStep]=useState(league.name?2:1);const [leagueName,setLeagueName]=useState(league.name);const [teamName,setTeamName]=useState('');const [color,setColor]=useState(COLORS[league.teams.length%COLORS.length]);const [weeks,setWeeks]=useState(league.regularSeasonWeeks||14);const [playoffTeams,setPlayoffTeams]=useState(league.playoffTeamCount||4);const remaining=Math.max(0,4-league.teams.length);
  function submitLeague(e){e.preventDefault();if(!leagueName.trim())return;setLeague(c=>({...c,name:leagueName.trim()}));setStep(2)}
  function addTeam(e){e.preventDefault();const name=teamName.trim();if(!name||league.teams.length>=32||league.teams.some(t=>t.name.toLowerCase()===name.toLowerCase()))return;const id=crypto.randomUUID?.()||`${Date.now()}-${league.teams.length}`;setLeague(c=>({...c,teams:[...c.teams,{id,name,color}]}));setTeamName('');setColor(COLORS[(league.teams.length+1)%COLORS.length])}
  const finish=()=>onCreate(Number(weeks),Math.min(Number(playoffTeams),league.teams.length));
  return <main><section className="setup-shell"><div className="eyebrow"><span>01</span> League builder</div><div className="setup-grid"><div className="intro"><h1>Build your league.<br/><em>Call every game.</em></h1><p>Create up to 32 teams manually or securely import an existing ESPN league and its schedule.</p><div className="season-preview" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="preview-card card-a"><span>WEEK 01</span><strong>Home opener</strong><i/></div><div className="preview-card card-b"><span>YOUR LEAGUE</span><strong>{league.teams.length} teams</strong><div className="mini-bars"><i/><i/><i/></div></div></div></div><div className="builder-card">
    {!mode?<div><span className="step-label">GET STARTED</span><h2>How are you playing?</h2><p>Start from scratch or pull in your ESPN teams and schedule.</p><div className="choice-stack"><button onClick={()=>setMode('espn')}><strong>Import from ESPN</strong><small>Teams, weeks, results & playoffs</small><span>→</span></button><button onClick={()=>setMode('manual')}><strong>Create manually</strong><small>Build a custom league</small><span>→</span></button></div></div>:mode==='espn'?<EspnImport onBack={()=>setMode(null)} onImport={setLeague}/>:<><div className="step-line"><span className="active"/><span className={step===2?'active':''}/></div>{step===1?<div><button className="back-button" onClick={()=>setMode(null)}>← Back</button><span className="step-label">STEP 1 OF 2</span><h2>Name your league.</h2><p>This is your season. Give it a name worth playing for.</p><form onSubmit={submitLeague}><label htmlFor="league-name">League name</label><input id="league-name" type="text" maxLength="40" value={leagueName} onChange={e=>setLeagueName(e.target.value)} placeholder="Sunday Legends" required/><button className="primary-button">Build my league <span>→</span></button></form></div>:<div><div className="builder-heading"><div><span className="step-label">STEP 2 OF 2</span><h2>Add your teams.</h2></div><span className="team-counter">{league.teams.length} / 32</span></div><p>Add 4–32 teams, then customize the season length and playoff field.</p><form onSubmit={addTeam}><label htmlFor="team-name">Team name</label><div className="team-entry"><input id="team-name" type="text" maxLength="28" value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="Gridiron Giants"/><button className="add-button">+</button></div><div className="color-row"><label>Team color</label><div className="color-control"><input type="color" value={color} onChange={e=>setColor(e.target.value)}/><span>{color.toUpperCase()}</span></div></div></form><div className="team-list">{league.teams.map(t=><div className="team-item" key={t.id}><span className="team-dot" style={{background:t.color}}/><span>{t.name}</span><button onClick={()=>setLeague(c=>({...c,teams:c.teams.filter(x=>x.id!==t.id)}))}>×</button></div>)}</div><div className="season-fields"><div><label>Regular-season weeks</label><input type="number" min="1" max="32" value={weeks} onChange={e=>setWeeks(e.target.value)}/></div><div><label>Playoff teams</label><select value={playoffTeams} onChange={e=>setPlayoffTeams(e.target.value)}>{[2,4,8,16].map(n=><option key={n} value={n}>{n}</option>)}</select></div></div><button className="primary-button" disabled={remaining>0} onClick={finish}>Create season <span>→</span></button><small className="helper">{remaining?`Add ${remaining} more team${remaining===1?'':'s'} to continue`:`${league.teams.length} teams ready`}</small></div>}</>}
  </div></div></section></main>
}

function calculateStandings(league,scope='live'){
  const rows=league.teams.map(t=>({...t,wins:0,losses:0,ties:0,pointsFor:0,pointsAgainst:0,games:0,divisionWins:0,divisionLosses:0,divisionTies:0}));
  const byId=Object.fromEntries(rows.map(t=>[t.id,t]));const headToHead={};
  league.schedule.forEach((week,w)=>week.games.forEach((game,g)=>{
    if(game.isPlayoff||scope==='completed'&&!game.completed)return;
    const result=scope==='completed'?{winner:game.actualWinner,homeScore:game.homeScore,awayScore:game.awayScore,actual:true}:game.inProgress?liveOutcome(game):outcomeFor(league,game,`${w}-${g}`);const hasScores=Number.isFinite(result.homeScore)&&Number.isFinite(result.awayScore);if(!result.winner&&!hasScores)return;
    const home=byId[game.home],away=byId[game.away];if(!home||!away)return;
    if(Number.isFinite(result.homeScore)&&Number.isFinite(result.awayScore)){home.pointsFor+=result.homeScore;home.pointsAgainst+=result.awayScore;away.pointsFor+=result.awayScore;away.pointsAgainst+=result.homeScore}
    home.games++;away.games++;
    const divisionGame=home.divisionId===away.divisionId;
    if(!result.winner){home.ties++;away.ties++;if(divisionGame){home.divisionTies++;away.divisionTies++}return}const loser=result.winner===game.home?game.away:game.home;byId[result.winner].wins++;byId[loser].losses++;if(divisionGame){byId[result.winner].divisionWins++;byId[loser].divisionLosses++}headToHead[`${result.winner}:${loser}`]=(headToHead[`${result.winner}:${loser}`]||0)+1;
  }));
  const rule=league.playoffSettings?.seedingRule||'TOTAL_POINTS_SCORED';
  const hasProjections=Object.keys(league.picks||{}).length>0||Object.keys(league.predictedScores||{}).length>0;
  return rows.sort((a,b)=>{
    if(scope==='completed'&&!hasProjections&&league.source?.provider==='ESPN'&&a.playoffSeed&&b.playoffSeed)return a.playoffSeed-b.playoffSeed;
    const aPct=a.games?(a.wins+a.ties*.5)/a.games:0,bPct=b.games?(b.wins+b.ties*.5)/b.games:0;
    const aDivGames=a.divisionWins+a.divisionLosses+a.divisionTies,bDivGames=b.divisionWins+b.divisionLosses+b.divisionTies;
    const aDiv=aDivGames?(a.divisionWins+a.divisionTies*.5)/aDivGames:0,bDiv=bDivGames?(b.divisionWins+b.divisionTies*.5)/bDivGames:0;
    const h2h=()=>{const ab=headToHead[`${a.id}:${b.id}`]||0,ba=headToHead[`${b.id}:${a.id}`]||0;return ba-ab};
    if(rule==='INTRA_DIVISION_RECORD'){if(bDiv!==aDiv)return bDiv-aDiv;const h=h2h();if(h)return h;if(bPct!==aPct)return bPct-aPct}
    else {if(bPct!==aPct)return bPct-aPct;if(rule==='H2H_RECORD'){const h=h2h();if(h)return h}if(rule==='TOTAL_POINTS_SCORED'&&b.pointsFor!==a.pointsFor)return b.pointsFor-a.pointsFor}
    if(rule!=='H2H_RECORD'){const h=h2h();if(h)return h}
    if(b.pointsFor!==a.pointsFor)return b.pointsFor-a.pointsFor;
    if(a.divisionId===b.divisionId&&bDiv!==aDiv)return bDiv-aDiv;
    if(b.pointsAgainst!==a.pointsAgainst)return b.pointsAgainst-a.pointsAgainst;
    return a.name.localeCompare(b.name);
  });
}

function Bracket({league,teams,standings,setLeague}){
  const playoffWeeks=league.schedule.map((week,index)=>({...week,index,games:week.games.filter(g=>g.isPlayoff)})).filter(w=>w.games.length);
  const count=Math.min(Math.max(2,league.playoffTeamCount||4),standings.length);
  const bracketSize=2**Math.ceil(Math.log2(count));
  const byeCount=bracketSize-count;
  const seeded=standings.slice(0,count).map((team,index)=>({team,seed:index+1}));
  const byes=seeded.slice(0,byeCount);
  const projected=projectedBracketRounds(seeded,bracketSize,league.playoffPicks||{}),validPicksJson=JSON.stringify(projected.validPicks),savedPicksJson=JSON.stringify(league.playoffPicks||{});
  useEffect(()=>{if(validPicksJson!==savedPicksJson)setLeague(current=>({...current,playoffPicks:projected.validPicks}))},[validPicksJson,savedPicksJson,setLeague]);
  const pickPlayoff=(key,id,signature)=>setLeague(current=>{const playoffPicks={...(current.playoffPicks||{})};if(playoffPicks[key]?.winner===id)delete playoffPicks[key];else playoffPicks[key]={winner:id,participants:signature};return{...current,playoffPicks}});
  if(!playoffWeeks.length){const rounds=projected.rounds;return <div><div className="bracket-note">Select a team to advance it. Regular-season changes automatically clear every playoff pick whose matchup changes. {byeCount>0&&(byeCount===1?'The top seed receives a first-round bye.':`The top ${byeCount} seeds receive first-round byes.`)}</div><div className="bracket">{rounds.map((games,roundIndex)=><div className="bracket-round" key={roundIndex}><h3>{roundIndex===rounds.length-1?'Championship':roundIndex===rounds.length-2?'Semifinals':roundIndex===0?'First round':`Round ${roundIndex+1}`}</h3>{games.map(({a,b,key,winner,selectable,signature},gameIndex)=>{const bye=Boolean(roundIndex===0&&(a&&!b||b&&!a)),entries=bye?[a||b]:[a,b];return <div className={`bracket-game ${bye?'bye-game':''} ${selectable?'playoff-selectable':''}`} key={gameIndex}>{entries.map((entry,slotIndex)=>{const selected=winner?.team?.id===entry?.team?.id;return <button type="button" className={selected?'advanced':''} disabled={!selectable} onClick={()=>entry?.team&&pickPlayoff(key,entry.team.id,signature)} key={slotIndex}>{entry?.team&&<i style={{background:entry.team.color}}/>}{entry?.team?`${entry.seed}. ${entry.team.name}`:'TBD'}{bye&&<b>BYE</b>}{selected&&<b>ADVANCES</b>}</button>})}</div>})}</div>)}</div></div>}
  const firstParticipants=new Set(playoffWeeks[0].games.flatMap(game=>[game.home,game.away]));
  const importedByes=byes.filter(({team})=>!firstParticipants.has(team.id));
  const expectedRounds=Math.log2(bracketSize),missingRounds=Math.max(0,expectedRounds-playoffWeeks.length);
  return <div><div className="bracket-note">Live ESPN leaders are shown as provisionally advancing. The bracket recalculates whenever ESPN scores are refreshed.</div><div className="bracket">{playoffWeeks.map((week,round)=><div className="bracket-round" key={week.index}><h3>{round===expectedRounds-1?'Championship':round===expectedRounds-2?'Semifinals':week.label}</h3>{round===0&&importedByes.map(({team,seed})=><div className="bracket-game bye-game" key={team.id}><span className="advanced"><i style={{background:team.color}}/>{seed}. {team.name}<b>BYE</b></span></div>)}{week.games.map((game,i)=>{const result=game.inProgress?liveOutcome(game):outcomeFor(league,game,`${week.index}-${i}`);return <div className={`bracket-game ${game.inProgress?'bracket-live':''}`} key={i}>{['away','home'].map(side=>{const team=teams[game[side]];return <span className={result.winner===team?.id?'advanced':''} key={side}><i style={{background:team?.color}}/>{team?.name||'TBD'}{(game.completed||game.inProgress)&&<b>{side==='home'?game.homeScore:game.awayScore}{game.inProgress?' LIVE':''}</b>}</span>})}</div>})}</div>)}{Array.from({length:missingRounds},(_,offset)=>{const round=playoffWeeks.length+offset,gameCount=bracketSize/(2**(round+1));return <div className="bracket-round" key={`future-${round}`}><h3>{round===expectedRounds-1?'Championship':round===expectedRounds-2?'Semifinals':`Round ${round+1}`}</h3>{Array.from({length:gameCount},(_,game)=><div className="bracket-game" key={game}><span className="empty-seed">TBD</span><span className="empty-seed">TBD</span></div>)}</div>})}</div></div>
}

function TeamForecast({league,teams,choose,updateScore,resetHypothetical}){
  const [teamId,setTeamId]=useState(league.teams[0]?.id||'');
  const games=[];league.schedule.forEach((week,w)=>week.games.forEach((game,g)=>{if(game.home===teamId||game.away===teamId)games.push({week,w,g,game,key:`${w}-${g}`})}));
  let wins=0,losses=0,ties=0,total=0;
  games.forEach(({game,key})=>{const result=outcomeFor(league,game,key);const side=game.home===teamId?'home':'away';const score=side==='home'?result.homeScore:result.awayScore;if(Number.isFinite(score))total+=score;if(!result.winner&&Number.isFinite(result.homeScore))ties++;else if(result.winner===teamId)wins++;else if(result.winner)losses++});
  return <div><div className="forecast-head"><div><label>Forecasting</label><select value={teamId} onChange={e=>setTeamId(e.target.value)}>{league.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div className="forecast-record"><strong>{wins}-{losses}{ties?`-${ties}`:''}</strong><small>PROJECTED RECORD</small></div><div className="forecast-record"><strong>{total.toFixed(1)}</strong><small>PROJECTED POINTS</small></div></div><div className="hypothetical-warning"><strong>Scenario mode</strong> Completed ESPN results can be changed here, but those edits are hypothetical and do not change ESPN. Live games remain read-only when live locking is enabled.</div><div className="matchups forecast-matchups">{games.map(({week,game,key})=>{const result=outcomeFor(league,game,key),locked=game.inProgress&&(league.lockLiveGames??true);return <article className={`matchup ${locked?'live-locked':''}`} key={key}><div className="match-number"><span>{week.label}{locked?' · LIVE & LOCKED':result.hypothetical?' · HYPOTHETICAL':''}</span>{result.hypothetical&&<button onClick={()=>resetHypothetical(key)}>Restore ESPN result</button>}</div>{[['away','AWAY'],['home','HOME']].map(([side,label])=>{const team=teams[game[side]],status=result.winner?(result.winner===team.id?'winner':'loser'):'';const liveScore=side==='home'?game.homeScore:game.awayScore;const stored=locked?liveScore:game.completed?(league.hypotheticalResults?.[key]?.[side]??liveScore):(league.predictedScores?.[key]?.[side]??'');return <div role="button" tabIndex="0" className={`team-choice ${status}`} key={team.id} onClick={()=>!locked&&choose(key,team.id,game,true)}><span className="stripe" style={{background:team.color}}/><span><strong>{team.name}</strong><small>{label}{locked?' · LIVE':game.completed&&!result.hypothetical?' · ESPN FINAL':result.hypothetical?' · SCENARIO':''}</small></span><input className="score-input" type="number" min="0" step="0.01" disabled={locked} value={stored} placeholder="Score" onClick={e=>e.stopPropagation()} onChange={e=>updateScore(key,side,e.target.value,game,true)}/><span className="pick-mark">✓</span></div>})}</article>})}</div></div>
}

function RefreshEspn({league,onRefresh,onClose}){
  const [form,setForm]=useState({espnS2:'',swid:''});const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  async function submit(event){event.preventDefault();setLoading(true);setError('');try{const response=await fetch('/api/espn/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leagueId:league.source.leagueId,year:league.source.year,...form})});const text=await response.text();const data=text?JSON.parse(text):null;if(!response.ok)throw new Error(data?.error||`Refresh failed (${response.status}).`);if(!data)throw new Error('The refresh server returned no data.');onRefresh(data)}catch(error){setError(error.message||'Could not refresh ESPN.')}finally{setLoading(false)}}
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="refresh-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><span className="step-label">ESPN LIVE REFRESH</span><h2>Update scores</h2><p>Pull the newest scores and matchup statuses while keeping your predictions. Private leagues require fresh credentials.</p><form className="import-form" onSubmit={submit}><label>SWID</label><input type="password" autoComplete="off" value={form.swid} onChange={e=>setForm({...form,swid:e.target.value})} placeholder="Leave blank for public leagues"/><label>ESPN_S2</label><textarea rows="3" autoComplete="off" value={form.espnS2} onChange={e=>setForm({...form,espnS2:e.target.value})} placeholder="Leave blank for public leagues"/>{error&&<div className="form-error">{error}</div>}<button className="primary-button" disabled={loading}>{loading?'Refreshing…':'Refresh from ESPN'} <span>↻</span></button></form></div></div>
}

function Dashboard({league,setLeague}){
  const [week,setWeek]=useState(0);const [tab,setTab]=useState('schedule');const [refreshOpen,setRefreshOpen]=useState(false);const [standingsScope,setStandingsScope]=useState('live');const teams=useMemo(()=>Object.fromEntries(league.teams.map(t=>[t.id,t])),[league.teams]);const standings=useMemo(()=>calculateStandings(league,'live'),[league]);const displayedStandings=useMemo(()=>calculateStandings(league,standingsScope),[league,standingsScope]);
  const choose=(key,id,game,scenario=false)=>setLeague(c=>{if(game?.completed&&scenario){const results={...(c.hypotheticalResults||{})},wasSelected=results[key]?.winner===id;results[key]={home:'',away:'',winner:wasSelected?null:id};return{...c,hypotheticalResults:results}}const picks={...c.picks},predictedScores={...(c.predictedScores||{})};if(picks[key]===id)delete picks[key];else picks[key]=id;delete predictedScores[key];return{...c,picks,predictedScores}});
  const updateScore=(key,side,value,game,scenario=false)=>setLeague(c=>{if(game?.completed&&scenario){return{...c,hypotheticalResults:{...(c.hypotheticalResults||{}),[key]:{home:game.homeScore,away:game.awayScore,...(c.hypotheticalResults?.[key]||{}),[side]:value}}}}return{...c,predictedScores:{...(c.predictedScores||{}),[key]:{...(c.predictedScores?.[key]||{}),[side]:value}}}});
  const resetHypothetical=(key)=>setLeague(c=>{const hypotheticalResults={...(c.hypotheticalResults||{})};delete hypotheticalResults[key];return{...c,hypotheticalResults}});
  const clearWeek=()=>setLeague(c=>({...c,picks:Object.fromEntries(Object.entries(c.picks).filter(([key])=>!key.startsWith(`${week}-`))),predictedScores:Object.fromEntries(Object.entries(c.predictedScores||{}).filter(([key])=>!key.startsWith(`${week}-`)))}));const current=league.schedule[week]||{games:[]};
  const predictionCount=new Set([...Object.keys(league.picks||{}),...Object.keys(league.predictedScores||{})]).size;
  const applyRefresh=(fresh)=>{setLeague(current=>{const colors=Object.fromEntries(current.teams.map(t=>[t.id,t.color]));return{...fresh,teams:fresh.teams.map(t=>({...t,color:colors[t.id]||t.color})),picks:current.picks,predictedScores:current.predictedScores||{},hypotheticalResults:current.hypotheticalResults||{},playoffPicks:current.playoffPicks||{},lockLiveGames:current.lockLiveGames??true}});setRefreshOpen(false)};
  return <main><section className="dashboard"><div className="dash-hero"><div><div className="eyebrow"><span>{league.source?.provider||'SEASON'}</span> Your schedule picks</div><h1>{league.name}</h1><p>{league.source?`Imported from ESPN · ${league.source.year} · ${String(league.playoffSettings?.seedingRule||'ESPN seeding').replaceAll('_',' ').toLowerCase()}`:'Pick each winner week by week and watch your projected season update.'}</p></div><div className="hero-actions">{league.source?.provider==='ESPN'&&<button className="refresh-button" onClick={()=>setRefreshOpen(true)}>↻ Refresh ESPN</button>}<div className="record-pill"><span>{predictionCount}</span><small>PICKS MADE</small></div></div></div><nav className="tabs">{['schedule','standings','playoffs','forecast','teams'].map(name=><button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}>{name[0].toUpperCase()+name.slice(1)}</button>)}</nav>
  {tab==='schedule'&&<div className="tab-panel"><div className="schedule-toolbar"><div><label>Viewing</label><select value={week} onChange={e=>setWeek(Number(e.target.value))}>{league.schedule.map((w,i)=><option key={i} value={i}>{w.label}</option>)}</select></div><div className="toolbar-actions"><label className="lock-toggle"><input type="checkbox" checked={league.lockLiveGames??true} onChange={e=>setLeague(c=>({...c,lockLiveGames:e.target.checked}))}/><span/> Lock live games</label><button className="text-button" onClick={clearWeek}>Clear my predictions</button></div></div><div className="matchups">{current.games.map((game,i)=>{const key=`${week}-${i}`,result=outcomeFor(league,game,key),locked=game.inProgress&&(league.lockLiveGames??true);return <article className={`matchup ${locked?'live-locked':''}`} key={key}><div className="match-number">{game.inProgress?'LIVE · ':game.isPlayoff?'PLAYOFF · ':''} MATCHUP {String(i+1).padStart(2,'0')}{result.hypothetical?' · HYPOTHETICAL':''}</div>{[['away','AWAY'],['home','HOME']].map(([side,label])=>{const t=teams[game[side]],status=result.winner?(result.winner===t.id?'winner':'loser'):'';const resultScore=side==='home'?result.homeScore:result.awayScore;const liveScore=side==='home'?game.homeScore:game.awayScore;const score=locked?liveScore:result.hypothetical?(resultScore??''):game.completed?liveScore:(league.predictedScores?.[key]?.[side]??'');return <div role="button" tabIndex="0" className={`team-choice ${status}`} key={t.id} onClick={()=>!game.completed&&!locked&&choose(key,t.id)}><span className="stripe" style={{background:t.color}}/><span><strong>{t.name}</strong><small>{label}{game.inProgress?` · LIVE ${liveScore}`:game.completed?(result.hypothetical?' · SCENARIO':' · FINAL'):''}</small></span><input className="score-input" type="number" min="0" step="0.01" disabled={game.completed||locked} value={score} placeholder="Score" aria-label={`${t.name} predicted score`} onClick={e=>e.stopPropagation()} onChange={e=>updateScore(key,side,e.target.value)}/><span className="pick-mark">✓</span></div>})}</article>})}</div></div>}
  {tab==='standings'&&<div className="tab-panel"><div className="standings-controls"><div className="seeding-note">Using ESPN’s {String(league.playoffSettings?.seedingRule||'points scored').replaceAll('_',' ').toLowerCase()} tiebreaker.</div><div className="scope-toggle"><button className={standingsScope==='live'?'active':''} onClick={()=>setStandingsScope('live')}>Live + predictions</button><button className={standingsScope==='completed'?'active':''} onClick={()=>setStandingsScope('completed')}>Completed only</button></div></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>T</th><th>PF</th><th>PCT</th></tr></thead><tbody>{displayedStandings.map((t,i)=>{const p=t.games;return <tr key={t.id}><td>{i+1}</td><td><span className="stand-team"><i style={{background:t.color}}/>{t.name}</span></td><td>{t.wins}</td><td>{t.losses}</td><td>{t.ties}</td><td>{t.pointsFor.toFixed(1)}</td><td>{p?((t.wins+t.ties*.5)/p).toFixed(3).replace(/^0/,''):'.000'}</td></tr>})}</tbody></table></div></div>}
  {tab==='playoffs'&&<div className="tab-panel"><Bracket league={league} teams={teams} standings={standings} setLeague={setLeague}/></div>}
  {tab==='forecast'&&<div className="tab-panel"><TeamForecast league={league} teams={teams} choose={choose} updateScore={updateScore} resetHypothetical={resetHypothetical}/></div>}
  {tab==='teams'&&<div className="tab-panel"><div className="team-grid">{league.teams.map((t,i)=><article className="team-card" key={t.id} style={{background:t.color,color:textColor(t.color)}}><TeamLogo team={t}/><small>{t.playoffSeed?`ESPN SEED ${t.playoffSeed}`:`TEAM ${String(i+1).padStart(2,'0')}`}</small><strong>{t.name}</strong></article>)}</div></div>}
  {refreshOpen&&<RefreshEspn league={league} onRefresh={applyRefresh} onClose={()=>setRefreshOpen(false)}/>}</section></main>
}

export default function App(){const [league,setLeague]=useState(loadLeague);useEffect(()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(league)),[league]);const reset=()=>{if(confirm('Start a new league? Your current season will be removed.')){localStorage.removeItem(STORAGE_KEY);setLeague({...EMPTY})}};const create=(weeks,playoffTeamCount)=>setLeague(c=>({...c,regularSeasonWeeks:weeks,playoffTeamCount,schedule:buildSchedule(c.teams,weeks),picks:{},predictedScores:{},hypotheticalResults:{},playoffPicks:{}}));return <><div className="noise"/><Header active={league.schedule.length>0} onReset={reset}/>{league.schedule.length?<Dashboard league={league} setLeague={setLeague}/>:<Setup league={league} setLeague={setLeague} onCreate={create}/>}</>}
