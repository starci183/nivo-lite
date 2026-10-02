import { headers } from "next/headers";
import { AsyncLocalStorage } from "node:async_hooks";
import { after } from "next/server";

/**
 * Optional per-request query timing, switched on with PERF_LOG=1 (off = zero overhead, the clients use the stock fetch).
 * Every Supabase HTTP call made through a wrapped client logs one line, and `after()` logs one total per request:
 *   [perf] rid=ab12cd34 /dashboard q#3 GET /rest/v1/leads 214ms
 *   [perf] rid=ab12cd34 /dashboard TOTAL queries=9 query_ms=1890 wall_ms=1240
 * Only method + path are logged: never the query string, headers or bodies (those carry filter values and tokens).
 * The proxy stamps each request with `x-nivo-rid` / `x-nivo-path`; calls outside a stamped request log as rid=-.
 */
export const PERF_ENABLED = process.env.PERF_LOG === "1";

export const PERF_RID_HEADER = "x-nivo-rid";
export const PERF_PATH_HEADER = "x-nivo-path";

/** `depth` = the longest chain of calls that each started after the previous one finished = sequential round trips. */
type Bucket = { n: number; ms: number; t0: number; route: string; depth: number };
const buckets = new Map<string, Bucket>();

const requestMeta = async (): Promise<{ rid: string; route: string }> => {
  try {
    const h = await headers();
    return { rid: h.get(PERF_RID_HEADER) ?? "-", route: h.get(PERF_PATH_HEADER) ?? "?" };
  } catch {
    return { rid: "-", route: "?" };
  }
};

const opOf = (input: RequestInfo | URL, init?: RequestInit): string => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let path = raw;
  try { path = new URL(raw).pathname; } catch { /* keep raw */ }
  const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
  return `${method} ${path}`;
};

/** `fetch` that times each call; pass it as `global.fetch` of a Supabase client. `undefined` when PERF_LOG is off. */
/**
 * Optional transport for server-side Supabase calls: HTTP/2 over ONE connection (undici, SUPABASE_H2=1). With HTTP/1.1 every
 * parallel query opens its own connection (TCP + TLS + request = 3 round trips at ~220 ms each from Netlify's region); HTTP/2 multiplexes
 * a whole wave over the connection the session lookup already opened. Off by default. With PERF_LOG=1 a request header
 * `x-nivo-h2: 1` turns it on for that request, so the two transports can be compared on the same deploy.
 */
export const H2_ENABLED = process.env.SUPABASE_H2 === "1";
let h2Agent: unknown = null;
const wantsH2 = async (): Promise<boolean> => {
  if (H2_ENABLED) return true;
  if (!PERF_ENABLED) return false;
  try { return (await headers()).get("x-nivo-h2") === "1"; } catch { return false; }
};
const sendH2: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!/^https:\/\/[^/]+\/(rest|auth)\/v1\//.test(url)) return fetch(input, init);
  const { Agent, fetch: undiciFetch } = await import("undici");
  h2Agent ??= new Agent({ allowH2: true, keepAliveTimeout: 20_000, keepAliveMaxTimeout: 60_000 });
  return (await undiciFetch(url, { ...(init as object), dispatcher: h2Agent as never } as never)) as unknown as Response;
};
const send: typeof fetch = async (input, init) => ((await wantsH2()) ? sendH2(input, init) : fetch(input, init));

const background = new AsyncLocalStorage<true>();
/** Work that runs after the response (queue drains): logged as `after`, not counted in the request's render-path total. */
export const runInBackground = <T,>(fn: () => Promise<T>): Promise<T> => (PERF_ENABLED ? background.run(true, fn) : fn());

export const perfFetch: typeof fetch | undefined = PERF_ENABLED
  ? async (input, init) => {
      const started = performance.now();
      if (background.getStore()) {
        try {
          return await send(input, init);
        } finally {
          console.log(`[perf] after ${opOf(input, init)} ${Math.round(performance.now() - started)}ms`);
        }
      }
      const { rid, route } = await requestMeta();
      let bucket = buckets.get(rid);
      if (!bucket) {
        bucket = { n: 0, ms: 0, t0: started, route, depth: 0 };
        if (rid !== "-") {
          buckets.set(rid, bucket);
          try {
            after(() => {
              const b = buckets.get(rid);
              buckets.delete(rid);
              if (b) console.log(`[perf] rid=${rid} ${b.route} TOTAL queries=${b.n} depth=${b.depth} query_ms=${Math.round(b.ms)} wall_ms=${Math.round(performance.now() - b.t0)}`);
            });
          } catch { /* outside a request scope: no summary */ }
        }
      }
      const myDepth = bucket.depth + 1; // everything finished so far could have been awaited before this call
      try {
        return await send(input, init);
      } finally {
        const ms = performance.now() - started;
        bucket.depth = Math.max(bucket.depth, myDepth);
        bucket.n += 1;
        bucket.ms += ms;
        console.log(`[perf] rid=${rid} ${route} q#${bucket.n} ${opOf(input, init)} ${Math.round(ms)}ms`);
      }
    }
  : undefined;

/** For the proxy (no `headers()` there): same timing line, tagged with the request it belongs to. */
export const perfFetchFor = (rid: string, route: string): typeof fetch | undefined =>
  PERF_ENABLED
    ? async (input, init) => {
        const started = performance.now();
        try {
          return await send(input, init);
        } finally {
          console.log(`[perf] rid=${rid} ${route} proxy ${opOf(input, init)} ${Math.round(performance.now() - started)}ms`);
        }
      }
    : undefined;

/** What the server-side Supabase clients pass as `global.fetch`: the timing wrapper (PERF_LOG=1; it also honours the HTTP/2 switch), the plain HTTP/2 transport (SUPABASE_H2=1), or (default) nothing = stock fetch. */
export const supabaseFetch: typeof fetch | undefined = PERF_ENABLED ? perfFetch : H2_ENABLED ? sendH2 : undefined;
