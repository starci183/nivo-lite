import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicConfig } from "./config";
import type { ModuleKey } from "./modules-shared";
import { blockedBy } from "./usage";

/**
 * The control plane's side of the NIVO engine (the worker at /engine, running on a VPS).
 * The app decides WHO answers (the module's processor) and puts a job on the durable queue (`engine_jobs`); the engine claims it,
 * works on it for as long as it needs, and talks back only through the signed routes under /api/engine. The engine never writes to a
 * customer channel: every result re-enters through the authority gate and the evidence log like any other input.
 */

/** Who answers a module's customers: NIVO calls the model directly (default), OpenClaw runs on the engine. */
export type Processor = "nivo" | "openclaw";

/** What the app reads from `module_installations.settings ->> 'processor'`. Anything but "openclaw" is the default. */
export const processorFromSettings = (settings: Record<string, unknown> | null | undefined): Processor => (settings?.processor === "openclaw" ? "openclaw" : "nivo");

/** The processor of one module of a workspace (the installation's settings; "nivo" when it has none or cannot be read). */
export const processorOf = async (db: SupabaseClient, workspaceId: string, moduleKey: ModuleKey): Promise<Processor> => {
  const { data } = await db.from("module_installations").select("settings").eq("workspace_id", workspaceId).eq("module_key", moduleKey).maybeSingle();
  return processorFromSettings((data as { settings: Record<string, unknown> | null } | null)?.settings);
};

/** Service-role client for the queue: engine_* functions and engine_workers are not granted to anyone else. Null when not configured. */
export const queueDb = (): SupabaseClient | null => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? createClient(publicConfig.supabaseUrl, key, { auth: { persistSession: false } }) : null;
};

/** The shared secret between the app and the engine (HMAC). Null until configured: the engine is then simply not used. */
export const engineSecret = (): string | null => {
  const secret = process.env.ENGINE_SHARED_SECRET;
  return secret && secret.length >= 32 ? secret : null;
};

/** A worker heartbeat younger than this means the engine is up. */
const ONLINE_MS = 90_000;

/** Last worker heartbeat (ISO) or null when no worker ever reported. */
export const lastEngineHeartbeat = async (db: SupabaseClient): Promise<string | null> => {
  const { data } = await db.from("engine_workers").select("last_heartbeat_at").order("last_heartbeat_at", { ascending: false }).limit(1);
  return ((data ?? [])[0] as { last_heartbeat_at: string } | undefined)?.last_heartbeat_at ?? null;
};

export const isOnline = (heartbeat: string | null): boolean => heartbeat !== null && Date.now() - Date.parse(heartbeat) < ONLINE_MS;

export type ChatTurnJob = { readonly conversationId: string; readonly messageId: string; readonly eventId: string; readonly agentId: string; readonly channel: string };

/**
 * Put one customer turn on the queue. False means "answer it yourself": the engine is not configured, no worker is alive, or the queue
 * rejected the row. The caller then takes the default path, so a customer is never left waiting on a dead engine.
 * Idempotent per stored customer message (`chat.turn:<message id>`).
 */
export const enqueueChatTurn = async (workspaceId: string, job: ChatTurnJob): Promise<boolean> => {
  try {
    const db = queueDb();
    if (!db || !engineSecret()) return false;
    if (!isOnline(await lastEngineHeartbeat(db))) {
      console.warn("engine offline: answering the customer turn with the default processor");
      return false;
    }
    // Over the plan allowance: no engine run. The caller takes the default path, whose customerChat answers with the polite fallback and hands the question to people.
    if (await blockedBy(workspaceId, "chat_reply")) return false;
    const { error } = await db.rpc("engine_enqueue", {
      p_workspace: workspaceId,
      p_kind: "chat.turn",
      p_payload: { conversation_id: job.conversationId, message_id: job.messageId, event_id: job.eventId, agent_id: job.agentId, channel: job.channel },
      p_dedupe_key: `chat.turn:${job.messageId}`,
      p_max_attempts: 2,
    });
    if (error) throw new Error(error.message);
    return true;
  } catch (e) {
    console.error("engine enqueue failed:", e instanceof Error ? e.message : e);
    return false;
  }
};

/**
 * Queue a one-way sync of an installation's OpenClaw agent copy (AGENTS.md, SOUL.md, knowledge/*.md) from Supabase. Collapses into a job
 * that is already waiting; does nothing for an installation that is not on OpenClaw unless `force`. Never throws: a sync that cannot be queued
 * is picked up by the 5-minute schedule anyway.
 */
export const enqueueAgentSync = async (installationId: string, opts: { readonly force?: boolean } = {}): Promise<boolean> => {
  try {
    const db = queueDb();
    if (!db || !engineSecret()) return false;
    const { error } = await db.rpc("engine_enqueue_agent_sync", { p_installation: installationId, p_force: opts.force === true });
    if (error) throw new Error(error.message);
    return true;
  } catch (e) {
    console.error("agent sync enqueue failed:", e instanceof Error ? e.message : e);
    return false;
  }
};

/** The same for every installation of the workspace that is on OpenClaw (business knowledge changed: it is shared by the modules). */
export const enqueueWorkspaceSync = async (workspaceId: string): Promise<void> => {
  try {
    const db = queueDb();
    if (!db || !engineSecret()) return;
    const { error } = await db.rpc("engine_enqueue_workspace_sync", { p_workspace: workspaceId });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("workspace sync enqueue failed:", e instanceof Error ? e.message : e);
  }
};

/* ------------------------------------------------------------------ signed calls from the engine */

const SKEW_MS = 5 * 60_000;

/** hex HMAC-SHA256 over `<timestamp>.<raw body>`: what the engine sends in x-engine-signature (see engine/src/platform/nivo/signing.ts). */
export const signEngineBody = (secret: string, timestamp: string, rawBody: string): string => createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

/** True only for a request signed with the shared secret, within five minutes. Constant-time comparison. */
export const verifyEngineRequest = (headers: Headers, rawBody: string): boolean => {
  const secret = engineSecret();
  const timestamp = headers.get("x-engine-timestamp");
  const signature = headers.get("x-engine-signature");
  if (!secret || !timestamp || !signature) return false;
  const at = Number(timestamp);
  if (!Number.isFinite(at) || Math.abs(Date.now() - at) > SKEW_MS) return false;
  const expected = Buffer.from(signEngineBody(secret, timestamp, rawBody), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
};

export type EngineJob = { readonly id: string; readonly workspace_id: string; readonly kind: string; readonly payload: Record<string, unknown>; readonly status: string };

/**
 * The job a signed engine call speaks for. The workspace is NEVER taken from the request: it is the job row's, and the job must be
 * running (leased by a worker). A caller-supplied workspace id is not authorization.
 */
export const loadRunningJob = async (db: SupabaseClient, jobId: unknown, kind: string | ReadonlyArray<string>): Promise<EngineJob | null> => {
  if (typeof jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const { data } = await db.from("engine_jobs").select("id, workspace_id, kind, payload, status").eq("id", jobId).in("kind", typeof kind === "string" ? [kind] : [...kind]).eq("status", "running").maybeSingle();
  const job = data as EngineJob | null;
  return job?.workspace_id ? job : null;
};
