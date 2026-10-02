import "server-only";
import { getLocale } from "@/i18n/server";
import { engineSecret, isOnline, lastEngineHeartbeat, queueDb } from "./engine-queue";
import { blockedBy, exceededMessage, QuotaExceededError, usageScope, type QuotaStatus, type UsageKind, type UsageModule } from "./usage";

/**
 * OpenClaw is the ONLY text-generating AI in NIVO. This is the one door for every text the app writes outside customer chat (setup chat, owner chat,
 * Office replies, lead classification, automation drafts...): it records an `ai_generations` row, enqueues the engine job `openclaw.generate`, and polls the
 * row until the engine's signed callback fills it in. Customer chat has its own job (chat.turn). Embeddings stay on the embedding API.
 *
 * It never calls a model itself. When OpenClaw cannot answer in time the result says why (`reason`) and the interactive caller shows the plain Vietnamese
 * "NIVO đang bận, thử lại sau ít phút"; background callers decide for themselves (retry, skip, hand to a person).
 */

export type GenMessage = { readonly role: "system" | "user" | "assistant"; readonly content: string };

export type GenerateOptions = {
  readonly workspaceId: string;
  /** What this text is for (setup_chat, owner_chat, relay, classify_lead, automation_draft...). Evidence and the usage page group by it. */
  readonly purpose: string;
  readonly messages: ReadonlyArray<GenMessage>;
  /** "json": the engine asks OpenClaw for ONLY a JSON object; the caller still parses it. */
  readonly responseFormat?: "text" | "json";
  /** How long the caller waits, ms (default 45 s). Past it the job is cancelled and the result is dropped. */
  readonly timeoutMs?: number;
  readonly kind?: UsageKind;
  readonly module?: UsageModule;
};

export type GenerateUsage = { readonly prompt_tokens?: number; readonly completion_tokens?: number; readonly cached_tokens?: number; readonly cost?: number; readonly model?: string };

export type GenerateResult =
  | { readonly ok: true; readonly output: string; readonly generationId: string; readonly timings: Record<string, number>; readonly usage: GenerateUsage | null }
  | { readonly ok: false; readonly reason: "quota" | "engine_offline" | "timeout" | "error" | "not_configured"; readonly message: string; readonly quota?: QuotaStatus };

const DEFAULT_TIMEOUT_MS = 45_000;
const POLL_MS = 400;

const locale = async (): Promise<"vi" | "en"> => {
  try {
    return (await getLocale()) === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
};

/** The one sentence an interactive screen shows when OpenClaw cannot answer. */
export const busyMessage = async (): Promise<string> => ((await locale()) === "vi" ? "NIVO đang bận, thử lại sau ít phút." : "NIVO is busy, please try again in a few minutes.");

type Row = { status: string; output: { text?: string } | null; error: string | null; timings: Record<string, number> | null; usage: GenerateUsage | null };

export const generateWithOpenClaw = async (o: GenerateOptions): Promise<GenerateResult> => {
  const scope = usageScope();
  const kind = scope?.kind ?? o.kind ?? "engine";
  const module = scope?.module ?? o.module ?? "other";
  const busy = await busyMessage();
  const fail = (reason: Exclude<GenerateResult, { ok: true }>["reason"], message = busy): GenerateResult => ({ ok: false, reason, message });

  const blocked = await blockedBy(o.workspaceId, kind);
  if (blocked) return { ok: false, reason: "quota", message: exceededMessage(await locale()), quota: blocked };

  const db = queueDb();
  if (!db || !engineSecret()) return fail("not_configured");
  try {
    if (!isOnline(await lastEngineHeartbeat(db))) return fail("engine_offline");
    const timeoutMs = Math.max(5_000, Math.min(o.timeoutMs ?? DEFAULT_TIMEOUT_MS, 120_000));
    const ins = await db.from("ai_generations").insert({
      workspace_id: o.workspaceId, purpose: o.purpose.slice(0, 60), module, usage_kind: kind,
      input: { messages: o.messages, response_format: o.responseFormat ?? "text", timeout_ms: timeoutMs },
    }).select("id").single();
    if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "no row");
    const id = (ins.data as { id: string }).id;
    const enq = await db.rpc("engine_enqueue", { p_workspace: o.workspaceId, p_kind: "openclaw.generate", p_payload: { generation_id: id, purpose: o.purpose }, p_dedupe_key: `openclaw.generate:${id}`, p_max_attempts: 1 });
    if (enq.error) throw new Error(enq.error.message);
    const jobId = enq.data as string;

    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const { data } = await db.from("ai_generations").select("status, output, error, timings, usage").eq("id", id).maybeSingle();
      const row = data as Row | null;
      if (!row) break;
      if (row.status === "done" && typeof row.output?.text === "string") return { ok: true, output: row.output.text, generationId: id, timings: row.timings ?? {}, usage: row.usage };
      if (row.status === "error" || row.status === "cancelled") {
        console.error(`openclaw.generate ${o.purpose} failed: ${row.error ?? row.status}`);
        return fail("error");
      }
    }
    // Too slow: free the job so the engine cannot answer later, and drop whatever it would have produced.
    await db.from("ai_generations").update({ status: "cancelled", error: "timeout", finished_at: new Date().toISOString() }).eq("id", id).in("status", ["queued", "running"]);
    await db.from("engine_jobs").update({ status: "cancelled", error: "timeout", finished_at: new Date().toISOString(), locked_by: null, locked_until: null }).eq("id", jobId).in("status", ["queued", "running"]);
    return fail("timeout");
  } catch (e) {
    console.error(`openclaw.generate ${o.purpose} failed:`, e instanceof Error ? e.message : e);
    return fail("error");
  }
};

/** For callers that just want the text: the output, or a thrown Error carrying the sentence to show (a QuotaExceededError when over the allowance). */
export const generateText = async (o: GenerateOptions): Promise<string> => {
  const r = await generateWithOpenClaw(o);
  if (r.ok) return r.output;
  if (r.reason === "quota" && r.quota) throw new QuotaExceededError(r.message, r.quota);
  throw new Error(r.message);
};
