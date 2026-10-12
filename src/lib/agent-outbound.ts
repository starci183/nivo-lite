import "server-only";
import { connectionsFor } from "./agent-bindings";
import { resolveBotToken } from "./channels";
import type { Db } from "./core";
import { deliverToChannel, telegramSend } from "./telegram";

/**
 * An agent speaking first on a channel it is bound to (`outbound_chat`), for a customer who has no conversation to answer in.
 * Platform limits decide whether that is possible at all:
 *  - Telegram: a bot can never start a chat. It may only write to a user who already wrote to THIS bot, so we need a chat id seen on the
 *    bound connection (a conversation of the lead on it, or an earlier message of the lead stored while nobody was bound: its event id
 *    is `tg:<connectionId>:<chatId>:<messageId>`). Without one, nothing is sent.
 *  - Zalo OA: a consultation message is only accepted within the window after the customer's last message (ZALO_FREE_WINDOW_MS in
 *    zalo.ts); deliverZalo enforces it and records the refusal on the message. Needs a conversation of the lead on the bound OA
 *    (there is no Zalo user id without one).
 * Returns the channel that really accepted the message, or null (the caller keeps today's behaviour).
 */
export const startOutboundChat = async (
  db: Db, ws: string, agentId: string, leadId: string, text: string,
): Promise<{ readonly via: "telegram" | "zalo"; readonly connectionId: string } | null> => {
  const conns = await connectionsFor(agentId, "outbound_chat", { acting: true, connectedOnly: true, providers: ["telegram", "zalo_oa"] }).catch(() => []);
  for (const conn of conns) {
    const via = conn.provider === "zalo_oa" ? "zalo" : "telegram";
    const { data } = await db.from("agent_conversations").select("id").eq("workspace_id", ws).eq("lead_id", leadId).eq("kind", "customer").eq("connection_id", conn.id).order("created_at", { ascending: false }).limit(1);
    const convId = (data as Array<{ id: string }> | null)?.[0]?.id;
    if (convId) {
      if (await deliverToChannel(db, convId, text)) return { via, connectionId: conn.id };
      continue;
    }
    if (via !== "telegram") continue;
    const ev = await db.from("inbound_events").select("event_id").eq("workspace_id", ws).eq("lead_id", leadId).like("event_id", `tg:${conn.id}:%`).order("created_at", { ascending: false }).limit(1);
    const chatId = (ev.data as Array<{ event_id: string | null }> | null)?.[0]?.event_id?.split(":")[2];
    if (!chatId || !/^-?\d+$/.test(chatId)) continue;
    try {
      const token = await resolveBotToken(ws, conn.id);
      if (!token) continue;
      await telegramSend(token, chatId, text);
      return { via, connectionId: conn.id };
    } catch (e) {
      console.error("telegram outbound failed", e instanceof Error ? e.message : e);
    }
  }
  return null;
};
