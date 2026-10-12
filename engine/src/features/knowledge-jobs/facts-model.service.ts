import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { GatewayClient } from "../../platform/openclaw/gateway.client";
import { AgentSyncService } from "../agent-sync/agent-sync.service";

export type ModelUsage = { readonly prompt_tokens?: number; readonly completion_tokens?: number; readonly cached_tokens?: number; readonly cost?: number; readonly model?: string | null };
export type ModelAnswer = { readonly text: string; readonly usage: ModelUsage | null };

/**
 * The model that reads facts out of a document: OpenClaw, on the workspace's internal "nivo" agent, in a one-shot session. This is what the web
 * reached through generateText -> openclaw.generate -> GenerateHandler; the worker is inside the engine, so it runs the same turn directly
 * (same agent, same session form, same prompt composition as GenerateHandler.compose with response_format "text", same 40 s budget).
 * The gateway and the agent sync live in the app module, so they are looked up lazily (strict: false). null = no answer (not configured, failed, empty).
 */
@Injectable()
export class FactsModel {
  private readonly log = new Logger(FactsModel.name);

  constructor(private readonly refs: ModuleRef) {}

  private resolve<T>(type: new (...args: never[]) => T): T | null {
    try {
      return this.refs.get(type, { strict: false });
    } catch {
      return null;
    }
  }

  async generate(workspaceId: string, system: string, prompt: string, timeoutMs = 40_000): Promise<ModelAnswer | null> {
    const gateway = this.resolve(GatewayClient);
    const sync = this.resolve(AgentSyncService);
    if (!gateway?.enabled || !sync) return null;
    try {
      const agentId = await sync.ensureInternalAgent(workspaceId);
      const turn = await gateway.runTurn(
        { agentId, sessionKey: `agent:${agentId}:explicit:model-run-${randomUUID()}`, message: compose(system, prompt), idempotencyKey: `facts-${randomUUID()}`, timeoutMs: Math.max(5_000, timeoutMs - 3_000) },
        AbortSignal.timeout(timeoutMs + 15_000),
      );
      const text = turn.text.trim();
      return text ? { text, usage: turn.usage } : null;
    } catch (e) {
      this.log.warn(`fact reading for ${workspaceId} failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
}

/** GenerateHandler.compose for [{system}, {user}] and response_format "text". */
const compose = (system: string, prompt: string): string => [
  "[REQUEST: follow these instructions exactly]",
  system || "(no extra instructions)",
  "",
  "[INPUT]",
  prompt,
  "",
  "[OUTPUT] Answer with ONLY the requested text. No preface, no explanation.",
].join("\n");
