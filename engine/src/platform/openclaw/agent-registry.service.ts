import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { OPENCLAW_OPTIONS, type OpenclawOptions } from "./openclaw.config";

/** One OpenClaw agent per workspace and module: `ws-<first 8 hex of the workspace id>-<module>`. The agent is the tenant boundary on the OpenClaw side. */
export const agentIdFor = (workspaceId: string, module: string): string => `ws-${workspaceId.replace(/-/g, "").slice(0, 8)}-${module.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;

/** The session key inside that agent: the NIVO conversation id, in the agent:<agentId>:<key> form the gateway uses. */
export const sessionKeyFor = (agentId: string, conversationId: string): string => `agent:${agentId}:${conversationId}`;

/**
 * Makes sure the agent exists in OpenClaw. Opt-in (OPENCLAW_MANAGE_AGENTS=1): it edits `agents.entries` of openclaw.json on the volume
 * shared with the gateway, which watches that file and reconciles on change (the way nivo-backend provisions pods). The entry schema
 * is minimal and must be confirmed against the OpenClaw version you deploy; a failure here is logged and never fails the turn.
 */
@Injectable()
export class AgentRegistry {
  private readonly log = new Logger(AgentRegistry.name);
  private readonly known = new Set<string>();

  constructor(@Inject(OPENCLAW_OPTIONS) private readonly options: OpenclawOptions) {}

  ensure(agentId: string): void {
    if (!this.options.manageAgents || !this.options.configDir || this.known.has(agentId)) return;
    try {
      const file = join(this.options.configDir, "openclaw.json");
      const config: Record<string, unknown> = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : {};
      const agents = (typeof config.agents === "object" && config.agents !== null ? config.agents : {}) as Record<string, unknown>;
      const entries = (typeof agents.entries === "object" && agents.entries !== null ? agents.entries : {}) as Record<string, unknown>;
      if (!(agentId in entries)) {
        entries[agentId] = { name: agentId };
        const next = { ...config, agents: { ...agents, entries } };
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(next, null, 2));
        renameSync(tmp, file);
        this.log.log(`registered OpenClaw agent ${agentId}`);
      }
      this.known.add(agentId);
    } catch (e) {
      this.log.warn(`could not register agent ${agentId}: ${(e as Error).message}`);
    }
  }
}
