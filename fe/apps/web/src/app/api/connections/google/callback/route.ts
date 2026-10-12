import { NextResponse, type NextRequest } from "next/server";
import { completeGoogleConnect, googleConfigured, googleStateKey, recordGoogleFailure } from "@/lib/google";
import { DRIVE_PURPOSE, isConsentFailure, safeReturnTo, siteOrigin, verifyState, withResult } from "@/lib/google-sheets-core";
import { completeDriveConnect } from "@/lib/knowledge/drive-grant";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Google OAuth callback. /api/connections is public in the proxy, so this route checks the session itself: the signed-in user must be the
 * one the signed state was issued to and an active owner|manager of the state's workspace. Then the code is exchanged and the one Google
 * connection of the workspace is stored (tokens encrypted). The browser goes back to the state's return path with ?google=ok or
 * ?google=error&reason=<code>. The same route serves the Drive read grant (state purpose drive_read): that one stores the 'google_drive'
 * connection and answers ?drive=ok / ?drive=error&reason=<code> (the Add documents drawer reopens from it). A missing Google client never crashes: it answers reason=unavailable.
 */
export const dynamic = "force-dynamic";

const early = (to: string, result: "ok" | "error", reason?: string) => NextResponse.redirect(`${siteOrigin()}${withResult(to, result, reason)}`);

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  let key: Buffer;
  try {
    key = googleStateKey();
  } catch {
    return early("/connections", "error", "unavailable");
  }
  const state = verifyState(key, q.get("state"));
  if (!state) return early("/connections", "error", "state");
  const returnTo = safeReturnTo(state.r);
  const drive = state.p === DRIVE_PURPOSE;
  const back = (to: string, result: "ok" | "error", reason?: string) => NextResponse.redirect(`${siteOrigin()}${withResult(to, result, reason, drive ? "drive" : "google")}`);
  if (!googleConfigured()) return back(returnTo, "error", "unavailable");

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.id !== state.u) return back(returnTo, "error", "session");
  const { data: member } = await supabase.from("workspace_members").select("role, status").eq("workspace_id", state.w).eq("user_id", data.user.id).maybeSingle();
  if (!member || member.status !== "active" || !["owner", "manager"].includes(member.role as string)) return back(returnTo, "error", "forbidden");

  const denied = q.get("error");
  if (denied) {
    if (!drive) await recordGoogleFailure(state.w, state.u, denied).catch(() => undefined);
    return back(returnTo, "error", isConsentFailure(denied) ? (denied === "access_denied" ? "denied" : "unavailable") : "failed");
  }
  const code = q.get("code");
  if (!code) return back(returnTo, "error", "failed");

  try {
    if (drive) await completeDriveConnect(state.w, state.u, code);
    else await completeGoogleConnect(state.w, state.u, code);
    return back(returnTo, "ok");
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code && isConsentFailure(err.code)) {
      if (!drive) await recordGoogleFailure(state.w, state.u, err.code).catch(() => undefined);
      return back(returnTo, "error", "unavailable");
    }
    console.error(drive ? "google drive grant failed" : "google connect failed", err.message ?? e);
    return back(returnTo, "error", err.message === "no_refresh_token" ? "no_refresh" : err.message === "scope_missing" ? "scope" : "failed");
  }
}
