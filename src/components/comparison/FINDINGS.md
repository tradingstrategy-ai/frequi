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
| 1 | fixed | low | Prettier formatting warning in `loginInfo.ts` line 51 | TBD |
| 2 | deferred | low | `timeformat.spec.ts` timezone display name mismatch (CEST vs GMT+2) — pre-existing base code, locale-dependent | n/a |

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
