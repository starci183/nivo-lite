import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { publicConfig } from "./config";
import { ingest } from "./core";
import { customerTurn, type CustomerChannel } from "./customer-turn";
import type { Agent, AgentConversation } from "./types";
import { getAccessToken } from "./zalo";
import { userDisplayName, type ZaloEvent } from "./zalo-api";

/**
 * Inbound Zalo OA event -> a customer turn of the workspace's Chatbot AI (the same path as Telegram and the website chat): the AI
 * replies through the same authority gate. Called by /api/connections/zalo/<connectionId> after the signature was verified.
 * Idempotency: Zalo may deliver an event twice, so each `message.msg_id` is claimed once in `channel_receipts`; the channel event id
 * `zalo:<msg_id>` is also the inbound dedupe key. The conversation belongs to the connection it came in on (`connection_id`), keyed by
 * the Zalo user id. With a connection but no bound agent the message is only stored in the inbox and nothing is answered.
 */
export type ZaloRoute = { workspaceId: string; connectionId: string; agentId: string | null };

const LOCALE = "vi" as const;
const ZALO_CHANNEL = { key: "zalo", label: "Zalo" } as unknown as CustomerChannel;
const FALLBACK_NAME = "Khách Zalo";

const claim = async (db: SupabaseClient, ws: string, receipt: string): Promise<boolean> => {
  const { error } = await db.from("channel_receipts").insert({ workspace_id: ws, channel: "zalo", receipt_id: receipt });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("zalo webhook: could not record the receipt", error.message);
  return true;
};

/** The connection works (pending -> connected) and the wizard's check can say who wrote first. */
const markReceived = async (db: SupabaseClient, connectionId: string, name: string, text: string): Promise<void> => {
  const { data: c } = await db.from("connections").select("status, first_event").eq("id", connectionId).maybeSingle<{ status: string; first_event: unknown }>();
  const at = new Date().toISOString();
  await db.from("connections").update({
    last_event_at: at, updated_at: at,
    ...(c?.status === "pending" || c?.status === "error" ? { status: "connected", last_error: null } : {}),
    ...(c?.first_event ? {} : { first_event: { amount: 0, content: name, at, text: text.slice(0, 160) } }),
  }).eq("id", connectionId);
};

export type ZaloResult = { handled: boolean; reason?: "ignored" | "duplicate" | "no_agent" | "no_text" };

export const handleZaloEvent = async (event: ZaloEvent, { workspaceId: ws, connectionId, agentId }: ZaloRoute): Promise<ZaloResult> => {
  if (event.event_name !== "user_send_text") return { handled: false, reason: "ignored" };
  const userId = event.sender?.id;
  const msgId = event.message?.msg_id;
  const text = event.message?.text?.trim();
  if (!userId || !msgId || !text) return { handled: false, reason: "no_text" };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("zalo webhook: SUPABASE_SERVICE_ROLE_KEY is not set");
    return { handled: false, reason: "ignored" };
  }
  const db = createClient(publicConfig.supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (!(await claim(db, ws, `msg:${connectionId}:${msgId}`))) return { handled: false, reason: "duplicate" };

  const existing = ((await db.from("agent_conversations").select("*").eq("workspace_id", ws).eq("channel", "zalo").eq("connection_id", connectionId).eq("external_id", userId).maybeSingle()).data ?? null) as AgentConversation | null;
  let name = existing?.visitor_name ?? null;
  if (!name) {
    const token = await getAccessToken(connectionId).catch(() => null);
    name = (token ? await userDisplayName(token, userId) : null) ?? FALLBACK_NAME;
  }
  await markReceived(db, connectionId, name, text);

  if (!agentId) {
    await ingest(db, ws, { channel: "zalo", kind: "message", origin: "live", sender_name: name, sender_contact: null, body: text, amount_vnd: null, external_ref: null, event_id: `zalo:${connectionId}:${msgId}` }, (n) => `#${n}`)
      .catch((e) => console.error("zalo webhook: could not store an unrouted message", e instanceof Error ? e.message : e));
    return { handled: false, reason: "no_agent" };
  }

  const agent = (((await db.from("agents").select("*").eq("workspace_id", ws).eq("module", "chatbot").eq("id", agentId).limit(1)).data ?? [])[0] ?? null) as Agent | null;
  if (!agent) return { handled: false, reason: "no_agent" };

  let conv = existing;
  if (!conv) {
    const created = await db.from("agent_conversations").insert({
      workspace_id: ws, agent_id: agent.id, kind: "customer", channel: "zalo", external_id: userId, visitor_name: name, connection_id: connectionId,
    }).select().single();
    if (created.error) throw new Error(created.error.message);
    conv = created.data as AgentConversation;
  }
  await customerTurn({ db, ws, actor: "Zalo", locale: LOCALE }, conv, agent, text, { channel: ZALO_CHANNEL, eventId: `zalo:${msgId}` });
  revalidatePath("/", "layout");
  return { handled: true };
};
