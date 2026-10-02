import axios from 'axios';

import { getComparisonApiBase } from '@/config/presetBots';
import type {
  CandlesResponse,
  ComparisonBotsResponse,
  OverviewResponse,
  PairsResponse,
  TimelineResponse,
  TradesResponse,
} from '@/types';

// Relative URLs intentionally keep report requests behind the current origin's auth proxy.
const comparisonApi = axios.create({
  baseURL: getComparisonApiBase(),
  timeout: 20000,
  withCredentials: false,
});

function comparisonParams(timerange?: string, sleeve?: string): Record<string, string> {
  return {
    ...(timerange ? { timerange } : {}),
    ...(sleeve ? { sleeve } : {}),
  };
}

export async function fetchComparisonBots(): Promise<ComparisonBotsResponse> {
  const { data } = await comparisonApi.get<ComparisonBotsResponse>('/bots');
  return data;
}

export async function fetchOverview(
  botId: string,
  timerange?: string,
  sleeve?: string,
): Promise<OverviewResponse> {
  const { data } = await comparisonApi.get<OverviewResponse>(`/${encodeURIComponent(botId)}/overview`, {
    params: comparisonParams(timerange, sleeve),
  });
  return data;
}

export async function fetchTimeline(
  botId: string,
  timerange?: string,
  sleeve?: string,
): Promise<TimelineResponse> {
  const { data } = await comparisonApi.get<TimelineResponse>(`/${encodeURIComponent(botId)}/timeline`, {
    params: comparisonParams(timerange, sleeve),
  });
  return data;
}

export async function fetchPairs(
  botId: string,
  timerange?: string,
  sleeve?: string,
): Promise<PairsResponse> {
  const { data } = await comparisonApi.get<PairsResponse>(`/${encodeURIComponent(botId)}/pairs`, {
    params: comparisonParams(timerange, sleeve),
  });
  return data;
}

export async function fetchTrades(
  botId: string,
  timerange?: string,
  sleeve?: string,
): Promise<TradesResponse> {
  const { data } = await comparisonApi.get<TradesResponse>(`/${encodeURIComponent(botId)}/trades`, {
    params: comparisonParams(timerange, sleeve),
  });
  return data;
}

export async function fetchComparisonCandles(
  botId: string,
  pair: string,
  timeframe: string,
  timerange?: string,
  sleeve?: string,
): Promise<CandlesResponse> {
  const { data } = await comparisonApi.get<CandlesResponse>(`/${encodeURIComponent(botId)}/candles`, {
    params: {
      pair,
      timeframe,
      ...comparisonParams(timerange, sleeve),
    },
  });
  return data;
}
