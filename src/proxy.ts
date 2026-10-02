import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicConfig } from "./lib/config";
import { PERF_ENABLED, PERF_PATH_HEADER, PERF_RID_HEADER, perfFetchFor } from "./lib/supabase/perf";

// Reachable without a session. Webhooks (Telegram, bank connection) are each verified by their own secret header; /api/engine by an HMAC (ENGINE_SHARED_SECRET), /api/n8n by a per-run bearer token (hash stored with an expiry).
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth", "/invite", "/api/telegram", "/api/connections", "/api/bank", "/api/sepay", "/api/engine", "/api/v1", "/api/automation", "/api/content", "/api/n8n", "/b", "/api/b", "/api/hiring", "/j", "/l"]; // /b/<slug> and /api/b/<slug>: the public booking page (rate limited, honeypot, gate)

const MEMBER_COOKIE = "nivo_member_gate"; // "<userId>.<ok|off>": short-lived cache of the membership check
const MEMBER_TTL_SECONDS = 60;

/** Segment-aware prefix match, so "/auth" never swallows "/authority". */
const isPublicPath = (pathname: string): boolean =>
  pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Only same-site paths may come back through `?next=`. */
const safeNext = (value: string | null): string | null => (value && value.startsWith("/") && !value.startsWith("//") ? value : null);

export async function proxy(request: NextRequest) {
  // PERF_LOG=1 only: stamp the request so server-side query timings can be grouped per request.
  const rid = PERF_ENABLED ? crypto.randomUUID().slice(0, 8) : "";
  const stamped = (): NextResponse => {
    if (!PERF_ENABLED) return NextResponse.next({ request });
    const headers = new Headers(request.headers);
    headers.set(PERF_RID_HEADER, rid);
    headers.set(PERF_PATH_HEADER, request.nextUrl.pathname);
    return NextResponse.next({ request: { headers } });
  };
  let response = stamped();
  const supabase = createServerClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
    global: { fetch: perfFetchFor(rid, request.nextUrl.pathname) },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = stamped();
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Refreshes an expiring token into the response cookies, and verifies the access token's signature + expiry locally against the
  // project's published signing key (cached): no Auth round trip per request. A session revoked elsewhere is noticed at the next
  // token refresh (at most an hour); the disabled-member gate below and every server-side session check still apply.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  /** A redirect that keeps any cookies the session refresh or sign-out just wrote. */
  const redirectTo = (url: URL) => {
    const out = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) out.cookies.set(cookie);
    return out;
  };

  if (!userId) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return redirectTo(url);
  }

  // Signed-in users who open the sign-in page go straight to where they were headed.
  if (pathname === "/login" && request.nextUrl.searchParams.get("reason") !== "disabled") {
    const url = request.nextUrl.clone();
    const next = safeNext(request.nextUrl.searchParams.get("next"));
    url.pathname = "/dashboard";
    url.search = "";
    return redirectTo(next ? new URL(next, request.nextUrl.origin) : url);
  }

  // A disabled member loses access immediately: sign out and send them to /login?reason=disabled.
  if (!isPublic && !pathname.startsWith("/api/")) {
    const cached = request.cookies.get(MEMBER_COOKIE)?.value;
    let verdict: "ok" | "off" | null = cached?.startsWith(`${userId}.`) ? (cached.endsWith(".off") ? "off" : "ok") : null;
    if (!verdict) {
      // Under RLS the user only sees their own membership rows. A failed lookup (e.g. schema not migrated) fails open.
      const { data: rows, error } = await supabase.from("workspace_members").select("status").eq("user_id", userId);
      if (!error) {
        verdict = rows && rows.length > 0 && rows.every((r: { status: string }) => r.status === "disabled") ? "off" : "ok";
        response.cookies.set(MEMBER_COOKIE, `${userId}.${verdict}`, { maxAge: MEMBER_TTL_SECONDS, path: "/", httpOnly: true, sameSite: "lax" });
      }
    }
    if (verdict === "off") {
      await supabase.auth.signOut({ scope: "local" });
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("reason", "disabled");
      const out = redirectTo(url);
      out.cookies.delete(MEMBER_COOKIE);
      return out;
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
