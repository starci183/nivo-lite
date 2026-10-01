import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { customerTurn } from "@/lib/customer-turn";
import { telegramSend, telegramTyping } from "@/lib/telegram";
import { publicConfig } from "@/lib/config";
import { translator } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import type { Agent, AgentConversation } from "@/lib/types";

/**
 * Telegram webhook: a real customer channel. Every text a customer sends the bot becomes a customer turn of the workspace's
 * Chatbot AI (same path as the website chat): the AI replies in Telegram, the lead is handed to Sales AI through the gate,
 * and anything outside the owner's authority waits for a decision in Office.
 * Security: Telegram sends the secret we registered in `X-Telegram-Bot-Api-Secret-Token`; anything else is refused.
 * There is no user session here, so the route uses the service-role client scoped to TELEGRAM_WORKSPACE_ID.
 * Idempotency: a retried delivery (same `update_id`) is processed once via `channel_receipts`, and the message's channel
 * event id `tg:<chat_id>:<message_id>` is the inbound dedupe key, so the same message is never a second input.
 */
type TgUpdate = {
  update_id?: number;
  message?: {
    message_id: number; chat: { id: number }; from?: { first_name?: string; last_name?: string; username?: string }; text?: string;
    /** a photo (e.g. a transfer screenshot) arrives without text, with an optional caption */
    caption?: string; photo?: Array<unknown>;
  };
};

/** Claim one Telegram delivery. False when this update_id was already received (a webhook retry). */
const claimUpdate = async (db: SupabaseClient, ws: string, updateId: number | undefined): Promise<boolean> => {
  if (updateId === undefined) return true;
  const { error } = await db.from("channel_receipts").insert({ workspace_id: ws, channel: "telegram", receipt_id: `update:${updateId}` });
  if (!error) return true;
  if (error.code === "23505") return false;
  // Receipts unavailable (e.g. migration not applied yet): do not drop the message; the event-id dedupe still applies.
  console.error("telegram webhook: could not record the update receipt", error.message);
  return true;
};

const FALLBACK_GREETING = "Xin chào! Mình là trợ lý AI của cửa hàng. Bạn cần tư vấn gì ạ?";
const LOCALE = "vi" as const;
const PHOTO = `[${translator(system, LOCALE)("photoSent")}]`;
const SORRY = "Xin lỗi, hiện mình chưa trả lời được. Một thành viên trong nhóm sẽ liên hệ lại bạn sớm nhé.";

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await request.json().catch(() => ({}))) as TgUpdate;
  const msg = update.message;
  // A screenshot is read as what the customer says with it (the bot does not read the image itself).
  const text = msg?.text ?? (msg?.photo?.length ? [PHOTO, msg.caption?.trim()].filter(Boolean).join(" ") : undefined);
  if (!msg || !text) return NextResponse.json({ ok: true });
  const chatId = String(msg.chat.id);

  const ws = process.env.TELEGRAM_WORKSPACE_ID;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ws || !serviceKey) {
    console.error("telegram webhook: TELEGRAM_WORKSPACE_ID or SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json({ ok: true });
  }
  const db = createClient(publicConfig.supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (!(await claimUpdate(db, ws, update.update_id))) return NextResponse.json({ ok: true });

  try {
    const { data: agents } = await db.from("agents").select("*").eq("workspace_id", ws).eq("module", "chatbot").order("created_at").limit(1);
    const agent = (agents?.[0] ?? null) as Agent | null;
    if (!agent) {
      await telegramSend(chatId, SORRY);
      return NextResponse.json({ ok: true });
    }

    const visitor = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || (msg.from?.username ? `@${msg.from.username}` : "Telegram");
    const isStart = text.trim().startsWith("/start");
    if (isStart) {
      // "/start" opens a fresh conversation (a new visit); the previous one stays in history under an archived id.
      await db.from("agent_conversations").update({ external_id: `${chatId}:${Date.now()}` }).eq("workspace_id", ws).eq("channel", "telegram").eq("external_id", chatId);
    }
    let conv = ((await db.from("agent_conversations").select("*").eq("workspace_id", ws).eq("channel", "telegram").eq("external_id", chatId).maybeSingle()).data ?? null) as AgentConversation | null;
    if (!conv) {
      const created = await db.from("agent_conversations").insert({
        workspace_id: ws, agent_id: agent.id, kind: "customer", channel: "telegram", external_id: chatId, visitor_name: visitor,
      }).select().single();
      if (created.error) throw new Error(created.error.message);
      conv = created.data as AgentConversation;
    }

    // "/start" opens the chat: greet like the website widget does, no AI call.
    if (isStart) {
      const greeting = agent.greeting?.trim() || FALLBACK_GREETING;
      await db.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "agent", body: greeting });
      await telegramSend(chatId, greeting);
      return NextResponse.json({ ok: true });
    }

    await telegramTyping(chatId);
    await customerTurn({ db, ws, actor: "Telegram", locale: LOCALE }, conv, agent, text.trim(), { eventId: `tg:${chatId}:${msg.message_id}` });
    revalidatePath("/", "layout");
  } catch (e) {
    console.error("telegram webhook failed", e instanceof Error ? e.message : e);
    await telegramSend(chatId, SORRY).catch(() => null);
  }
  // Always 200: Telegram retries anything else, which would duplicate the customer's message.
  return NextResponse.json({ ok: true });
}
