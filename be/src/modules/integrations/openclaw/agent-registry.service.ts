import { posix } from "node:path"
import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import { agentListOf, agentsOf, hasDefaultAgent, isAgentEntry, isJsonObject } from "./json.mapper"
import type { AgentEntry, OptionalJsonObject, OptionalWorkspaceDirs, WorkspaceDirs } from "./openclaw.contracts"
import { InjectOpenclawFiles, InjectOpenclawOptions } from "./openclaw.decorators"
import { OpenclawLogEvent } from "./openclaw.log-events"
import type { OpenclawOptions } from "./openclaw.options"
import type { OpenclawFiles } from "./openclaw-files.port"

const CONFIG_FILE = "openclaw.json"
const CONFIG_MODE = 0o600
/** The one tool the NIVO bridge plugin adds on top of the minimal profile. */
export const BRIDGE_TOOL = "nivo_call"

@Injectable()
/**
 * Keeps the agents the sync registers in OpenClaw's own config. The schema of OpenClaw 2026.7.1 is `agents.list[]`
 * (`{ id, name, workspace, tools, skills }`); the gateway watches openclaw.json and hot-applies `agents.*` without a restart.
 * Writes are atomic, only happen when the entry changed, and never touch any other key: whatever OpenClaw or an operator put in
 * the file stays. A customer-facing agent is registered with the `minimal` tool profile (session_status only) plus the one tool
 * `nivo_call` of the NIVO bridge plugin: it has no shell, no file and no web tools, so a customer message can never become a command on
 * the host, and every call it makes comes back to the api, which finds the running turn and applies the agent's grants.
 */
export class AgentRegistryService {
    constructor(
        @InjectOpenclawOptions() private readonly options: OpenclawOptions,
        @InjectOpenclawFiles() private readonly files: OpenclawFiles,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Where the agent's workspace lives on the shared volume (this process) and in the gateway's own view; null without a config directory. */
    workspaceDirs(agentId: string): OptionalWorkspaceDirs {
        const configDir = this.options.configDir
        return configDir === undefined ? null : this.dirsIn(configDir, agentId)
    }

    /** True when the agent is in openclaw.json with the expected workspace. */
    has(agentId: string): boolean {
        const configDir = this.options.configDir
        const config = configDir === undefined ? null : this.readConfig(configDir)
        if (configDir === undefined || config === null) return false
        const { gateway } = this.dirsIn(configDir, agentId)
        return agentListOf(config).some(
            (entry) => isAgentEntry(entry) && entry.id === agentId && entry.workspace === gateway,
        )
    }

    /** True when the entry in openclaw.json is exactly what `register` would write. */
    isCurrent(agentId: string, name: string): boolean {
        const configDir = this.options.configDir
        const config = configDir === undefined ? null : this.readConfig(configDir)
        if (configDir === undefined || config === null) return false
        const entry = agentListOf(config).find((candidate) => isAgentEntry(candidate) && candidate.id === agentId)
        return (
            isAgentEntry(entry) &&
            this.sameEntry(entry, this.wanted(agentId, name, this.dirsIn(configDir, agentId).gateway))
        )
    }

    /** Registers (or corrects) the agent entry. Answers true when openclaw.json was rewritten, so the gateway reloads it. */
    register(agentId: string, name: string): boolean {
        const configDir = this.options.configDir
        if (!this.options.manageAgents || configDir === undefined) {
            throw new OpenclawError({ code: OpenclawErrorCode.RegistrationOff })
        }
        const config = this.readConfig(configDir)
        if (config === null) {
            throw new OpenclawError({ code: OpenclawErrorCode.ConfigInvalid, params: { key: CONFIG_FILE } })
        }
        const list = agentListOf(config)
        const wanted = this.wanted(agentId, name, this.dirsIn(configDir, agentId).gateway)
        const at = list.findIndex((entry) => isAgentEntry(entry) && entry.id === agentId)
        const current = list[at]
        if (isAgentEntry(current) && this.sameEntry(current, wanted)) return false
        const updated =
            at < 0
                ? [...list, wanted]
                : list.map((entry, index) => (index === at && isAgentEntry(entry) ? { ...entry, ...wanted } : entry))
        // Once agents.list exists the first entry (or the one marked default) is the default agent: keep the implicit "main" as it was.
        const next = hasDefaultAgent(updated) ? updated : [{ id: "main", default: true }, ...updated]
        this.files.writeText(
            posix.join(configDir, CONFIG_FILE),
            JSON.stringify({ ...config, agents: { ...agentsOf(config), list: next } }, null, 2),
            CONFIG_MODE,
        )
        this.logger.info(OpenclawLogEvent.AgentRegistered, { agentId })
        return true
    }

    /** Whether this deployment manages the agents of openclaw.json. */
    get managesAgents(): boolean {
        return this.options.manageAgents
    }

    /** Takes the agent out of openclaw.json (its workspace files stay). Answers true when the file was rewritten, so the gateway reloads it. */
    unregister(agentId: string): boolean {
        const configDir = this.options.configDir
        if (!this.options.manageAgents || configDir === undefined) return false
        const config = this.readConfig(configDir)
        if (config === null) {
            throw new OpenclawError({ code: OpenclawErrorCode.ConfigInvalid, params: { key: CONFIG_FILE } })
        }
        const list = agentListOf(config)
        const kept = list.filter((entry) => !(isAgentEntry(entry) && entry.id === agentId))
        if (kept.length === list.length) return false
        this.files.writeText(
            posix.join(configDir, CONFIG_FILE),
            JSON.stringify({ ...config, agents: { ...agentsOf(config), list: kept } }, null, 2),
            CONFIG_MODE,
        )
        this.logger.info(OpenclawLogEvent.AgentUnregistered, { agentId })
        return true
    }

    private dirsIn(configDir: string, agentId: string): WorkspaceDirs {
        return {
            local: posix.join(configDir, `workspace-${agentId}`),
            gateway: `${this.options.gatewayStateDir}/workspace-${agentId}`,
        }
    }

    /** The parsed document: empty when there is no file, null when it exists but is not readable JSON. */
    private readConfig(configDir: string): OptionalJsonObject {
        const text = this.files.readText(posix.join(configDir, CONFIG_FILE))
        if (text === null) return {}
        try {
            const value: unknown = JSON.parse(text)
            return isJsonObject(value) ? value : {}
        } catch (cause) {
            this.logger.error(OpenclawLogEvent.ConfigUnreadable, cause)
            return null
        }
    }

    private sameEntry(entry: AgentEntry, wanted: AgentEntry): boolean {
        return JSON.stringify(entry) === JSON.stringify({ ...entry, ...wanted })
    }

    /** The entry this process wants. bootstrapMaxChars: AGENTS.md (rules, context, knowledge, contract) is longer than the 20000 default and would lose its tail, the reply contract. */
    private wanted(agentId: string, name: string, gatewayDir: string): AgentEntry {
        return {
            id: agentId,
            name,
            workspace: gatewayDir,
            tools: { profile: "minimal", alsoAllow: [BRIDGE_TOOL] },
            skills: [],
            bootstrapMaxChars: 40_000,
            bootstrapTotalMaxChars: 60_000,
            thinkingDefault: "off",
        }
    }
}
