import "server-only";
import { resolveBotToken } from "./channels";
import type { Db } from "./core";
import { tgCall } from "./telegram-api";
import { deliverZalo } from "./zalo";

/** Telegram sends. The token is always explicit: the workspace's own bot (see resolveBotToken), never a global. */
export const telegramSend = (token: string, chatId: string, text: string) => tgCall(token, "sendMessage", { chat_id: chatId, text });
export const telegramTyping = (token: string, chatId: string) => tgCall(token, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => null);

/**
 * Deliver the company's side of a conversation to the customer's real channel. Website conversations are read in the
 * page itself, so only channels with an external id (Telegram, Zalo) need a push. The reply leaves through the connection the conversation
 * came in on (else the legacy env bot for TELEGRAM_WORKSPACE_ID). Failures are logged, never thrown:
 * the message is already stored and visible in NIVO. Returns true only when Telegram accepted the message.
 */
export const deliverToChannel = async (db: Db, conversationId: string, text: string): Promise<boolean> => {
  const { data } = await db.from("agent_conversations").select("channel, external_id, workspace_id, connection_id").eq("id", conversationId).maybeSingle();
  const conv = data as { channel: string | null; external_id: string | null; workspace_id: string; connection_id: string | null } | null;
  if (conv?.channel === "zalo") return deliverZalo(db, { id: conversationId, workspace_id: conv.workspace_id, connection_id: conv.connection_id, external_id: conv.external_id }, text);
  if (conv?.channel !== "telegram" || !conv.external_id) return false;
  // "/start" archives a conversation as `<chat_id>:<timestamp>`: it is still the same Telegram chat.
  const chatId = conv.external_id.split(":")[0];
  try {
    const token = await resolveBotToken(conv.workspace_id, conv.connection_id);
    if (!token) throw new Error("no Telegram bot connected for this workspace");
    await telegramSend(token, chatId, text);
    return true;
  } catch (e) {
    console.error("telegram delivery failed", e instanceof Error ? e.message : e);
    return false;
  }
};
