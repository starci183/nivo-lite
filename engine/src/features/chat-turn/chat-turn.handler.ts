import { Inject, Injectable, Logger } from "@nestjs/common";
import { HTTP_OPTIONS, type HttpOptions } from "../../platform/config/http.config";
import { NivoClient, NivoHttpError } from "../../platform/nivo/nivo-client.service";
import { agentIdFor, AgentRegistry, sessionKeyFor } from "../../platform/openclaw/agent-registry.service";
import { GatewayClient } from "../../platform/openclaw/gateway.client";
import { OPENCLAW_OPTIONS, type OpenclawOptions } from "../../platform/openclaw/openclaw.config";
import { PermanentJobError, RetryJobError, type EngineJob, type JobHandler, type JobResult } from "../../platform/queue/queue.types";
import { ToolTokenService } from "../../platform/tools/tool-token.service";
import { AgentSyncService } from "../agent-sync/agent-sync.service";
import { TOOL_MANIFEST } from "../tools/tool-manifest";

/** What the app returns for /api/engine/context: everything one turn needs, already filtered for the customer audience. */
type TurnContext = {
  readonly conversation_id: string;
  readonly module: string;
  readonly handled_by: string | null;
  readonly customer_message: string;
  readonly turns: ReadonlyArray<{ readonly role: string; readonly body: string }>;
  readonly system: string;
  /** The app's view of the agent's OpenClaw copy: false = none yet (or the last sync failed); "slim" mode = only dynamic data is in `system`. */
  /** The installation's "Thời gian chờ tối đa" in ms: past it the app answers directly. */
  readonly timeout_ms?: number;
  readonly synced?: boolean;
  readonly mode?: "slim" | "full";
};

type CallbackResult = { readonly applied: boolean; readonly fallback: boolean; readonly duplicate: boolean };

/**
 * chat.turn: one customer turn through OpenClaw.
 *   1. ask the app for the context (authority, approved knowledge, PUBLIC business knowledge, transcript): the app owns that logic
 *   2. run the turn on this workspace and module agent, session = the NIVO conversation
 *   3. post the PROPOSED reply back to the app, which puts it through the authority gate and delivers it. The engine never sends to a channel.
 * If OpenClaw is not configured, unreachable, refuses or times out, the app is told to answer with the default processor instead, and
 * the job is marked path=direct_fallback. A failed callback is the only thing that retries the job.
 */
@Injectable()
export class ChatTurnHandler implements JobHandler {
  readonly kind = "chat.turn";
  private readonly log = new Logger(ChatTurnHandler.name);

  constructor(
    private readonly nivo: NivoClient,
    private readonly gateway: GatewayClient,
    private readonly agents: AgentRegistry,
    private readonly sync: AgentSyncService,
    private readonly tokens: ToolTokenService,
    @Inject(HTTP_OPTIONS) private readonly http: HttpOptions,
    @Inject(OPENCLAW_OPTIONS) private readonly openclaw: OpenclawOptions,
  ) {}

  async run(job: EngineJob, signal: AbortSignal): Promise<JobResult> {
    if (!job.workspace_id) throw new PermanentJobError("chat.turn needs a workspace");
    let context: TurnContext;
    try {
      context = await this.nivo.call<TurnContext>("/api/engine/context", { job_id: job.id }, signal);
      // The agent has no OpenClaw copy yet (first turn after switching processor, a fresh VPS): build it now, then ask for the slim context.
      if (this.gateway.enabled && this.openclaw.manageAgents && (context.synced === false || !this.agents.has(agentIdFor(job.workspace_id, context.module)))) {
        try {
          await this.sync.sync(job, signal);
          context = await this.nivo.call<TurnContext>("/api/engine/context", { job_id: job.id }, signal);
        } catch (e) {
          if (signal.aborted) throw e;
          this.log.warn(`job ${job.id}: inline agent sync failed (${e instanceof Error ? e.message : String(e)}); the turn runs on the full context`);
        }
      }
    } catch (e) {
      throw this.classify(e);
    }
    // A person took over while the job waited: nothing for the AI to say.
    if (context.handled_by && context.handled_by !== "OpenClaw") return { path: "skipped", reason: "handled_by_person" };

    const agentId = agentIdFor(job.workspace_id, context.module);
    const sessionKey = sessionKeyFor(agentId, context.conversation_id);
    let proposed: string | null = null;
    let reason = "";
    if (!this.gateway.enabled) {
      reason = "openclaw_not_configured";
    } else {
      const token = this.tokens.mint({ jobId: job.id, workspaceId: job.workspace_id, conversationId: context.conversation_id }, Math.ceil(this.openclaw.turnTimeoutMs / 1000) + 60);
      try {
        proposed = await this.gateway.runTurn({ agentId, sessionKey, message: this.compose(context, token), idempotencyKey: `nivo-${job.id}-${job.attempts}`, timeoutMs: Math.min(this.openclaw.turnTimeoutMs, context.timeout_ms ?? this.openclaw.turnTimeoutMs) }, signal);
      } catch (e) {
        if (signal.aborted) throw e;
        reason = e instanceof Error ? e.message : String(e);
        this.log.warn(`job ${job.id}: OpenClaw failed (${reason}); falling back to the direct model`);
      } finally {
        this.tokens.revoke(job.id);
      }
    }

    try {
      const body = proposed !== null ? { job_id: job.id, op: "chat.reply", text: proposed } : { job_id: job.id, op: "chat.fallback", reason: reason.slice(0, 200) };
      const result = await this.nivo.call<CallbackResult>("/api/engine/callback", body, signal);
      return { path: proposed !== null ? "openclaw" : "direct_fallback", ...(proposed === null ? { reason } : {}), agent_id: agentId, context_mode: context.mode ?? "full", ...result };
    } catch (e) {
      throw this.classify(e);
    }
  }

  private classify(e: unknown): Error {
    // 409 = the app no longer sees this job as running (lease lost, cancelled): retrying cannot help, like any other 4xx.
    if (e instanceof NivoHttpError) return e.permanent ? new PermanentJobError(e.message) : new RetryJobError(e.message, 15);
    return e instanceof Error ? e : new Error(String(e));
  }

  /**
   * The text sent into the OpenClaw session. The transcript is included every turn (the session may be new, or was answered by the other
   * processor meanwhile), and the app context is authoritative: it is the PUBLIC, owner-approved view of the business.
   */
  private compose(c: TurnContext, token: string): string {
    const earlier = c.turns.slice(0, -1).map((t) => `${t.role === "user" ? "Customer" : "You"}: ${t.body}`).join("\n");
    const tools = TOOL_MANIFEST.map((t) => `- ${t.name}: ${t.description} args: ${JSON.stringify(t.args)}`).join("\n");
    return [
      "[NIVO CONTEXT: authoritative; follow it exactly]",
      c.system,
      "",
      "[CONVERSATION SO FAR]",
      earlier || "(this is the first message)",
      "",
      "[OPTIONAL TOOLS]",
      `Call a tool with HTTP POST ${this.http.toolsUrl}/tools/<name>, header "Authorization: Bearer ${token}", JSON body = the args object. The token is valid for this turn only.`,
      tools,
      "",
      "[CUSTOMER LATEST MESSAGE]",
      c.customer_message,
    ].join("\n");
  }
}
