import { NextResponse, type NextRequest } from "next/server";
import { completeGoogleConnect, googleConfigured, googleStateKey, recordGoogleFailure } from "@/lib/google";
import { isConsentFailure, safeReturnTo, siteOrigin, verifyState, withResult } from "@/lib/google-sheets-core";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Google OAuth callback. /api/connections is public in the proxy, so this route checks the session itself: the signed-in user must be the
 * one the signed state was issued to and an active owner|manager of the state's workspace. Then the code is exchanged and the one Google
 * connection of the workspace is stored (tokens encrypted). The browser goes back to the state's return path with ?google=ok or
 * ?google=error&reason=<code>. A missing Google client never crashes: it answers reason=unavailable.
 */
export const dynamic = "force-dynamic";

const back = (to: string, result: "ok" | "error", reason?: string) => NextResponse.redirect(`${siteOrigin()}${withResult(to, result, reason)}`);

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  let key: Buffer;
  try {
    key = googleStateKey();
  } catch {
    return back("/connections", "error", "unavailable");
  }
  const state = verifyState(key, q.get("state"));
  if (!state) return back("/connections", "error", "state");
  const returnTo = safeReturnTo(state.r);
  if (!googleConfigured()) return back(returnTo, "error", "unavailable");

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.id !== state.u) return back(returnTo, "error", "session");
  const { data: member } = await supabase.from("workspace_members").select("role, status").eq("workspace_id", state.w).eq("user_id", data.user.id).maybeSingle();
  if (!member || member.status !== "active" || !["owner", "manager"].includes(member.role as string)) return back(returnTo, "error", "forbidden");

  const denied = q.get("error");
  if (denied) {
    await recordGoogleFailure(state.w, state.u, denied).catch(() => undefined);
    return back(returnTo, "error", isConsentFailure(denied) ? (denied === "access_denied" ? "denied" : "unavailable") : "failed");
  }
  const code = q.get("code");
  if (!code) return back(returnTo, "error", "failed");

  try {
    await completeGoogleConnect(state.w, state.u, code);
    return back(returnTo, "ok");
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code && isConsentFailure(err.code)) {
      await recordGoogleFailure(state.w, state.u, err.code).catch(() => undefined);
      return back(returnTo, "error", "unavailable");
    }
    console.error("google connect failed", err.message ?? e);
    return back(returnTo, "error", err.message === "no_refresh_token" ? "no_refresh" : "failed");
  }
}
