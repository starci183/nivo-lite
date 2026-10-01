import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/channels";
import { handleTelegramUpdate, type TgUpdate } from "@/lib/telegram-inbound";

/**
 * LEGACY Telegram webhook: the single env bot (TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET / TELEGRAM_WORKSPACE_ID) for the
 * original workspace. New workspaces connect their own bot and use /api/telegram/<connectionId>. Same pipeline: see telegram-inbound.
 * Always 200 once authenticated: Telegram retries anything else, which would duplicate the customer's message.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const given = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || !given || !safeEqual(given, secret)) return NextResponse.json({ ok: false }, { status: 401 });
  const update = (await request.json().catch(() => ({}))) as TgUpdate;
  const ws = process.env.TELEGRAM_WORKSPACE_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!ws || !botToken) {
    console.error("telegram webhook: TELEGRAM_WORKSPACE_ID or TELEGRAM_BOT_TOKEN is not set");
    return NextResponse.json({ ok: true });
  }
  await handleTelegramUpdate(update, { workspaceId: ws, botToken });
  return NextResponse.json({ ok: true });
}
