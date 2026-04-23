import axios from 'axios';

import { getComparisonApiBase } from '@/config/presetBots';
import type {
  CandlesResponse,
  ComparisonBacktestStatus,
  ComparisonBotsResponse,
  OverviewResponse,
  PairsResponse,
  TimelineResponse,
  TradesResponse,
} from '@/types';

const comparisonApi = axios.create({
  baseURL: getComparisonApiBase(),
  timeout: 20000,
  withCredentials: false,
});

function withTimerange(timerange?: string): Record<string, string> | undefined {
  return timerange ? { timerange } : undefined;
}

export async function fetchComparisonBots(): Promise<ComparisonBotsResponse> {
  const { data } = await comparisonApi.get<ComparisonBotsResponse>('/api/comparison/bots');
  return data;
}

export async function fetchOverview(botId: string, timerange?: string): Promise<OverviewResponse> {
  const { data } = await comparisonApi.get<OverviewResponse>(`/api/comparison/${botId}/overview`, {
    params: withTimerange(timerange),
  });
  return data;
}

export async function fetchTimeline(botId: string, timerange?: string): Promise<TimelineResponse> {
  const { data } = await comparisonApi.get<TimelineResponse>(`/api/comparison/${botId}/timeline`, {
    params: withTimerange(timerange),
  });
  return data;
}

export async function fetchPairs(botId: string, timerange?: string): Promise<PairsResponse> {
  const { data } = await comparisonApi.get<PairsResponse>(`/api/comparison/${botId}/pairs`, {
    params: withTimerange(timerange),
  });
  return data;
}

export async function fetchTrades(botId: string, timerange?: string): Promise<TradesResponse> {
  const { data } = await comparisonApi.get<TradesResponse>(`/api/comparison/${botId}/trades`, {
    params: withTimerange(timerange),
  });
  return data;
}

export async function fetchComparisonCandles(
  botId: string,
  pair: string,
  timeframe: string,
): Promise<CandlesResponse> {
  const { data } = await comparisonApi.get<CandlesResponse>(`/api/comparison/${botId}/candles`, {
    params: {
      pair,
      timeframe,
    },
  });
  return data;
}

export async function triggerComparisonBacktest(botId: string): Promise<ComparisonBacktestStatus> {
  const { data } = await comparisonApi.post<ComparisonBacktestStatus>(
    `/api/comparison/${botId}/backtest`,
  );
  return data;
}

export async function fetchComparisonBacktestStatus(
  botId: string,
): Promise<ComparisonBacktestStatus> {
  const { data } = await comparisonApi.get<ComparisonBacktestStatus>(
    `/api/comparison/${botId}/backtest/status`,
  );
  return data;
}
