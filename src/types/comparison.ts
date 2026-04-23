export interface MetricsResult {
  total_trades: number;
  win_rate_pct: number;
  profit_factor: number;
  max_drawdown_pct: number;
  sharpe_ratio: number | null;
  avg_duration_hours: number;
  total_profit_pct: number;
  expectancy: number;
}

export interface EquityPoint {
  date: string;
  value: number;
}

export interface EquityCurveData {
  live: EquityPoint[];
  bt: EquityPoint[];
}

export interface TradeInfo {
  pair: string;
  direction: 'LONG' | 'SHORT';
  open_date: string;
  close_date: string;
  open_rate: number;
  close_rate: number;
  profit_ratio: number;
  exit_reason?: string;
  bot_id?: string;
}

export interface MatchedTrade {
  live_trade: TradeInfo;
  bt_trade: TradeInfo;
  entry_delay_minutes: number;
  exit_delay_minutes: number;
  entry_slippage_pct: number;
  exit_slippage_pct: number;
  profit_diff_pct: number;
}

export interface MatchSummary {
  matched: number;
  live_only: number;
  bt_only: number;
  match_rate_pct: number;
}

export interface DailyProfitBar {
  date: string;
  live_profit: number;
  bt_profit: number;
  live_count: number;
  bt_count: number;
}

export interface MonthlyHeatmapRow {
  year: number;
  month: number;
  live_return: number;
  bt_return: number;
}

export interface OverviewResponse {
  live_metrics: MetricsResult;
  bt_metrics: MetricsResult;
  equity_curve: EquityCurveData;
  match_summary: MatchSummary;
  daily_profit: DailyProfitBar[];
  monthly_heatmap: MonthlyHeatmapRow[];
}

export interface TimelineResponse {
  gantt: Record<string, unknown>[];
  matched_trades: MatchedTrade[];
  delays: Record<string, unknown>;
  unmatched: Record<string, unknown>;
  match_summary: Partial<MatchSummary>;
}

export interface PairHeatmapRow {
  pair: string;
  bt_profit: number;
  live_profit: number;
  diff: number;
}

export interface ExitReasonRow {
  reason: string;
  bt_count: number;
  live_count: number;
  bt_profit: number;
  live_profit: number;
}

export interface PairsResponse {
  pair_heatmap: PairHeatmapRow[];
  pair_overlap: Record<string, unknown>;
  exit_reasons: ExitReasonRow[];
  categories: Record<string, unknown>[];
  profit_distribution: Record<string, unknown>;
}

export interface SlippageRow {
  pair: string;
  avg_entry_slippage_pct: number;
  avg_exit_slippage_pct: number;
  trade_count: number;
}

export interface TradesResponse {
  best_worst: Record<string, unknown>;
  slippage: SlippageRow[];
  duration_boxplot: Record<string, unknown>;
  by_direction: Record<string, unknown>;
  scatter: Record<string, unknown>[];
}

export interface BtMarker {
  pair: string;
  date: string;
  price: number;
  type: 'entry' | 'exit';
  direction: 'LONG' | 'SHORT';
  is_matched: boolean;
}

export interface CandlesResponse {
  bt_markers: BtMarker[];
  live_markers: BtMarker[];
}

export interface ComparisonBotInfo {
  bot_id: string;
  bot_type: 'FT' | 'NT';
  display_name: string;
  is_vault: boolean;
  last_sync?: string;
}

export interface ComparisonBotsResponse {
  bots: ComparisonBotInfo[];
}

export interface ComparisonBacktestStatus {
  status: 'idle' | 'queued' | 'running' | 'completed' | 'error';
  bot_id?: string;
  cache_key?: string;
  error?: string;
}
