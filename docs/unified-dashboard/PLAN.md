# Unified FT + NT dashboard: plan

Status: **POC running on staging, 2026-10-14**: http://100.72.126.50:9298/ (tailnet; site login in
`/srv/lvb-dashboard-staging/secrets/dashboard-login.txt` on vitalik8). Operator runbook:
orchestrator `docs/runbooks/unified-dashboard-gateway.md`.

## Progress (2026-10-14)

| Phase | State | Evidence |
|---|---|---|
| P1 registry + staging stack | done | `bots.json` (32 bots); `compose.staging.yml` + `Caddyfile.staging` on `:9298`; production `:9198` untouched |
| P2 NT in FreqUI's own pages | done via gateway (D1 = b) | `scripts/dashboard_gateway/nt_compat.py`; contract sweep **32/32 bots pass** every FreqUI read |
| P3 live-vs-backtest for every bot | done (fleet HTML embed; D2 = keep open behind the site login) | Reports page, 31 bots with bundles; native comparison unchanged for the 6 central bots |
| P4 verification | done | gateway pytest 61, FreqUI vitest 102, sweep 32/32, Playwright 107 pages: 0 gateway errors (4 x 502 during an external dipbuyer restart), read-only controls on 32/32, charts on 28/32 (4 NT bots have no candles to serve); gallery `e2e-live/results/index.html` |
| P5 cutover | **waiting for your OK** | PRs not opened yet; nothing committed |

Decisions taken: D1 (b) gateway translation, no bot redeploys. D2: site login gates
everything, so reports need no second gate. D3: logins read from each container by
`collect_bot_secrets.py` into a mode-600 file the browser never sees.

Load on live bots (gateway counters, 21 min of E2E traffic): cache absorbed 70 %
of requests; busiest NT bot <20 upstream calls/min; ichi-vault (23 s `/status`) 199
calls for 1,213 dashboard requests.

