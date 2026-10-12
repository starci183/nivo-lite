import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import type { WorkspaceDirs } from "./openclaw.contracts"
import { InjectOpenclawOptions } from "./openclaw.decorators"
import { OpenclawLogEvent } from "./openclaw.log-events"
import type { OpenclawOptions } from "./openclaw.options"

interface AgentEntry {
    readonly id: string
    readonly name?: string
    readonly workspace?: string
    readonly default?: boolean
    readonly [key: string]: unknown
}

/** One OpenClaw agent per workspace and module: `ws-<first 8 hex of the workspace id>-<module>`. The agent is the tenant boundary on the OpenClaw side. */
export const agentIdFor = (workspaceId: string, module: string): string =>
    `ws-${workspaceId.replace(/-/gu, "").slice(0, 8)}-${module.replace(/[^a-z0-9]/giu, "").toLowerCase()}`

/** The session key inside that agent, in the `agent:<agentId>:<key>` form the gateway uses. */
export const sessionKeyFor = (agentId: string, conversationId: string): string => `agent:${agentId}:${conversationId}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

@Injectable()
/**
 * Keeps the agents the sync registers in OpenClaw's own config. The schema of OpenClaw 2026.7.1 is `agents.list[]`
 * (`{ id, name, workspace, tools, skills }`); the gateway watches openclaw.json and hot-applies `agents.*` without a restart.
 * Writes are atomic (temp file and rename), only happen when the entry changed, and never touch any other key: whatever OpenClaw or
 * an operator put in the file stays. A customer-facing agent is registered with the `minimal` tool profile (session_status only):
 * it has no shell, no file and no web tools, so a customer message can never become a command on the host.
 */
export class AgentRegistryService {
    constructor(
        @InjectOpenclawOptions() private readonly options: OpenclawOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Where the agent's workspace lives on the shared volume (this process) and in the gateway's own view; null without a config directory. */
    workspaceDirs(agentId: string): WorkspaceDirs | null {
        if (this.options.configDir === undefined) return null
        return {
            local: join(this.options.configDir, `workspace-${agentId}`),
            gateway: `${this.options.gatewayStateDir}/workspace-${agentId}`,
        }
    }

    /** True when the agent is in openclaw.json with the expected workspace. */
    has(agentId: string): boolean {
        try {
            const dirs = this.workspaceDirs(agentId)
            return (
                dirs !== null &&
                this.entriesOf(this.read()).some((e) => e.id === agentId && e.workspace === dirs.gateway)
            )
        } catch {
            return false
        }
    }

    /** True when the entry in openclaw.json is exactly what `register` would write. */
    isCurrent(agentId: string, name: string): boolean {
        try {
            const dirs = this.workspaceDirs(agentId)
            const entry = dirs === null ? undefined : this.entriesOf(this.read()).find((e) => e.id === agentId)
            if (entry === undefined || dirs === null) return false
            return JSON.stringify(entry) === JSON.stringify({ ...entry, ...this.wanted(agentId, name, dirs.gateway) })
        } catch {
            return false
        }
    }

    /** Registers (or corrects) the agent entry. Answers true when openclaw.json was rewritten, so the gateway reloads it. */
    register(agentId: string, name: string): boolean {
        const file = this.file()
        const dirs = this.workspaceDirs(agentId)
        if (!this.options.manageAgents || file === null || dirs === null) {
            throw new OpenclawError({ code: OpenclawErrorCode.RegistrationOff })
        }
        const config = this.read()
        const agents = isRecord(config.agents) ? config.agents : {}
        const list = this.entriesOf(config)
        const wanted = this.wanted(agentId, name, dirs.gateway)
        const at = list.findIndex((e) => e.id === agentId)
        const current = list[at]
        if (current !== undefined && JSON.stringify(current) === JSON.stringify({ ...current, ...wanted })) return false
        const updated =
            current === undefined ? [...list, wanted] : list.map((e, i) => (i === at ? { ...e, ...wanted } : e))
        // Once agents.list exists the first entry (or the one marked default) is the default agent: keep the implicit "main" as it was.
        const next =
            updated.some((e) => e.default === true) || updated.some((e) => e.id === "main")
                ? updated
                : [{ id: "main", default: true }, ...updated]
        const temp = `${file}.${process.pid}.tmp`
        writeFileSync(temp, JSON.stringify({ ...config, agents: { ...agents, list: next } }, null, 2), { mode: 0o600 })
        renameSync(temp, file)
        this.logger.info(OpenclawLogEvent.AgentRegistered, { agentId })
        return true
    }

    private file(): string | null {
        return this.options.configDir === undefined ? null : join(this.options.configDir, "openclaw.json")
    }

    private read(): Record<string, unknown> {
        const file = this.file()
        if (file === null || !existsSync(file)) return {}
        const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
        return isRecord(parsed) ? parsed : {}
    }

    private entriesOf(config: Record<string, unknown>): Array<AgentEntry> {
        const agents = isRecord(config.agents) ? config.agents : {}
        return Array.isArray(agents.list) ? (agents.list as Array<AgentEntry>) : []
    }

    /** The entry this process wants. bootstrapMaxChars: AGENTS.md (rules, context, knowledge, contract) is longer than the 20000 default and would lose its tail, the reply contract. */
    private wanted(agentId: string, name: string, gatewayDir: string): AgentEntry {
        return {
            id: agentId,
            name,
            workspace: gatewayDir,
            tools: { profile: "minimal" },
            skills: [],
            bootstrapMaxChars: 40_000,
            bootstrapTotalMaxChars: 60_000,
            thinkingDefault: "off",
        }
    }
}
