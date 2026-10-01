import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { translator } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import { publicConfig } from "./config";
import { ingest } from "./core";
import { customerTurn } from "./customer-turn";
import { withUsage } from "./usage";
import { emitEvent } from "./outbound-events";
import { telegramSend, telegramTyping } from "./telegram";
import type { Agent, AgentConversation } from "./types";

/**
 * Inbound Telegram update -> a customer turn of the workspace's Chatbot AI (same path as the website chat): the AI replies in
 * Telegram, the lead is handed to Sales AI through the gate, anything outside the owner's authority waits in Office.
 * Shared by the per-workspace route (/api/telegram/<connectionId>) and the legacy env route (/api/telegram); each verifies its own
 * secret first and passes the workspace and the bot token to answer with. No user session: service-role client scoped to `workspaceId`.
 * Idempotency: a retried delivery (same `update_id`) is processed once via `channel_receipts`, and the channel event id
 * `tg:<chat_id>:<message_id>` is the inbound dedupe key.
 */
export type TgUpdate = {
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

/**
 * `connectionId` + `agentId` come from a per-workspace connection (the agent bound to it); the legacy env route passes neither
 * (first chatbot agent, conversations with no connection). With a connection but no bound agent the message is only stored in
 * the inbox and nothing is answered.
 */
export type TelegramRoute = { workspaceId: string; botToken: string; connectionId?: string; agentId?: string | null };

export const handleTelegramUpdate = async (update: TgUpdate, { workspaceId: ws, botToken, connectionId, agentId }: TelegramRoute): Promise<void> => {
  const msg = update.message;
  // A screenshot is read as what the customer says with it (the bot does not read the image itself).
  const text = msg?.text ?? (msg?.photo?.length ? [PHOTO, msg.caption?.trim()].filter(Boolean).join(" ") : undefined);
  if (!msg || !text) return;
  const chatId = String(msg.chat.id);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("telegram webhook: SUPABASE_SERVICE_ROLE_KEY is not set");
    return;
  }
  const db = createClient(publicConfig.supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (!(await claimUpdate(db, ws, update.update_id))) return;

  /** A conversation belongs to the connection it came in on (the same chat id can talk to two different bots). */
  const inConnection = <Q,>(q: Q): Q => {
    const f = q as unknown as { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q };
    return connectionId ? f.eq("connection_id", connectionId) : f.is("connection_id", null);
  };
  if (connectionId && !agentId) {
    // Nobody is bound to this bot: keep the message visible in Inbox, answer nothing (the Connections page shows "no agent yet").
    const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || (msg.from?.username ? `@${msg.from.username}` : "Telegram");
    await ingest(db, ws, { channel: "telegram", kind: "message", origin: "live", sender_name: name, sender_contact: null, body: text.trim(), amount_vnd: null, external_ref: null, event_id: `tg:${connectionId}:${chatId}:${msg.message_id}` }, (n) => `#${n}`)
      .catch((e) => console.error("telegram webhook: could not store an unrouted message", e instanceof Error ? e.message : e));
    return;
  }

  try {
    const agentQuery = db.from("agents").select("*").eq("workspace_id", ws).eq("module", "chatbot");
    const { data: agents } = await (agentId ? agentQuery.eq("id", agentId) : agentQuery.order("created_at")).limit(1);
    const agent = (agents?.[0] ?? null) as Agent | null;
    if (!agent) {
      await telegramSend(botToken, chatId, SORRY);
      return;
    }

    const visitor = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || (msg.from?.username ? `@${msg.from.username}` : "Telegram");
    const isStart = text.trim().startsWith("/start");
    if (isStart) {
      // "/start" opens a fresh conversation (a new visit); the previous one stays in history under an archived id.
      await inConnection(db.from("agent_conversations").update({ external_id: `${chatId}:${Date.now()}` }).eq("workspace_id", ws).eq("channel", "telegram").eq("external_id", chatId));
    }
    let conv = ((await inConnection(db.from("agent_conversations").select("*").eq("workspace_id", ws).eq("channel", "telegram").eq("external_id", chatId)).maybeSingle()).data ?? null) as AgentConversation | null;
    if (!conv) {
      const created = await db.from("agent_conversations").insert({
        workspace_id: ws, agent_id: agent.id, kind: "customer", channel: "telegram", external_id: chatId, visitor_name: visitor, connection_id: connectionId ?? null,
      }).select().single();
      if (created.error) throw new Error(created.error.message);
      conv = created.data as AgentConversation;
    }

    // "/start" opens the chat: greet like the website widget does, no AI call.
    if (isStart) {
      const greeting = agent.greeting?.trim() || FALLBACK_GREETING;
      await db.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "agent", body: greeting });
      await telegramSend(botToken, chatId, greeting);
      return;
    }

    await telegramTyping(botToken, chatId);
    let turn: Awaited<ReturnType<typeof customerTurn>> | null = null;
    try {
      turn = await withUsage({ workspaceId: ws }, () => customerTurn({ db, ws, actor: "Telegram", locale: LOCALE }, conv, agent, text.trim(), { eventId: `tg:${chatId}:${msg.message_id}` }));
    } finally {
      // The customer's message is stored before the model runs, so automations hear about it even when the reply could not be produced.
      await emitEvent(ws, "message.inbound", { conversation_id: conv.id, lead_id: turn?.capturedLeadId ?? conv.lead_id, channel: "telegram", text: text.trim(), agent_id: agent.id }, `message.inbound:tg:${chatId}:${msg.message_id}`);
    }
    revalidatePath("/", "layout");
  } catch (e) {
    console.error("telegram webhook failed", e instanceof Error ? e.message : e);
    await telegramSend(botToken, chatId, SORRY).catch(() => null);
  }
};
