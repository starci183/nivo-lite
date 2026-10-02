import "server-only";
import { createHmac } from "node:crypto";
import { decryptSecret } from "./channels";
import { engineSecret, queueDb } from "./engine-queue";
import { supabaseAdmin } from "./supabase/admin";
import { WEBHOOK_EVENTS, isWebhookEvent, type WebhookEvent } from "./webhook-shared";

/**
 * Business events leaving NIVO. ONE call after each successful write (`emitEvent`) does two things, and is a no-op when neither applies:
 *   1. outgoing webhooks: every connected `webhook` connection of the workspace that subscribed to the event gets a job `n8n.emit` on engine_jobs
 *      (the engine, a worker on the VPS, POSTs it signed). Payload: { event, data, urls: [<that connection's URL>] }, dedupe key per connection and event.
 *   2. automations: the workspace's enabled pipelines that listen for the event are evaluated (src/lib/automation-engine.ts).
 * It never throws: a failed enqueue or pipeline is logged, the business write that triggered it has already succeeded.
 *
 * Signing: the engine signs every n8n.emit with a key derived per workspace (HMAC-SHA256 of ENGINE_SHARED_SECRET and "n8n:<workspace id>"),
 * header x-nivo-signature = hex HMAC-SHA256(key, "<x-nivo-timestamp>.<raw body>"). The same key is shown to the owner as the "signing secret"
 * (workspaceSigningSecret) and used by the "send a test" step, so a receiver verifies engine deliveries and tests the same way.
 */
export { WEBHOOK_EVENTS, isWebhookEvent, type WebhookEvent };
/** Events that only automations listen for. */
export type InternalEvent = "message.inbound";
export type BusinessEvent = WebhookEvent | InternalEvent;

/** The per-workspace signing key the engine uses for n8n.emit (null until ENGINE_SHARED_SECRET is configured). */
export const workspaceSigningSecret = (workspaceId: string): string | null => {
  const secret = engineSecret();
  return secret ? createHmac("sha256", secret).update(`n8n:${workspaceId}`).digest("hex") : null;
};

/** What a webhook connection stores: events in public_meta.events (comma separated), its URL encrypted in connection_secrets. */
export const eventsOf = (meta: Readonly<Record<string, unknown>> | null | undefined): Array<WebhookEvent> =>
  String(meta?.events ?? "").split(",").map((s) => s.trim()).filter(isWebhookEvent);

const enqueueWebhooks = async (ws: string, event: WebhookEvent, data: Readonly<Record<string, unknown>>, dedupe: string): Promise<number> => {
  const db = supabaseAdmin();
  const { data: conns } = await db.from("connections").select("id, public_meta").eq("workspace_id", ws).eq("provider", "webhook").eq("status", "connected");
  const subscribed = ((conns ?? []) as Array<{ id: string; public_meta: Record<string, unknown> | null }>).filter((c) => eventsOf(c.public_meta).includes(event));
  if (subscribed.length === 0) return 0;
  const queue = queueDb();
  if (!queue) return 0;
  let queued = 0;
  for (const c of subscribed) {
    const sec = (await db.from("connection_secrets").select("ciphertext").eq("connection_id", c.id).maybeSingle()).data as { ciphertext: string } | null;
    if (!sec) continue;
    const url = (JSON.parse(decryptSecret(sec.ciphertext)) as { url?: string }).url;
    if (!url) continue;
    const { error } = await queue.rpc("engine_enqueue", {
      p_workspace: ws, p_kind: "n8n.emit", p_payload: { event, data, urls: [url] }, p_dedupe_key: `n8n.emit:${c.id}:${dedupe}`, p_max_attempts: 4,
    });
    if (error) console.error("outbound event enqueue failed:", event, error.message);
    else queued += 1;
  }
  return queued;
};

/**
 * Announce a business event of a workspace. `dedupe` identifies this occurrence (for example `deal.won:<lead id>`): announcing it twice queues
 * nothing twice and runs no automation twice. Safe to call from anywhere on the server; never throws.
 */
export const emitEvent = async (workspaceId: string, event: BusinessEvent, data: Readonly<Record<string, unknown>>, dedupe: string): Promise<void> => {
  try {
    if (isWebhookEvent(event)) await enqueueWebhooks(workspaceId, event, data, dedupe);
  } catch (e) {
    console.error("outbound webhooks failed:", event, e instanceof Error ? e.message : e);
  }
  try {
    const { onLoyaltyEvent } = await import("./module-loyalty-events");
    await onLoyaltyEvent(workspaceId, event, data);
  } catch (e) {
    console.error("loyalty failed:", event, e instanceof Error ? e.message : e);
  }
  try {
    const { onBusinessEvent } = await import("./automation-engine");
    await onBusinessEvent(workspaceId, event, data, dedupe);
  } catch (e) {
    console.error("automations failed:", event, e instanceof Error ? e.message : e);
  }
  try {
    const { onInventoryEvent } = await import("./module-inventory-events");
    await onInventoryEvent(workspaceId, event, data);
  } catch (e) {
    console.error("inventory failed:", event, e instanceof Error ? e.message : e);
  }
};
