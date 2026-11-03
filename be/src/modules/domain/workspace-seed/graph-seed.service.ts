import { Injectable } from "@nestjs/common"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import { AgentGraphFlowService } from "@modules/domain/agent-graphs"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { ModulesService, defaultRulesOf } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { WorkspacesService } from "@modules/domain/workspaces"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { readGraphSpecs } from "./graph-seed.policy"
import { ProfileActivationService } from "./profile-activation.service"
import { InjectSeedAgents, InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"
import type { SeedAgentRecords } from "./workspace-seed.port"

/** The language the agents and installations seeded here are named in, as the profile seed names them. */
const SEED_LOCALE = "vi"
/** The most workspaces looked through for the named one. */
const WORKSPACE_SCAN_LIMIT = 1000

/** The installation that runs a module's graph, with the agent it drives. */
interface Seat {
    readonly installation: InstallationRecord
    readonly agentId: string
}

@Injectable()
/**
 * The seed of the agent graphs: for each graph spec of the stack seed step, the module is installed in the named workspace (its agent
 * under the handle of its module, so `sales`, `accounting` and `chatbot` name the installed agents), given the default authority rules
 * of the module, brought live through the same activation the profile seed uses (the gates are confirmed with the wording of the module
 * itself, so no setup chat runs), and the spec is published as the flow the agent runs, judged against the installed nodes first. A
 * rerun with the same content changes nothing. It prints what it did and never a value.
 */
export class GraphSeedService {
    constructor(
        @InjectWorkspaceSeedOptions() private readonly options: WorkspaceSeedOptions,
        @InjectSeedAgents() private readonly agents: SeedAgentRecords,
        private readonly workspaces: WorkspacesService,
        private readonly modules: ModulesService,
        private readonly installations: InstallationRecordsService,
        private readonly rules: AuthorityRulesService,
        private readonly activation: ProfileActivationService,
        private readonly flows: AgentGraphFlowService,
    ) {}

    /** Seeds every graph of the envelope read from `text` into the workspace named `workspaceName`; a refused graph stops the run. */
    async run(text: string, workspaceName: string): Promise<void> {
        const specs = readGraphSpecs(text)
        const installed = this.installedNodes()
        const workspaceId = await this.workspaceOf(workspaceName)
        const ownerId = await this.ownerOf(workspaceId)
        for (const spec of specs) {
            const module = await this.modules.find(spec.moduleKey)
            const { installation, agentId } = await this.seatOf(workspaceId, module)
            await this.rules.seedDefaults(workspaceId, module.key, defaultRulesOf(module))
            const statuses = await this.activation.activate({ workspaceId, ownerId }, [
                {
                    handle: module.agent.handle,
                    installation,
                    answers: module.gates.map((gate) => ({ gate: gate.key, evidence: gate.hint_vi })),
                },
            ])
            const published = await this.flows.publish({
                workspaceId,
                agentId,
                installationId: installation.id,
                flow: spec,
                installed,
            })
            this.options.print(
                `${module.key} agent ${agentId} ${statuses[module.agent.handle] ?? "unknown"}, graph ${published}`,
            )
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

    private async ownerOf(workspaceId: string): Promise<string> {
        const ownerId = await this.workspaces.ownerIdOf(workspaceId)
        if (ownerId === null) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
        return ownerId
    }

    /** The installation of the module and its agent; made, with the agent under the handle of the module, when the workspace has none. */
    private async seatOf(workspaceId: string, module: ModuleDefinition): Promise<Seat> {
        const held = await this.installations.firstOfModule(workspaceId, module.key)
        if (held !== null) return this.seatOfRecord(held)
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
            moduleKey: module.key,
            name: module.name[SEED_LOCALE],
            agentId,
            operatingMode: module.defaultOperatingMode,
        })
        return this.seatOfRecord(await this.installations.firstOfModule(workspaceId, module.key))
    }

    private seatOfRecord(installation: InstallationRecord | null): Seat {
        const agentId = installation?.agentId ?? null
        if (installation === null || agentId === null) {
            throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
        }
        return { installation, agentId }
    }
}