Compare (2026-10-14, second pass): Compare now lists all 32 bots. The cold-load
failure (27 s catalog > FreqUI's 20 s timeout, so "Loading reports…" forever) was
fixed with a light metrics-only parse, threaded full parses, a 70 MB-report regex fix
(24.7 s → 0.9 s) and a startup warm-up. Live E2E: 229 pages, 0 API failures, 0 console errors.

Open items: aster-multi-strat runs an old API build (no rates, approximate dates, no
candles); donchian-meanrev and saty-tradfi-lighter cache no bars; production cutover;
Avik's uncommitted `/srv` path edits; PRs (nothing committed yet).

Original plan follows.

Worktree `frequi-worktrees/unified-dashboard`, branch
`feat/unified-nt-ft-dashboard` (from `origin/feat/live-vs-backtest-comparison` @ `e079fc18`,
the deployed bundle).

Goal: one FreqUI dashboard on vitalik8 that shows every live bot (Freqtrade and Nautilus)
with FreqUI's own pages, plus a live-vs-backtest page for each, tested end to end before
anyone reviews it by hand.

## Where things stand (verified 2026-10-14)

| Item | State |
|---|---|
| Stack location | `/srv/central-reporter-checkout` (group `data`, writable by us) @ `3c623ffd`. Avik's path edits are **uncommitted** there (5 files). |
| Comparison API `/bots` | 6 bots; microcap now listed (INSUFFICIENT_HISTORY); GMX/Apex SUCCESS; FTR MISSING (by design, #990). |
| Bot registry | Hardcoded in **three** places that drift: API `dashboard_registry.py`, Caddyfile routes, FreqUI `src/config/presetBots.ts` (+ `frequi-build.env` ports). |
| Live bots with an API, reachable from vitalik8 | 31 in total: the 6 wired today, 15 NT bots and 10 more FT bots. |
| NT report bundles | All 15 NT bots (and the FT ones) publish complete HTML bundles in `/srv/reports/fleet/<host>__<slug>/current/` (manifest v1, mostly dated 2026-10-14). No CSVs, so the comparison API can't read them. |
| NT API vs FreqUI | Login, trades, profit and performance work. `/show_config` lacks `api_version`, `timeframe`, `runmode` and `bot_name`, so charts never load. `/status`, `/balance` and `/daily` are NT-shaped, so tables are blank. `locks`, `entries`, `exits`, `mix_tags`, `logs` and `sysinfo` 404. Control buttons 404 with red toasts. Derive's snapshot adapter is closer to FT. |
| FreqUI fork | 96/96 unit tests pass, `vue-tsc` clean. Timeline, Pairs and Deep Dive pages are raw JSON dumps. Bug: "Connect to reports" links to `/api/comparison/auth-check`. No FAILED/MISSING styling. 434 commits behind upstream: **do not rebase now**. |
| Build host | The Mac can't run `vite build` (`sass-embedded` needs macOS 14; the Mac is on 13). Build and serve on vitalik8; run vitest locally. |

## Bot inventory (31)

- **Wired today (6):** gmx, apex, dipbuyer, ftr, microcap-apex (FT, gmx-server); derive (NT).
- **NT (15):**
  - nautilius-trader: open-cz `:8101`, open-rwa `:8121`
  - nautilius-03: rsi-zone `:8151`, bb-revert `:8161`, r3-connors `:8163`, donchian-breakout `:8201`, donchian-meanrev `:8211`
  - nautilius-04: ichi-vault `:8131`, microcap-dynamic-cap `:8261`, orb-mnq-lighter `:8222`, orb-mnq-hl `:8223`, saty-tradfi-lighter `:8225`
  - luffy: lafo-lighter `:8221`, lighter-multistrat `:8232`
  - hyperliquid-agent-cli: aster-multi-strat `:8271`
- **FT (10):**
  - freqtrade-server: ichiv2-ls-hyperliquid-live `:9100`, ichiv3-ls-hyperliquid-live `:9103`, ichiv2-ls-hyperliquid-static `:9110`, ichiv3-ls-hyperliquid-static `:9113`, ichiv2-ls-aster-static `:9111`, ichiv3-ls-aster-static `:9114`, ichiv3-ls-gate-static `:9116` (dry-run)
  - hyperliquid-agent-cli: stablecoin-regime `:9122`, long-liquidations `:9130`, short-liquidations `:9131`, usde-regime `:9133`

## Phases

### P1: one bot registry, and a staging stack on vitalik8 (orchestrator repo)
1. `deploy/vitalik8-dashboard/bots.json` becomes the single source for each bot's slug, engine,
   upstream, display name, comparison id and fleet deployment id.
2. Generate the Caddy route blocks from it (a script plus a test that the checked-in Caddyfile
   matches). The API registry reads it too.
3. `/api/comparison/bots` returns `api_route` and `engine` for every bot, so FreqUI presets come
   from the API instead of a hardcoded list.
4. Staging copy: `compose.staging.yml` with project `lvb-dashboard-staging`, its own container
   names, Caddy `:9298`, API `:8212`, FreqUI `:8213`, Tailscale bind only. Production stays
   untouched.
5. Exit check: all 31 `/api/bots/<slug>/api/v1/ping` return pong through `:9298`.

### P2: NT bots usable in FreqUI's own pages (FT-compat layer)
1. Pure translation functions, NT payload to FreqUI's types:
   - `show_config`: `api_version`, `timeframe`, `runmode`, `bot_name`, `strategy`, `stake_currency`, `trading_mode`, `dry_run`
   - `status`, `trades` (`*_timestamp`, int `trade_id`), `balance.currencies`, `daily` rows
   - empty `locks`, `entries`, `exits`, `mix_tags`, `logs`, `sysinfo`
   - `pair_candles` accepted by POST
   - 403 with a clear message for write ops
   - websocket off
2. Where it runs: see decision D1.
3. FreqUI side: hide start/stop/forceexit controls for NT bots, and show "read-only" in their place.
4. Exit check: an authenticated contract sweep over each NT bot validates every endpoint against
   FreqUI's TypeScript types.

### P3: live-vs-backtest for every bot (comparison API + FreqUI)
1. The API reads `/srv/reports/fleet/*/current/manifest.json`. Adds `GET /api/comparison/{bot_id}/reports`
   (its HTML report list) and serves the files read-only under `/api/comparison/{bot_id}/report/<file>`.
2. FreqUI compare page:
   - "Report" tab that embeds the fleet HTML (iframe) when the bot only has a fleet bundle
   - native charts for central-bundle bots
   - FAILED/MISSING/INSUFFICIENT_HISTORY banners with the reason
   - date picker over `runs/`
3. Replace the JSON dumps on Timeline, Pairs and Deep Dive with charts and tables (gantt,
   pair heatmap, exit reasons, slippage, best/worst) for central bundles.
4. Fix the auth-check link, FINDINGS #3 (401 TypeError) and #5 (silent refresh).

### P4: verification (before your review)
1. Unit: vitest (FreqUI) and pytest (registry, API, FT-compat), all green.
2. Contract sweep script: logs in to all 31 bots through staging and calls every endpoint
   FreqUI uses. Report per bot: OK / degraded / failed per endpoint.
3. Playwright E2E against `:9298`: for every bot, log in, then load Dashboard, Trade, Chart,
   Trades list, Logs and Compare (overview plus report). The test asserts no error toasts and
   no console errors, and that charts have data. It saves a screenshot for each page into a
   gallery for review.
4. Then your review by hand or with computer use.

### P5: cutover (your OK only)
1. PRs: frequi, orchestrator (and nautilus-strategies if D1 = at source).
2. Build the image with `build-frequi.sh`, then switch production compose to it. Rollback tag kept.

## Decisions

- **D1: where the NT FT-compat layer runs.** (a) In `common/api_server` at source, which means
  a rolling redeploy of 15 live NT bots. (b) A translation proxy on vitalik8 in the dashboard
  stack: no bot restarts, ready today. The same functions move into `api_server` later.
  Recommendation: (b) for the POC, (a) after.
- **D2: fleet reports on `:9198` without auth.** They carry live trade detail, the same as
  comparison data already does. Keep `:9198` open, or put BasicAuth on `/api/comparison/*/report/*`.
- **D3: bot credentials for automated tests.** Read each bot's API user and password from its
  container env/config at test time, in memory only and never written. Or you supply them.

## Asks for Avik (non-blocking)
- PR the uncommitted `/srv` path changes in `/srv/central-reporter-checkout`.
- Read-model branch and round-8 notes: nothing found on any remote (no branch, commit or
  issue). Confirm whether it exists.
