import "server-only";
import type { Db } from "./core";

/** Telegram Bot API: the one place that talks to Telegram. Token from TELEGRAM_BOT_TOKEN (never logged). */
const api = async (method: string, body: Record<string, unknown>) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const out = (await res.json().catch(() => null)) as { ok?: boolean; description?: string; result?: unknown } | null;
  if (!out?.ok) throw new Error(`telegram ${method}: ${out?.description ?? res.status}`);
  return out.result;
};

export const telegramSend = (chatId: string, text: string) => api("sendMessage", { chat_id: chatId, text });
export const telegramTyping = (chatId: string) => api("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => null);

/**
 * Deliver the company's side of a conversation to the customer's real channel. Website conversations are read in the
 * page itself, so only channels with an external id (Telegram) need a push. Failures are logged, never thrown:
 * the message is already stored and visible in NIVO. Returns true only when Telegram accepted the message.
 */
export const deliverToChannel = async (db: Db, conversationId: string, text: string): Promise<boolean> => {
  const { data } = await db.from("agent_conversations").select("channel, external_id").eq("id", conversationId).maybeSingle();
  const conv = data as { channel: string | null; external_id: string | null } | null;
  if (conv?.channel !== "telegram" || !conv.external_id) return false;
  // "/start" archives a conversation as `<chat_id>:<timestamp>`: it is still the same Telegram chat.
  const chatId = conv.external_id.split(":")[0];
  try {
    await telegramSend(chatId, text);
    return true;
  } catch (e) {
    console.error("telegram delivery failed", e instanceof Error ? e.message : e);
    return false;
  }
};
