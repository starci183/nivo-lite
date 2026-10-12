import { NextResponse, type NextRequest } from "next/server";
import { routeInbound } from "@/lib/agent-bindings";
import { loadConnectionSecret, safeEqual } from "@/lib/channels";
import { handleTelegramUpdate, type TgUpdate } from "@/lib/telegram-inbound";
import { withErrorReport } from "@/lib/errors";

/**
 * Per-connection Telegram webhook: /api/telegram/<connectionId>. The connection's own random secret must arrive in
 * `X-Telegram-Bot-Api-Secret-Token` (constant-time compare); the workspace and the bot token come from the connection, so a
 * message can only ever reach the workspace that registered this bot. The message is answered only when the connection is
 * bound (inbound_chat, through lib/agent-bindings) to an active Chatbot, Booking or Loyalty agent of that workspace (the chatbot is the front door); otherwise it is stored and nothing is replied.
 * Always 200 once authenticated (Telegram retries anything else, which would duplicate the customer's message).
 */
async function postHandler(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params;
  const given = request.headers.get("x-telegram-bot-api-secret-token");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectionId);
  // The bound-agent lookup does not depend on the secret check, so it starts with it (one wave instead of two); its result is used only after authentication.
  const agentP = isUuid && given ? routeInbound(connectionId).then((r) => r.front).catch(() => null) : null;
  const conn = isUuid && given ? await loadConnectionSecret(connectionId, "telegram").catch(() => null) : null;
  if (!conn || !given || !safeEqual(given, conn.webhookSecret)) return NextResponse.json({ ok: false }, { status: 401 });
  const update = (await request.json().catch(() => ({}))) as TgUpdate;
  const agent = await agentP;
  await handleTelegramUpdate(update, { workspaceId: conn.workspaceId, botToken: conn.credential, connectionId, agentId: agent?.id ?? null });
  return NextResponse.json({ ok: true });
}

export const POST = withErrorReport("api.telegram.connection", postHandler);
