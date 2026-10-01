import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { OPENCLAW_OPTIONS, type OpenclawOptions } from "./openclaw.config";

/** One OpenClaw agent per workspace and module: `ws-<first 8 hex of the workspace id>-<module>`. The agent is the tenant boundary on the OpenClaw side. */
export const agentIdFor = (workspaceId: string, module: string): string => `ws-${workspaceId.replace(/-/g, "").slice(0, 8)}-${module.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;

/** The session key inside that agent: the NIVO conversation id, in the agent:<agentId>:<key> form the gateway uses. */
export const sessionKeyFor = (agentId: string, conversationId: string): string => `agent:${agentId}:${conversationId}`;

type AgentEntry = { id: string; name?: string; workspace?: string; tools?: unknown; skills?: unknown; [key: string]: unknown };

/**
 * Keeps the agents the engine syncs registered in OpenClaw's own config. The real schema of OpenClaw 2026.7.1 is `agents.list[]`
 * (`{ id, name, workspace, tools, skills }`, see docs/gateway/config-agents.md); the gateway watches openclaw.json and hot-applies `agents.*`
 * without a restart (gateway.reload.mode "hybrid"), so nothing is restarted. Writes are atomic (temp file + rename), only happen when the
 * entry actually changed, and never touch any other key: whatever OpenClaw or an operator put in the file stays.
 *
 * A customer-facing agent is registered with the `minimal` tool profile (session_status only): it has no shell, no file or web tools, so a customer
 * message can never turn into a command on the VPS. What it may know is in its AGENTS.md and in the per-turn passages.
 */
@Injectable()
export class AgentRegistry {
  private readonly log = new Logger(AgentRegistry.name);

  constructor(@Inject(OPENCLAW_OPTIONS) private readonly options: OpenclawOptions) {}

  /** Where the agent's workspace lives on the shared volume (engine view) and in the gateway's own view. */
  workspaceDirs(agentId: string): { readonly local: string; readonly gateway: string } | null {
    if (!this.options.configDir) return null;
    return { local: join(this.options.configDir, `workspace-${agentId}`), gateway: `${this.options.gatewayStateDir}/workspace-${agentId}` };
  }

  private file(): string | null {
    return this.options.configDir ? join(this.options.configDir, "openclaw.json") : null;
  }

  private read(): Record<string, unknown> {
    const file = this.file();
    if (!file || !existsSync(file)) return {};
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  }

  private entriesOf(config: Record<string, unknown>): Array<AgentEntry> {
    const agents = (typeof config.agents === "object" && config.agents !== null ? config.agents : {}) as { list?: unknown };
    return Array.isArray(agents.list) ? (agents.list as Array<AgentEntry>) : [];
  }

  /** True when the agent is in openclaw.json with the expected workspace. */
  has(agentId: string): boolean {
    try {
      const dirs = this.workspaceDirs(agentId);
      return dirs !== null && this.entriesOf(this.read()).some((e) => e.id === agentId && e.workspace === dirs.gateway);
    } catch {
      return false;
    }
  }

  /** Register (or correct) the agent entry. Returns true when openclaw.json was rewritten (the gateway then reloads it). */
  register(agentId: string, name: string): boolean {
    const file = this.file();
    const dirs = this.workspaceDirs(agentId);
    if (!this.options.manageAgents || !file || !dirs) throw new Error("agent registration is off: set OPENCLAW_MANAGE_AGENTS=1 and OPENCLAW_CONFIG_DIR");
    const config = this.read();
    const agents = (typeof config.agents === "object" && config.agents !== null ? config.agents : {}) as Record<string, unknown>;
    const list = this.entriesOf(config);
    const wanted: AgentEntry = { id: agentId, name, workspace: dirs.gateway, tools: { profile: "minimal" }, skills: [] };
    const at = list.findIndex((e) => e.id === agentId);
    if (at >= 0 && JSON.stringify(list[at]) === JSON.stringify({ ...list[at], ...wanted })) return false;
    const updated = at >= 0 ? list.map((e, i) => (i === at ? { ...e, ...wanted } : e)) : [...list, wanted];
    // Once agents.list exists the FIRST entry (or the one marked default) is the default agent: keep the implicit "main" as it was.
    const next = updated.some((e) => e.default === true) || updated.some((e) => e.id === "main") ? updated : [{ id: "main", default: true }, ...updated];
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ ...config, agents: { ...agents, list: next } }, null, 2), { mode: 0o600 });
    renameSync(tmp, file);
    this.log.log(`registered OpenClaw agent ${agentId}`);
    return true;
  }
}
