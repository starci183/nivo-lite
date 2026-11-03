import { Injectable } from "@nestjs/common"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import { AgentGraphFlowService } from "@modules/domain/agent-graphs"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import { WorkspacesService } from "@modules/domain/workspaces"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { readGraphSpecs } from "./graph-seed.policy"
import { InjectSeedAgents, InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"
import type { SeedAgentRecords } from "./workspace-seed.port"

/** The language the agents and installations seeded here are named in, as the profile seed names them. */
const SEED_LOCALE = "vi"
/** The most workspaces looked through for the named one. */
const WORKSPACE_SCAN_LIMIT = 1000

/** The agent and the installation that run a module's graph. */
interface Seat {
    readonly agentId: string
    readonly installationId: string
}

@Injectable()
/**
 * The seed of the agent graphs: for each graph spec of the stack seed step, the module is installed in the named workspace (its agent
 * under the handle of its module, so `sales`, `accounting` and `chatbot` name the installed agents) and the spec is published as the
 * flow the agent runs, judged against the installed nodes first. A rerun with the same content changes nothing. It prints what it did
 * and never a value.
 */
export class GraphSeedService {
    constructor(
        @InjectWorkspaceSeedOptions() private readonly options: WorkspaceSeedOptions,
        @InjectSeedAgents() private readonly agents: SeedAgentRecords,
        private readonly workspaces: WorkspacesService,
        private readonly modules: ModulesService,
        private readonly installations: InstallationRecordsService,
        private readonly flows: AgentGraphFlowService,
    ) {}

    /** Seeds every graph of the envelope read from `text` into the workspace named `workspaceName`; a refused graph stops the run. */
    async run(text: string, workspaceName: string): Promise<void> {
        const specs = readGraphSpecs(text)
        const installed = this.installedNodes()
        const workspaceId = await this.workspaceOf(workspaceName)
        for (const spec of specs) {
            const seat = await this.seatOf(workspaceId, spec.moduleKey)
            const published = await this.flows.publish({ workspaceId, ...seat, flow: spec, installed })
            this.options.print(`${spec.moduleKey} agent ${seat.agentId} graph ${published}`)
        }
    }

    private installedNodes(): NodeIndex {
        if (this.options.nodes === undefined) {
            throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputRequired })
        }
        return nodeIndexOf(this.options.nodes)
    }

    private async workspaceOf(name: string): Promise<string> {
        const found = (await this.workspaces.list(WORKSPACE_SCAN_LIMIT)).filter((workspace) => workspace.name === name)
        const [only] = found
        if (only === undefined) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
        if (found.length > 1) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
        return only.id
    }

    /** The installation of the module and its agent; made, with the agent under the handle of the module, when the workspace has none. */
    private async seatOf(workspaceId: string, moduleKey: string): Promise<Seat> {
        const held = await this.installations.firstOfModule(workspaceId, moduleKey)
        if (held !== null) return this.seatOfRecord(held.agentId, held.id)
        const module = await this.modules.find(moduleKey)
        const agentId = await this.agents.ensureByHandle({
            workspaceId,
            module: module.key,
            name: module.agent.label[SEED_LOCALE],
            handle: module.agent.handle,
            role: module.agent.role[SEED_LOCALE],
            instructions: module.agent.instructions[SEED_LOCALE],
        })
        // The insert answers null when another run made the installation first; either way the row is read back.
        await this.installations.insert({
            workspaceId,
            moduleKey,
            name: module.name[SEED_LOCALE],
            agentId,
            operatingMode: module.defaultOperatingMode,
        })
        const made = await this.installations.firstOfModule(workspaceId, moduleKey)
        return this.seatOfRecord(made?.agentId ?? null, made?.id ?? null)
    }

    private seatOfRecord(agentId: string | null, installationId: string | null): Seat {
        if (agentId === null || installationId === null) {
            throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
        }
        return { agentId, installationId }
    }
}
