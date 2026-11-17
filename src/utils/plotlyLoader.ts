/**
 * plotly.js, loaded on first use as its own chunk.
 *
 * Only the Compare report sections and the ranker widget draw with Plotly (the daily
 * reports are Plotly figures); the rest of FreqUI keeps ECharts, so the ~1 MB (gzipped)
 * library is fetched only when a report chart is shown.
 */
import type * as PlotlyTypes from 'plotly.js-dist-min';

type PlotlyModule = typeof PlotlyTypes;

let pending: Promise<PlotlyModule> | undefined;

export async function loadPlotly(): Promise<PlotlyModule> {
  pending ??= import('plotly.js-dist-min').then(
    (module) => (module as unknown as { default?: PlotlyModule }).default ?? module,
  );
  return pending;
}
