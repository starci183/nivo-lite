import { headers } from "next/headers";
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
export const perfFetch: typeof fetch | undefined = PERF_ENABLED
  ? async (input, init) => {
      const started = performance.now();
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
        return await fetch(input, init);
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
          return await fetch(input, init);
        } finally {
          console.log(`[perf] rid=${rid} ${route} proxy ${opOf(input, init)} ${Math.round(performance.now() - started)}ms`);
        }
      }
    : undefined;
