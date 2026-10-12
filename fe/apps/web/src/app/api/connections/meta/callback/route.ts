import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyState } from "@/lib/google-sheets-core";
import { getCurrentMember } from "@/lib/members";
import { isManagerRole } from "@/lib/members-shared";
import { exchangeCode, listPages, loadMetaSecret, saveMetaSecret } from "@/lib/meta";
import { META_STATE_PURPOSE, metaApp, metaStateKey } from "@/lib/meta-core";
import { requestOrigin } from "@/lib/request-origin";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Where Meta sends the browser after the owner logs in (Facebook Login for Business): ?code=...&state=<signed>. The state binds this return
 * to the workspace, the signed-in person and the connection the wizard started (valid 10 minutes); the signed-in member must still be that
 * owner|manager. The code is exchanged for a long-lived user token, the Pages the person manages are listed with their Page tokens and
 * linked Instagram accounts, and they are kept encrypted until the owner picks one (then only that Page's token stays).
 * The browser lands back on Connections with the wizard open at "pick the Page": ?meta=ok|denied|failed|nopages|expired|unavailable&id=<connection>.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const origin = requestOrigin(request);
  const back = (result: string, id?: string) => NextResponse.redirect(new URL(`/connections?connect=meta&meta=${result}${id ? `&id=${id}` : ""}`, origin));

  let key: Buffer;
  try {
    key = metaStateKey(process.env.CHANNEL_TOKEN_KEY);
  } catch {
    return back("unavailable");
  }
  const state = verifyState(key, q.get("state"));
  const connectionId = state ? new URL(state.r, "http://local").searchParams.get("id") ?? "" : "";
  if (!state || state.p !== META_STATE_PURPOSE || !UUID.test(connectionId)) return back(state ? "failed" : "expired");
  if (!metaApp()) return back("unavailable", connectionId);

  try {
    const me = await getCurrentMember();
    if (me.userId !== state.u || me.workspaceId !== state.w || !isManagerRole(me.role)) return back("denied", connectionId);
    const db = supabaseAdmin();
    const { data: conn } = await db.from("connections").select("id, workspace_id, provider, status").eq("id", connectionId).maybeSingle<{ id: string; workspace_id: string; provider: string; status: string }>();
    if (!conn || conn.provider !== "meta" || conn.workspace_id !== state.w || conn.status === "disconnected") return back("denied", connectionId);

    if (q.get("error") || !q.get("code")) return back("denied", connectionId);
    const userToken = await exchangeCode(q.get("code") as string);
    const pages = await listPages(userToken);
    if (pages.length === 0) return back("nopages", connectionId);
    // Only the Page tokens are kept (they do not expire); the user token is not needed again. A Page chosen earlier keeps working until a new one is picked.
    const current = await loadMetaSecret(connectionId);
    await saveMetaSecret(connectionId, { ...(current?.secret ?? {}), pages });
    revalidatePath("/", "layout");
    return back("ok", connectionId);
  } catch (e) {
    console.error("meta oauth callback failed", e instanceof Error ? e.message : e);
    return back("failed", connectionId);
  }
}
