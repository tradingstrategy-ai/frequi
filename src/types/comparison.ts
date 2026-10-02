export interface DashboardReportMetadata {
  schema_version: string;
  snapshot_id: string;
  status: string;
  reason: string | null;
  generated_at: string | null;
  report_date: string | null;
  report_window: { start: string; end: string } | null;
  stale: boolean;
  source_artifacts: string[];
  unavailable_fields: string[];
  annotations: { code: string; note: string }[];
}

export interface MetricsResult {
  total_trades: number | null;
  win_rate_pct: number | null;
  profit_factor: number | null;
  max_drawdown_pct: number | null;
  sharpe_ratio: number | null;
  avg_duration_hours: number | null;
  total_profit_pct: number | null;
  expectancy: number | null;
}

export interface EquityPoint {
  date: string;
  value: number | null;
}

export interface EquityCurveData {
  live: EquityPoint[];
  bt: EquityPoint[];
}

export interface TradeInfo {
  pair: string;
  direction: 'LONG' | 'SHORT' | null;
  open_date: string;
  close_date: string;
  open_rate: number | null;
  close_rate: number | null;
  profit_ratio: number | null;
  exit_reason?: string;
  bot_id?: string;
}

export interface MatchedTrade {
  live_trade: TradeInfo;
  bt_trade: TradeInfo;
  entry_delay_minutes: number | null;
  exit_delay_minutes: number | null;
  entry_slippage_pct: number | null;
  exit_slippage_pct: number | null;
  profit_diff_pct: number | null;
}

export interface MatchSummary {
  matched: number | null;
  live_only: number | null;
  bt_only: number | null;
  match_rate_pct: number | null;
}

export interface DailyProfitBar {
  date: string;
  live_profit: number | null;
  bt_profit: number | null;
  live_count: number | null;
  bt_count: number | null;
}

export interface MonthlyHeatmapRow {
  year: number;
  month: number;
  live_return: number | null;
  bt_return: number | null;
}

export interface OverviewResponse {
  live_metrics: MetricsResult;
  bt_metrics: MetricsResult;
  equity_curve: EquityCurveData;
  match_summary: MatchSummary;
  daily_profit: DailyProfitBar[];
  monthly_heatmap: MonthlyHeatmapRow[];
  report: DashboardReportMetadata;
}

export interface TimelineResponse {
  gantt: Record<string, unknown>[];
  matched_trades: MatchedTrade[];
  delays: Record<string, unknown>;
  unmatched: Record<string, unknown>;
  match_summary: Partial<MatchSummary>;
  report: DashboardReportMetadata;
}

export interface PairHeatmapRow {
  pair: string;
  bt_profit: number | null;
  live_profit: number | null;
  diff: number | null;
}

export interface ExitReasonRow {
  reason: string;
  bt_count: number | null;
  live_count: number | null;
  bt_profit: number | null;
  live_profit: number | null;
}

export interface PairsResponse {
  pair_heatmap: PairHeatmapRow[];
  pair_overlap: Record<string, unknown>;
  exit_reasons: ExitReasonRow[];
  categories: Record<string, unknown>[];
  profit_distribution: Record<string, unknown>;
  report: DashboardReportMetadata;
}

export interface SlippageRow {
  pair: string;
  avg_entry_slippage_pct: number | null;
  avg_exit_slippage_pct: number | null;
  trade_count: number | null;
}

export interface TradesResponse {
  best_worst: Record<string, unknown>;
  slippage: SlippageRow[];
  duration_boxplot: Record<string, unknown>;
  by_direction: Record<string, unknown>;
  scatter: Record<string, unknown>[];
  report: DashboardReportMetadata;
}

export interface BtMarker {
  pair: string;
  date: string;
  price: number | null;
  type: 'entry' | 'exit';
  direction: 'LONG' | 'SHORT' | null;
  is_matched: boolean;
}

export interface CandlesResponse {
  bt_markers: BtMarker[];
  live_markers: BtMarker[];
  report: DashboardReportMetadata;
}

export interface ComparisonBotInfo {
  bot_id: string;
  bot_type: 'FT' | 'NT';
  display_name: string;
  venue: string | null;
  sleeves: string[];
  is_vault: boolean;
  last_sync?: string | null;
  report: DashboardReportMetadata;
}

export interface ComparisonBotsResponse {
  bots: ComparisonBotInfo[];
}
