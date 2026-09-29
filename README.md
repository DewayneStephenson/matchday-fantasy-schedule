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
commits, public URLs, or screenshots. The app
sends them to this app's API for the current ESPN request and does not save them
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

## Deploy to Vercel

1. Push this project to a GitHub repository, including the `api` and `server`
   folders and `vercel.json`.
2. In Vercel, choose **Add New > Project** and import that repository.
3. Use the project root as the root directory. The included configuration selects
   **Vite**, builds with `npm run build`, and serves `dist`. Use Node.js **22.x**.
4. Click **Deploy**. No environment variables or database are required.
5. Open `/api/health` on the deployed URL; it should return `{"ok":true}`.
   Then test an ESPN import and refresh from the website.

Vercel serves the frontend and runs the ESPN API as Node.js functions on the
same domain. `api/espn/import.js` allows 60 seconds for the ESPN request and
historical-season fallback. Local development still uses `npm run dev`.
See [Vercel's Node.js function documentation](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).

For personal imports, enter private ESPN credentials in the import form.
Optional `ESPN_RATE_MAX`, `ESPN_RATE_WINDOW_MS`, and
`ESPN_LEAGUE_COOLDOWN_MS` overrides can be set in Vercel. The in-memory limits
apply per function instance and reset on cold starts; they are not a shared
deployment-wide quota.

Saved leagues remain specific to each browser and website address. Data saved
on localhost does not transfer to the Vercel URL, and users do not share edits.

## Share a league with a dedicated link

In Vercel **Settings > Environment Variables**, set the following for Production,
then redeploy so the new values take effect:

| Variable | Value |
| --- | --- |
| `SHARED_LEAGUE_ENABLED` | `true` to enable; `false` to disable |
| `SHARED_LEAGUE_SLUG` | `my-league` (use letters, numbers, and hyphens) |
| `SHARED_LEAGUE_ID` | Your ESPN league ID |
| `SHARED_LEAGUE_YEAR` | Your season, e.g. `2026` |
| `SHARED_LEAGUE_SWID` | Your SWID cookie, including braces |
| `SHARED_LEAGUE_ESPN_S2` | Your full ESPN_S2 cookie |

Both cookies are required for a private league; leave both blank for a public
league. Do not prefix these variables with `VITE_`, put credentials in the URL,
or commit real values. The server uses them only for the configured league and
returns league data, never cookie values.

Share `https://YOUR-DOMAIN/league/my-league` (replace the last segment if you
changed the slug). Anyone with this link can view the league; this is not an
authenticated page. The main `/` page continues to show the normal setup or the
visitor's previously saved personal league. Shared-league predictions are saved
separately in each visitor's browser. Opening the link retrieves current scores;
**Refresh ESPN** updates them without asking visitors for credentials. If ESPN
cookies expire, update them in Vercel and redeploy. Disabling the link stops new
loads, but does not erase data visitors have already viewed or saved.

## Troubleshooting

- **The page does not load:** confirm both development processes are still
  running and use the exact Vite URL displayed in the terminal.
- **ESPN import returns 401/403:** confirm the league ID, season, and both
  private cookie values. The ESPN login may have expired.
- **ESPN import returns 404:** confirm the league exists in the selected season.
- **The API fails or returns an empty response:** confirm port `8787` is free
  and `vite.config.js` points to that same port.
- **Too many requests:** wait for the displayed cooldown, then refresh once.
