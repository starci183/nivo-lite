import { NextResponse, type NextRequest } from "next/server";
import { boundAgent, loadConnectionSecret, safeEqual } from "@/lib/channels";
import { handleTelegramUpdate, type TgUpdate } from "@/lib/telegram-inbound";

/**
 * Per-connection Telegram webhook: /api/telegram/<connectionId>. The connection's own random secret must arrive in
 * `X-Telegram-Bot-Api-Secret-Token` (constant-time compare); the workspace and the bot token come from the connection, so a
 * message can only ever reach the workspace that registered this bot. The message is answered only when the connection is
 * bound to an active Chatbot agent of that workspace; otherwise it is stored and nothing is replied.
 * Always 200 once authenticated (Telegram retries anything else, which would duplicate the customer's message).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params;
  const given = request.headers.get("x-telegram-bot-api-secret-token");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectionId);
  const conn = isUuid && given ? await loadConnectionSecret(connectionId, "telegram").catch(() => null) : null;
  if (!conn || !given || !safeEqual(given, conn.webhookSecret)) return NextResponse.json({ ok: false }, { status: 401 });
  const update = (await request.json().catch(() => ({}))) as TgUpdate;
  const agent = await boundAgent(connectionId, "chatbot", ["inbound_chat"]).catch(() => null);
  await handleTelegramUpdate(update, { workspaceId: conn.workspaceId, botToken: conn.credential, connectionId, agentId: agent?.id ?? null });
  return NextResponse.json({ ok: true });
}
