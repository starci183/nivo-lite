import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { NivoClient, NivoHttpError } from "../../platform/nivo/nivo-client.service";
import { GatewayClient } from "../../platform/openclaw/gateway.client";
import { PermanentJobError, RetryJobError, type EngineJob, type JobHandler, type JobResult } from "../../platform/queue/queue.types";
import { AgentSyncService } from "../agent-sync/agent-sync.service";

/** What /api/engine/generate-input returns: the prompt the app wrote for one piece of text. */
type GenerateInput = {
  readonly workspace_id: string;
  readonly purpose: string;
  readonly messages: ReadonlyArray<{ readonly role: string; readonly content: string }>;
  readonly response_format: "text" | "json";
  readonly timeout_ms: number;
};

/**
 * openclaw.generate { generation_id }: OpenClaw is the only text-generating AI, so every text the app writes outside customer chat (setup chat, owner chat,
 * Office replies, lead classification, automation drafts) is one of these. The app writes the whole prompt; this job runs it once on the workspace's
 * internal "nivo" agent (a one-shot session: no history, nothing carried between requests) and posts the text back through the signed callback.
 * It never retries (the app is polling for a bounded time): any failure is reported as generate.error and the app shows its "NIVO đang bận" line.
 */
@Injectable()
export class GenerateHandler implements JobHandler {
  readonly kind = "openclaw.generate";
  private readonly log = new Logger(GenerateHandler.name);

  constructor(private readonly nivo: NivoClient, private readonly gateway: GatewayClient, private readonly sync: AgentSyncService) {}

  async run(job: EngineJob, signal: AbortSignal): Promise<JobResult> {
    if (!job.workspace_id) throw new PermanentJobError("openclaw.generate needs a workspace");
    const t0 = Date.now();
    const queued = job.created_at ? t0 - Date.parse(job.created_at) : -1;
    let input: GenerateInput;
    try {
      input = await this.nivo.call<GenerateInput>("/api/engine/generate-input", { job_id: job.id }, signal);
    } catch (e) {
      throw this.classify(e);
    }
    const inputMs = Date.now() - t0;

    let text: string | null = null;
    let reason = "";
    let timings: Record<string, number> = {};
    let usage: Awaited<ReturnType<GatewayClient["runTurn"]>>["usage"] = null;
    if (!this.gateway.enabled) {
      reason = "openclaw_not_configured";
    } else {
      try {
        const agentId = await this.sync.ensureInternalAgent(job.workspace_id);
        const ready = Date.now() - t0;
        // The "explicit:model-run-" form is the one OpenClaw retains for only 24 h (session maintenance), so one-shot sessions do not pile up.
        const sessionKey = `agent:${agentId}:explicit:model-run-${randomUUID()}`;
        const turn = await this.gateway.runTurn(
          { agentId, sessionKey, message: this.compose(input), idempotencyKey: `gen-${job.id}`, timeoutMs: Math.max(5_000, input.timeout_ms - 3_000) },
          signal,
        );
        text = turn.text;
        usage = turn.usage;
        timings = { ...turn.timings, ready_ms: ready };
      } catch (e) {
        if (signal.aborted) throw e;
        reason = e instanceof Error ? e.message : String(e);
        this.log.warn(`generation ${input.purpose} (job ${job.id}) failed: ${reason}`);
      }
    }
    timings = { queue_wait_ms: queued, input_ms: inputMs, ...timings, total_ms: Date.now() - t0 };

    try {
      const body = text !== null && text.trim() !== ""
        ? { job_id: job.id, op: "generate.result", text, usage, timings }
        : { job_id: job.id, op: "generate.error", reason: (reason || "empty answer").slice(0, 200), timings };
      await this.nivo.call("/api/engine/callback", body, signal);
      this.log.log(`generation ${input.purpose} job ${job.id}: ${text !== null ? "ok" : "error"} ${JSON.stringify(timings)}`);
      return { path: text !== null ? "openclaw" : "error", purpose: input.purpose, ...(reason ? { reason } : {}), timings, ...(usage ? { usage } : {}) };
    } catch (e) {
      throw this.classify(e);
    }
  }

  private classify(e: unknown): Error {
    // The app is polling for a bounded time and gives up on its own: never retry a generation (409 = it was cancelled).
    if (e instanceof NivoHttpError) return e.permanent ? new PermanentJobError(e.message) : new RetryJobError(e.message, 5);
    return e instanceof Error ? e : new Error(String(e));
  }

  /** The text sent into the one-shot session: the app's own system prompt first, then the conversation, then the output format. */
  private compose(input: GenerateInput): string {
    const system = input.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const dialogue = input.messages.filter((m) => m.role !== "system");
    const last = dialogue.at(-1);
    const earlier = dialogue.slice(0, -1).map((m) => `${m.role === "assistant" ? "NIVO" : "User"}: ${m.content}`).join("\n");
    return [
      "[REQUEST: follow these instructions exactly]",
      system || "(no extra instructions)",
      "",
      ...(earlier ? ["[CONVERSATION SO FAR]", earlier, ""] : []),
      "[INPUT]",
      last ? last.content : "",
      "",
      input.response_format === "json"
        ? "[OUTPUT] Answer with ONLY the JSON object described above. No prose, no code fences."
        : "[OUTPUT] Answer with ONLY the requested text. No preface, no explanation.",
    ].join("\n");
  }
}
