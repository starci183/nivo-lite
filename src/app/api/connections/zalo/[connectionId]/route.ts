import { NextResponse, type NextRequest } from "next/server";
import { boundAgent, loadConnectionSecret } from "@/lib/channels";
import type { ZaloSecret } from "@/lib/zalo";
import { verifyWebhookSignature, type ZaloEvent } from "@/lib/zalo-api";
import { handleZaloEvent } from "@/lib/zalo-inbound";

/**
 * A workspace's own Zalo OA webhook: /api/connections/zalo/<connectionId>. Zalo signs every call with
 * `X-ZEvent-Signature: mac=sha256(app_id + raw body + timestamp + OA secret key)`; the OA secret key is read from this connection's
 * encrypted credential, so an event can only ever reach the workspace that registered this OA. The customer's message is answered only
 * when the connection is bound to an active Chatbot agent. Always 200 once authenticated (Zalo retries anything else; a replayed
 * msg_id is dropped by the receipt claim).
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Zalo (or the owner) opening the URL in a browser: say it is alive, reveal nothing. */
export const GET = () => NextResponse.json({ ok: true });

export async function POST(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params;
  const raw = await request.text();
  const found = UUID.test(connectionId) ? await loadConnectionSecret(connectionId, "zalo_oa").catch(() => null) : null;
  let secret: ZaloSecret | null = null;
  try {
    secret = found ? (JSON.parse(found.credential) as ZaloSecret) : null;
  } catch {
    secret = null;
  }
  if (!found || !secret || !verifyWebhookSignature(request.headers.get("x-zevent-signature"), secret.appId, raw, secret.oaSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const event = JSON.parse(raw) as ZaloEvent;
  if (event.app_id && event.app_id !== secret.appId) return NextResponse.json({ ok: true, ignored: "other_app" });
  try {
    const agent = await boundAgent(connectionId, "chatbot", ["inbound_chat"]).catch(() => null);
    const result = await handleZaloEvent(event, { workspaceId: found.workspaceId, connectionId, agentId: agent?.id ?? null });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("zalo webhook failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: true, error: "internal" });
  }
}
