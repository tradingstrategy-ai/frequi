# Dashboard E2E test findings --- frequi

Test run: 2026-04-22
Plan: docs/superpowers/plans/2026-04-22-dashboard-e2e-test.md

## Test environment
- Local venvs (no docker-compose this plan)
- Playwright MCP driving Chromium
- Live vault: solo 0x3df9769bbbb335340872f01d8157c779d73c6ed0, multi 0xc68a3f85f57764ab9beaf163e074475688ac3af7

## Summary
| # | Status | Severity | Symptom | Fix commit |
|---|--------|----------|---------|------------|
| 1 | fixed | low | Prettier formatting warning in `loginInfo.ts` line 51 | d0a84eee |
| 2 | deferred | low | `timeformat.spec.ts` timezone display name mismatch (CEST vs GMT+2) — pre-existing base code, locale-dependent | n/a |
| 3 | open | medium | `ftbot.ts` `getState`/`getTrades` throw TypeError on 401 response (destructuring undefined `data`) — should bail out gracefully | — |
| 4 | open | low | NT per-strategy bots (`/ichiv3`,`/breakout`,`/trend`,`/meanrev`) return `[]` from `/status` on anonymous preset-load → 4× 401 spam in console on cold start (auto-attempted refresh before login). Related to #117 (catalog attribution). | — |

## Entries

### #1 --- loginInfo.ts prettier formatting warning
**Severity:** low
**Symptom:** `pnpm lint` emitted 1 warning on `src/composables/loginInfo.ts:51` — ternary expression not wrapped to a new line per prettier rules.
**Reproduction:** `pnpm lint` — shows `Replace ·?·getPresetBots()... prettier/prettier` warning on line 51.
**Root cause:** The ternary `currentSelected ? getPresetBots().find(...) : undefined` was written on a single line exceeding prettier's line-length threshold.
**Fix:** Wrapped the ternary onto two lines in `loginInfo.ts`. ESLint now exits clean (0 errors, 0 warnings).
**Status:** fixed

### #2 --- timeformat.spec.ts timezone display name locale mismatch (DEFERRED)
**Severity:** low
**Symptom:** `pnpm test:unit run` fails 1/50 tests: `expected '2022-04-27 13:05:00 (CEST)' to deeply equal '2022-04-27 13:05:00 (GMT+2)'`.
**Reproduction:** `pnpm test:unit run tests/unit/timeformat.spec.ts`
**Root cause:** The test expects `GMT+2` but the system's Node.js/ICU build returns the IANA-short name `CEST` for Central European Summer Time. This is a pre-existing base FreqUI issue unrelated to the comparison feature branch. The test file has never been modified by this branch.
**Fix:** Deferred — not in comparison-feature scope. No changes made.
**Status:** open (deferred)

### #3 --- ftbot.ts unhandled 401 causes TypeError destructuring
**Severity:** medium
**Symptom:** On app load before login (expired preset tokens), console shows:
```
TypeError: Cannot destructure property 'data' of '(intermediate value)' as it is undefined.
    at Proxy.getState (src/stores/ftbot.ts:610:14)
TypeError: Cannot read properties of undefined (reading 'data')
    at Proxy.getTrades (src/stores/ftbot.ts:207:25)
```
**Reproduction:** Load `http://localhost:3000/` cold (clear localStorage first) with NT preset bots unauthenticated. Observe console.
**Root cause:** `refreshSlow()` calls `Promise.all([getState(), getTrades(), …])`; when the underlying axios call rejects with 401, the interceptor returns `undefined`, but the store tries to destructure `.data` from it.
**Fix:** — (open)
**Status:** open

### #4 --- per-strategy NT bots produce 401 spam on cold load
**Severity:** low
**Symptom:** 4 × `401 Unauthorized` on `/ichiv3/api/v1/token/refresh`, `show_config`, `balance`, `blacklist`, `whitelist`, `trades`, `profit` at cold page load.
**Reproduction:** Load `http://localhost:3000/` with no prior session. `browser_network_requests` shows the spam.
**Root cause:** Preset bot config auto-hydrates stored per-strategy NT bots (`nt-ichiv3-solo`, etc.) and attempts `token/refresh` before user interaction. 401 is correct server behaviour.
**Fix:** — (open; related to #117 catalog attribution, also consider gating auto-refresh until user logs in)
**Status:** open

### #5 --- "Login again" button inconsistent — sometimes silent refresh, sometimes dialog
**Severity:** medium
**Symptom:** Clicking the per-row "Login again" button on `nt-ichiv3-solo` does NOT open the login modal — it silently retries `POST /ichiv3/api/v1/token/refresh` (401) and stays in the expired state. Clicking it on `nt-multi-strategy` does open the modal.
**Reproduction:** Cold load `localhost:3000`, clear localStorage, reload (presets auto-seed with fake tokens), click "Login again" on nt-ichiv3-solo. No dialog appears. `browser_network_requests` shows only a `/token/refresh` 401.
**Root cause:** Unknown — needs investigation in `src/components/BotLogin.vue` / `LoginModal.vue`. May be related to whether `nt-multi-strategy` is the currently-selected bot (per `AUTH_SELECTED_BOT` in `loginInfo.ts:15`) — selected bot's "Login again" opens dialog, non-selected's does not.
**Fix:** — (open)
**Status:** open

### #6 --- Per-strategy NT bot login verified via curl (Phase 2), UI blocked by #5
**Severity:** info (not a bug per se; blocked by #5)
**Symptom:** Could not complete Task 3.1 Step 6 (log in to `nt-ichiv3-solo` via UI) because the Login again button silently refreshes.
**Reproduction:** n/a
**Root cause:** Blocked by #5
**Fix:** Curl proof: `curl -X POST http://127.0.0.1:8101/ichiv3/api/v1/token/login -u freqtrade:freqtrade` → 200 with `nt-shim-access-token`. The shim handles the `/ichiv3` prefix correctly.
**Status:** info

### #7 --- Chart "Failed to load data": shim only accepts GET /pair_candles, frontend sends POST
**Severity:** high (blocks Trade and Chart pages)
**Symptom:** Trade page and Chart page show "Failed to load data" for any selected pair. Network panel: `POST /api/v1/pair_candles → 405 Method Not Allowed`.
**Reproduction:** Switch active bot to `nt-multi-strategy`, open `/trade`, click any pair (e.g. `0G/USDT`).
**Root cause:** Shim advertises `api_version: 2.43` in `/show_config`, which activates FreqUI's `reducedPairCalls` feature flag (enabled at ≥2.35). That path calls `api.post('/pair_candles', payload)` (`src/stores/ftbot.ts:379`). The shim's `routers/candles.py` only registers `@router.get("/api/v1/pair_candles")`, so POST returns 405.
**Fix:** In the shim, either (a) add `@router.post("/api/v1/pair_candles")` accepting the same payload via request body, or (b) lower `api_version` below 2.35 so the frontend falls back to GET. (a) is preferable — matches real FT behaviour. Located at `.claude/worktrees/dashboard-consolidated/services/ft-api-shim/routers/candles.py`.
**Status:** open
