import type { DashboardReportMetadata, ReportVersion } from '@/types';

/**
 * View model for a report's version history, validation verdicts and venue
 * mark-to-market headline (dashboard gateway `report` block).
 *
 * Deployments change version (bar construction, parameters, fixes). The owner's rule:
 * every surface shows the full live history since activation by default, marks each
 * version change and never hides history after an upgrade. A NOT VALIDATED or PARITY
 * INVALID verdict is shown above everything else, never folded into the caveats.
 */

export type ReportAnnotation = DashboardReportMetadata['annotations'][number];

/** Annotation codes that say whether the numbers may be relied on at all. */
export const VERDICT_CODES = ['PARITY_INVALID', 'NOT_VALIDATED'] as const;

const VERDICT_TITLES: Record<(typeof VERDICT_CODES)[number], string> = {
  PARITY_INVALID: 'PARITY INVALID: the current version could not be replayed',
  NOT_VALIDATED: 'NOT VALIDATED: this run failed report validation',
};

export interface VerdictView {
  code: (typeof VERDICT_CODES)[number];
  title: string;
  note: string;
  color: 'error' | 'warning';
}

/** Validation verdicts of a report, most severe first. */
export function reportVerdicts(report: DashboardReportMetadata | null | undefined): VerdictView[] {
  const annotations = report?.annotations ?? [];
  return VERDICT_CODES.flatMap((code) =>
    annotations
      .filter((a) => a.code === code)
      .map((a) => ({
        code,
        title: VERDICT_TITLES[code],
        note: a.note,
        color: code === 'PARITY_INVALID' ? ('error' as const) : ('warning' as const),
      })),
  );
}

/** The remaining caveats, without the verdicts shown on their own. */
export function reportCaveats(
  report: DashboardReportMetadata | null | undefined,
): ReportAnnotation[] {
  const verdicts: readonly string[] = VERDICT_CODES;
  return (report?.annotations ?? []).filter((a) => !verdicts.includes(a.code));
}

export interface VersionHistoryView {
  /** Bundle path of the full-history report, or null when this run did not publish one. */
  historyReport: string | null;
  /** Whether the numbers on screen cover the full history (else the current version only). */
  coversFullHistory: boolean;
  versions: ReportVersion[];
}

/** Version history of a report, or null for a deployment with a single version. */
export function versionHistory(
  report: DashboardReportMetadata | null | undefined,
): VersionHistoryView | null {
  const versions = Array.isArray(report?.versions) ? report.versions : [];
  if (versions.length === 0) return null;
  const codes = new Set((report?.annotations ?? []).map((a) => a.code));
  return {
    historyReport: report?.history_report || null,
    coversFullHistory: codes.has('FULL_HISTORY') && !codes.has('CURRENT_VERSION_ONLY'),
    versions,
  };
}

export type VenueMtmView =
  | { kind: 'ok'; cards: { label: string; value: string }[] }
  | { kind: 'unavailable'; reason: string };

/** The venue mark-to-market headline, or null when the report has none (or a bad shape). */
export function venueMtmView(
  report: DashboardReportMetadata | null | undefined,
): VenueMtmView | null {
  const mtm = report?.venue_mtm as Record<string, unknown> | undefined;
  if (!mtm || typeof mtm !== 'object') return null;
  if (mtm.status === 'ok' && Array.isArray(mtm.cards)) {
    const cards = mtm.cards.filter(
      (c): c is { label: string; value: string } =>
        typeof c?.label === 'string' && typeof c?.value === 'string',
    );
    return cards.length ? { kind: 'ok', cards } : null;
  }
  if (mtm.status === 'unavailable') {
    return {
      kind: 'unavailable',
      reason: typeof mtm.reason === 'string' && mtm.reason ? mtm.reason : 'no venue history',
    };
  }
  return null;
}
