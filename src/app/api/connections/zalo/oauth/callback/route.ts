import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { safeEqual } from "@/lib/channels";
import { getCurrentMember } from "@/lib/members";
import { isManagerRole } from "@/lib/members-shared";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { REFRESH_TTL_MS, exchangeCode } from "@/lib/zalo-api";
import { loadZalo, registerRefreshTarget, saveZaloSecret } from "@/lib/zalo";

/**
 * Where Zalo sends the browser after the owner grants the OA permissions: ?code=...&oa_id=...&state=<connectionId>.<nonce>.
 * The state nonce is one use and expires after 15 minutes (it binds this return to the connection the owner started), the signed-in
 * member must be an owner/manager of that connection's workspace, and the PKCE verifier stored with the credential completes the code
 * exchange. Tokens are stored encrypted; the browser lands back on Connections with the wizard open on its check step.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const back = (qs: string) => NextResponse.redirect(new URL(`/connections?${qs}`, request.nextUrl.origin));
  const q = request.nextUrl.searchParams;
  const code = q.get("code");
  const [connectionId = "", nonce = ""] = (q.get("state") ?? "").split(".");
  if (!code || !UUID.test(connectionId) || !nonce) return back("zalo=denied");
  try {
    const me = await getCurrentMember();
    const loaded = await loadZalo(connectionId);
    const pkce = loaded?.secret.pkce;
    if (!loaded || !isManagerRole(me.role) || loaded.workspaceId !== me.workspaceId) return back("zalo=denied");
    if (!pkce || Date.now() > pkce.exp || !safeEqual(pkce.nonce, nonce)) return back(`zalo=expired&id=${connectionId}`);

    const tokens = await exchangeCode(loaded.secret.appId, loaded.secret.appSecret, code, pkce.verifier);
    const expiresAt = Date.now() + tokens.expiresInSeconds * 1000;
    await saveZaloSecret(connectionId, {
      ...loaded.secret, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(), pkce: undefined,
    }, { expiresAt, release: true });

    const db = supabaseAdmin();
    const { data: row } = await db.from("connections").select("public_meta, status").eq("id", connectionId).maybeSingle<{ public_meta: Record<string, string> | null; status: string }>();
    const oaId = q.get("oa_id");
    await db.from("connections").update({
      public_meta: { ...(row?.public_meta ?? {}), ...(oaId ? { oa_id: oaId } : {}) },
      ...(row?.status === "error" ? { status: "connected" } : {}), last_error: null, updated_at: new Date().toISOString(),
    }).eq("id", connectionId);
    await registerRefreshTarget();
    revalidatePath("/", "layout");
    return back(`zalo=ok&id=${connectionId}`);
  } catch (e) {
    console.error("zalo oauth callback failed", e instanceof Error ? e.message : e);
    return back(`zalo=failed&id=${connectionId}`);
  }
}
