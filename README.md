# Matchday

Matchday is a React fantasy-football schedule predictor. Create up to 32 custom
teams or import an ESPN league, predict matchups and scores, and see the effect
on projected standings and the playoff bracket.

## What each person needs

- [Node.js](https://nodejs.org/) 22 or newer (the current LTS release is recommended)
- A copy of this project
- Their ESPN league ID and season
- For a private league, their own `SWID` and `ESPN_S2` browser-cookie values

No database or shared server is required. Each person's league and predictions
stay in that browser's local storage.

## Run on Windows

Open PowerShell in the project folder and run:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Then open the web address printed by Vite, normally `http://localhost:5173`.
Keep the terminal open while using the app.

## Run on macOS or Linux

Open a terminal in the project folder and run:

```bash
cp .env.example .env
npm install
npm run dev
```

Then open the web address printed by Vite, normally `http://localhost:5173`.
Keep the terminal open while using the app.

The `.env` copy is optional because the app has safe local defaults. It exists
so ports and request limits can be changed without editing source code.

## Import an ESPN league

1. Start the app and choose **Import ESPN league**.
2. Enter the league ID from an ESPN Fantasy URL and select the season.
3. For a public league, leave the credential fields blank.
4. For a private league, sign in to ESPN in that person's browser and copy
   their `SWID` and `espn_s2` cookie values into the form.
5. Select **Import league**. Use **Refresh ESPN** later to retrieve new scores.

`SWID` and `ESPN_S2` provide access to private ESPN Fantasy data and must be
treated like passwords. Never send them to another person, paste them into
`.env`, commit them to source control, or include them in screenshots. The app
sends them to the local API for the current ESPN request and does not save them
to disk or browser storage. ESPN does not offer an official Fantasy OAuth flow,
so the cookies may need to be copied again after the ESPN session expires.

## Configuration

The values and descriptions are in [`.env.example`](.env.example). Defaults:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `PORT` | `8787` | Local ESPN-import API port |
| `ESPN_RATE_MAX` | `6` | Requests allowed per IP in one window |
| `ESPN_RATE_WINDOW_MS` | `60000` | Rate-limit window in milliseconds |
| `ESPN_LEAGUE_COOLDOWN_MS` | `15000` | Delay between refreshes of one league |

If `PORT` is changed, update the `/api` target in `vite.config.js` to the same
port. The limits are kept in memory and reset when the API restarts.

## Production build

```bash
npm run build
```

This creates the static frontend in `dist`. ESPN imports still require the
Node API in `server/index.js`; static files alone cannot import a private league.

## Troubleshooting

- **The page does not load:** confirm both development processes are still
  running and use the exact Vite URL displayed in the terminal.
- **ESPN import returns 401/403:** confirm the league ID, season, and both
  private cookie values. The ESPN login may have expired.
- **ESPN import returns 404:** confirm the league exists in the selected season.
- **The API fails or returns an empty response:** confirm port `8787` is free
  and `vite.config.js` points to that same port.
- **Too many requests:** wait for the displayed cooldown, then refresh once.
