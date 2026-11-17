import { describe, expect, it } from 'vitest';

import type { DashboardReportMetadata } from '@/types';
import {
  reportCaveats,
  reportVerdicts,
  venueMtmView,
  versionHistory,
} from '@/utils/reportVersions';

function report(extra: Partial<DashboardReportMetadata> = {}): DashboardReportMetadata {
  return {
    schema_version: '1',
    snapshot_id: 'r1',
    status: 'SUCCESS',
    reason: null,
    generated_at: null,
    report_date: '2026-10-20',
    report_window: { start: '2026-08-06T00:00:00+00:00', end: '2026-10-20T00:00:00+00:00' },
    stale: false,
    source_artifacts: [],
    unavailable_fields: [],
    annotations: [],
    ...extra,
  };
}

const VERSIONS = [
  {
    id: 'v1',
    label: 'NOT REPLAYABLE — UTC-daily bars',
    available: true,
    report: 'history/v1/a.html',
    not_replayable: true,
  },
  {
    id: 'v2',
    label: 'Session bars',
    available: true,
    report: 'history/v2/b.html',
    not_replayable: false,
  },
];

describe('reportVersions', () => {
  it('puts verdicts first, most severe first, and keeps them out of the caveats', () => {
    const r = report({
      annotations: [
        { code: 'FLEET_REPORT', note: 'read from the report' },
        { code: 'NOT_VALIDATED', note: 'IchiV4Short: empty_backtest_population' },
        { code: 'PARITY_INVALID', note: 'v4 pins a stale config' },
      ],
    });
    expect(reportVerdicts(r).map((v) => [v.code, v.color])).toEqual([
      ['PARITY_INVALID', 'error'],
      ['NOT_VALIDATED', 'warning'],
    ]);
    expect(reportVerdicts(r)[1].note).toContain('IchiV4Short');
    expect(reportCaveats(r).map((a) => a.code)).toEqual(['FLEET_REPORT']);
    expect(reportVerdicts(null)).toEqual([]);
  });

  it('describes the version history and whether the numbers cover all of it', () => {
    expect(versionHistory(report())).toBeNull();
    const full = versionHistory(
      report({
        versions: VERSIONS,
        history_report: 'history/full/full.html',
        annotations: [{ code: 'FULL_HISTORY', note: '' }],
      }),
    );
    expect(full).toEqual({
      historyReport: 'history/full/full.html',
      coversFullHistory: true,
      versions: VERSIONS,
    });
    const current = versionHistory(
      report({
        versions: VERSIONS,
        history_report: null,
        annotations: [{ code: 'CURRENT_VERSION_ONLY', note: '' }],
      }),
    );
    expect(current?.coversFullHistory).toBe(false);
    expect(current?.historyReport).toBeNull();
  });

  it('shows the venue mark-to-market headline as published and rejects bad shapes', () => {
    const cards = [{ label: 'Equity Now', value: '131.95 USDC' }];
    expect(venueMtmView(report({ venue_mtm: { status: 'ok', cards } }))).toEqual({
      kind: 'ok',
      cards,
    });
    expect(
      venueMtmView(report({ venue_mtm: { status: 'unavailable', reason: 'no venue history' } })),
    ).toEqual({
      kind: 'unavailable',
      reason: 'no venue history',
    });
    expect(venueMtmView(report({ venue_mtm: {} }))).toBeNull();
    expect(venueMtmView(report())).toBeNull();
    expect(
      venueMtmView(
        report({ venue_mtm: { status: 'ok', cards: [{ label: 1, value: 2 }] } as never }),
      ),
    ).toBeNull();
  });
});
