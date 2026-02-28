/**
 * proxyFetch — Centralized fetch wrapper for all outbound Polymarket API calls.
 *
 * Routes requests through CLOB_PROXY_URL if set in .env.
 * Falls back to direct fetch if no proxy is configured OR if the proxy
 * returns a connection error (HostUnreachable, ECONNREFUSED, etc.).
 *
 * Supports:
 *   socks5://user:pass@host:port  — requires: pnpm add socks-proxy-agent
 *   http://user:pass@host:port    — requires: pnpm add https-proxy-agent
 *
 * .env:
 *   CLOB_PROXY_URL=socks5://user:pass@geo.iproyal.com:12321
 *
 * Node 22 native fetch does NOT accept a `dispatcher` option directly.
 * We use node-fetch (bundled via tsx/ts-node) or the agent pattern below.
 * The safest cross-version approach is to use `node-fetch` for proxied requests
 * and native fetch for direct requests.
 */

import { RequestInit as NodeFetchInit } from 'node-fetch';

let _proxyFn: ((url: string, init?: NodeFetchInit) => Promise<Response>) | null = null;
let _initialized = false;
let _usingProxy = false;

/** Errors that indicate the proxy itself is down — fall back to direct */
const PROXY_DOWN_PATTERNS = [
  'HostUnreachable',
  'ECONNREFUSED',
  'ECONNRESET',
  'proxy rejected',
  'Socks5 proxy',
  'socks proxy',
];

function isProxyError(msg: string): boolean {
  return PROXY_DOWN_PATTERNS.some(p => msg.includes(p));
}

async function initProxy(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  const proxyUrl = process.env.CLOB_PROXY_URL;
  if (!proxyUrl) {
    console.log('[ProxyFetch] No CLOB_PROXY_URL — using direct requests');
    return;
  }

  try {
    if (proxyUrl.startsWith('socks')) {
      const { SocksProxyAgent } = await import('socks-proxy-agent');
      const { default: nodeFetch } = await import('node-fetch');
      const agent = new SocksProxyAgent(proxyUrl);
      _usingProxy = true;
      console.log(`[ProxyFetch] SOCKS5 proxy active → ${proxyUrl.replace(/:[^:@]+@/, ':***@')}`);
      _proxyFn = (url, init) => nodeFetch(url, { ...init, agent } as any) as any;
    } else {
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      const { default: nodeFetch } = await import('node-fetch');
      const agent = new HttpsProxyAgent(proxyUrl);
      _usingProxy = true;
      console.log(`[ProxyFetch] HTTP proxy active → ${proxyUrl.replace(/:[^:@]+@/, ':***@')}`);
      _proxyFn = (url, init) => nodeFetch(url, { ...init, agent } as any) as any;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ProxyFetch] Proxy agent init failed: ${msg}`);
    console.warn('[ProxyFetch] Run: pnpm add socks-proxy-agent node-fetch https-proxy-agent');
    console.warn('[ProxyFetch] Falling back to direct requests — geo-block may occur');
  }
}

/**
 * Drop-in replacement for fetch() that routes through the configured proxy.
 * If the proxy is unreachable, automatically retries the request directly.
 */
export async function polyFetch(
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  await initProxy();

  const urlStr = url.toString();

  if (_proxyFn) {
    try {
      return await _proxyFn(urlStr, init as NodeFetchInit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isProxyError(msg)) {
        console.warn(`[ProxyFetch] Proxy unreachable (${msg.split('\n')[0]}) — retrying direct`);
        return (fetch as any)(urlStr, init);
      }
      throw err;
    }
  }

  return (fetch as any)(urlStr, init);
}

export function isUsingProxy(): boolean {
  return _usingProxy;
}