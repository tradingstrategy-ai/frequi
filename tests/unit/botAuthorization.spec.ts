import { describe, expect, it } from 'vitest';
import {
  encodeBasicAuthorization,
  getBotAuthorizationHeaderName,
  isProxiedBotUrl,
  isReportsAuthChallenge,
} from '@/utils/botAuthorization';

describe('bot proxy authorization', () => {
  it('uses a separate header for same-origin bot proxy URLs', () => {
    expect(getBotAuthorizationHeaderName('/api/bots/apex')).toBe('X-Bot-Authorization');
    expect(getBotAuthorizationHeaderName('/api/bots/derive/api/v1')).toBe('X-Bot-Authorization');
  });

  it('keeps the standard header for direct bot URLs', () => {
    expect(getBotAuthorizationHeaderName('http://100.90.145.1:8101')).toBe('Authorization');
    expect(getBotAuthorizationHeaderName('/api/v1')).toBe('Authorization');
  });

  it('routes same-origin absolute proxy URLs through the custom header', () => {
    // The URL a user copies out of the address bar must behave like the
    // relative preset form, otherwise the bot credentials would land in
    // Authorization and clobber the reports BasicAuth Caddy validates.
    expect(isProxiedBotUrl('http://localhost:3000/api/bots/gmx')).toBe(true);
    expect(getBotAuthorizationHeaderName('http://localhost:3000/api/bots/gmx')).toBe(
      'X-Bot-Authorization',
    );
    expect(getBotAuthorizationHeaderName('/api/bots/gmx/')).toBe('X-Bot-Authorization');
  });

  it('treats a foreign host under the same path as a direct bot', () => {
    expect(isProxiedBotUrl('https://other.example.com/api/bots/gmx')).toBe(false);
    expect(getBotAuthorizationHeaderName('https://other.example.com/api/bots/gmx')).toBe(
      'Authorization',
    );
    // Protocol-relative: the host is "api", not this origin.
    expect(isProxiedBotUrl('//api/bots/gmx')).toBe(false);
  });

  it('treats an empty or unparseable URL as a direct bot', () => {
    expect(isProxiedBotUrl('')).toBe(false);
    expect(isProxiedBotUrl('http://')).toBe(false);
    expect(getBotAuthorizationHeaderName('')).toBe('Authorization');
  });

  it('encodes bot Basic credentials as UTF-8 before base64', () => {
    expect(encodeBasicAuthorization('trader', 'secret')).toBe('Basic dHJhZGVyOnNlY3JldA==');
    expect(encodeBasicAuthorization('trädér', 'päss')).toBe('Basic dHLDpGTDqXI6cMOkc3M=');
  });
});

describe('reports auth challenge detection', () => {
  it('recognises the Caddy reports challenge', () => {
    expect(isReportsAuthChallenge({ 'www-authenticate': 'Basic realm="restricted"' })).toBe(true);
    // Header names are case-insensitive and Caddy may not quote the realm.
    expect(isReportsAuthChallenge({ 'WWW-Authenticate': 'basic realm=restricted' })).toBe(true);
  });

  it('reads AxiosHeaders-style objects', () => {
    const headers = {
      get: (name: string) =>
        name.toLowerCase() === 'www-authenticate' ? 'Basic realm="restricted"' : undefined,
    };
    expect(isReportsAuthChallenge(headers)).toBe(true);
  });

  it('does not mistake the bot own Basic challenge for the reports gate', () => {
    // freqtrade serves /api/v1/token/login behind FastAPI HTTPBasic, whose 401
    // also carries a Basic challenge - only the reports realm may skip refresh.
    expect(isReportsAuthChallenge({ 'www-authenticate': 'Basic' })).toBe(false);
    expect(isReportsAuthChallenge({ 'www-authenticate': 'Basic realm="freqtrade"' })).toBe(false);
    expect(isReportsAuthChallenge({ 'www-authenticate': 'Bearer realm="restricted"' })).toBe(false);
  });

  it('handles a response with no challenge at all', () => {
    expect(isReportsAuthChallenge({})).toBe(false);
    expect(isReportsAuthChallenge(undefined)).toBe(false);
    expect(isReportsAuthChallenge(null)).toBe(false);
  });
});
