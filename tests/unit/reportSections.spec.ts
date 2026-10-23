import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => {
  const get = vi.fn();
  return { create: vi.fn(() => ({ get })), get, isAxiosError: vi.fn(() => false) };
});
vi.mock('axios', () => ({
  default: { create: axiosMock.create, isAxiosError: axiosMock.isAxiosError },
}));

import {
  REPORT_TAB_LABELS,
  fetchReportFigure,
  fetchReportSections,
  fetchTradeMarkers,
} from '@/composables/reportSections';

describe('reportSections API', () => {
  beforeEach(() => {
    axiosMock.get.mockReset().mockImplementation(async () => ({ data: { ok: true } }));
  });

  it('uses the same-origin comparison API with a long timeout for big reports', () => {
    expect(axiosMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: '/api/comparison',
        withCredentials: false,
        timeout: 120_000,
      }),
    );
  });

  it('requests sections, one figure and pair markers with encoded ids', async () => {
    await fetchReportSections('bb-revert');
    await fetchReportSections('derive/2', 'central:sigcombo/report.html');
    await fetchReportFigure('bb-revert', 'bb-revert-all_20261015.html', 'f5bd');
    await fetchReportFigure('bb-revert', undefined, 'f5bd');
    await fetchTradeMarkers('bb-revert', 'AVAX/USDC:USDC');

    expect(axiosMock.get).toHaveBeenNthCalledWith(1, '/bb-revert/sections', { params: {} });
    expect(axiosMock.get).toHaveBeenNthCalledWith(2, '/derive%2F2/sections', {
      params: { report: 'central:sigcombo/report.html' },
    });
    expect(axiosMock.get).toHaveBeenNthCalledWith(3, '/bb-revert/figure', {
      params: { id: 'f5bd', report: 'bb-revert-all_20261015.html' },
    });
    expect(axiosMock.get).toHaveBeenNthCalledWith(4, '/bb-revert/figure', {
      params: { id: 'f5bd' },
    });
    expect(axiosMock.get).toHaveBeenNthCalledWith(5, '/bb-revert/markers', {
      params: { pair: 'AVAX/USDC:USDC' },
    });
  });

  it('labels every Compare tab a report chunk can land in', () => {
    expect(Object.keys(REPORT_TAB_LABELS)).toEqual([
      'overview',
      'execution',
      'timeline',
      'pairs',
      'universe',
      'trades',
    ]);
  });
});

describe('isEmptyFigure', () => {
  it('flags a figure without traces, not one with data', async () => {
    const { isEmptyFigure } = await import('@/composables/reportSections');
    expect(isEmptyFigure({ data: [], layout: {} })).toBe(true);
    expect(isEmptyFigure({ data: [{ x: [1], y: [2] }], layout: {} })).toBe(false);
  });
});
