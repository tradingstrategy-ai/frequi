import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findProxiedBotRoute, parseBotRouteMap, toProxiedBotUrl } from '@/utils/knownBotUrls';

const DASHBOARD_HOST = '192.0.2.10';

describe('knownBotUrls', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_KNOWN_BOT_HOSTNAMES', 'gmx.bots.example.com=gmx,apex.bots.example.com=apex');
    vi.stubEnv('VITE_KNOWN_BOT_PORTS', '9098=gmx,9109=apex,9110=dipbuyer,8101=derive,8114=derive');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('routes the public bot hostnames through the same-origin proxy', () => {
    expect(toProxiedBotUrl('http://gmx.bots.example.com', DASHBOARD_HOST)).toBe('/api/bots/gmx');
    expect(toProxiedBotUrl('http://apex.bots.example.com/', DASHBOARD_HOST)).toBe('/api/bots/apex');
    expect(toProxiedBotUrl('HTTP://GMX.Bots.Example.com ', DASHBOARD_HOST)).toBe('/api/bots/gmx');
  });

  it('routes bot ports on the dashboard host through the proxy', () => {
    expect(toProxiedBotUrl('http://192.0.2.10:9098', DASHBOARD_HOST)).toBe('/api/bots/gmx');
    expect(toProxiedBotUrl('http://192.0.2.10:9109/', DASHBOARD_HOST)).toBe('/api/bots/apex');
    expect(toProxiedBotUrl('http://192.0.2.10:9110', DASHBOARD_HOST)).toBe('/api/bots/dipbuyer');
    expect(toProxiedBotUrl('http://192.0.2.10:8114', DASHBOARD_HOST)).toBe('/api/bots/derive');
  });

  it('leaves bot ports on any other host alone', () => {
    expect(toProxiedBotUrl('http://192.0.2.20:9098', DASHBOARD_HOST)).toBe(
      'http://192.0.2.20:9098',
    );
    expect(toProxiedBotUrl('http://localhost:9098', DASHBOARD_HOST)).toBe('http://localhost:9098');
  });

  it('does not rewrite unknown ports, custom paths, or non-URLs', () => {
    expect(toProxiedBotUrl('http://192.0.2.10:9198', DASHBOARD_HOST)).toBe(
      'http://192.0.2.10:9198',
    );
    expect(toProxiedBotUrl('http://192.0.2.10', DASHBOARD_HOST)).toBe('http://192.0.2.10');
    expect(toProxiedBotUrl('http://gmx.bots.example.com/custom', DASHBOARD_HOST)).toBe(
      'http://gmx.bots.example.com/custom',
    );
    expect(toProxiedBotUrl('/api/bots/gmx', DASHBOARD_HOST)).toBe('/api/bots/gmx');
    expect(toProxiedBotUrl('not a url', DASHBOARD_HOST)).toBe('not a url');
    expect(findProxiedBotRoute('', DASHBOARD_HOST)).toBeUndefined();
    expect(findProxiedBotRoute(undefined, DASHBOARD_HOST)).toBeUndefined();
  });

  it('rewrites nothing when the build environment sets no routes', () => {
    vi.stubEnv('VITE_KNOWN_BOT_HOSTNAMES', '');
    vi.stubEnv('VITE_KNOWN_BOT_PORTS', '');
    expect(toProxiedBotUrl('http://gmx.bots.example.com', DASHBOARD_HOST)).toBe(
      'http://gmx.bots.example.com',
    );
    expect(toProxiedBotUrl('http://192.0.2.10:9098', DASHBOARD_HOST)).toBe(
      'http://192.0.2.10:9098',
    );
  });

  describe('parseBotRouteMap', () => {
    it('parses key=bot lists, trimming whitespace and lower-casing hostnames on request', () => {
      expect(parseBotRouteMap(' A.Example.com = gmx , b.example.com=apex ', true)).toEqual({
        'a.example.com': '/api/bots/gmx',
        'b.example.com': '/api/bots/apex',
      });
      expect(parseBotRouteMap('9098=gmx')).toEqual({ '9098': '/api/bots/gmx' });
      expect(parseBotRouteMap(undefined)).toEqual({});
      expect(parseBotRouteMap('')).toEqual({});
    });

    it('skips malformed entries and bot names that are not simple slugs', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(parseBotRouteMap('nobot,=gmx,9098=,9098=../x,9098=a=b,9109=apex')).toEqual({
        '9109': '/api/bots/apex',
      });
      expect(warn).toHaveBeenCalledTimes(5);
      warn.mockRestore();
    });
  });
});
