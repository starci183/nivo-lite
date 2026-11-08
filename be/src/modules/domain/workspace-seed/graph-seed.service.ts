import { Injectable } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf, type NodeIndex } from "@nivo-lite/agent-sdk/node"
import {
    AgentBindingsService,
    AgentConnectionsError,
    AgentConnectionsErrorCode,
} from "@modules/domain/agent-connections"
import { AgentGraphFlowService } from "@modules/domain/agent-graphs"
import { MANAGEMENT_CONNECTION_IDS } from "@modules/domain/channel-provisioning"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { ModuleTagGrantsService, ModulesService, defaultRulesOf, type ModuleDefinition } from "@modules/domain/modules"
import { WorkspacesService } from "@modules/domain/workspaces"
import { eachInOrder } from "@modules/platform/primitives"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { CONNECTION_BINDINGS, readGraphSpecs } from "./graph-seed.policy"
import { ProfileActivationService } from "./profile-activation.service"
import { InjectSeedAgents, InjectSeedToolGrants, InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"
import type { SeedAgentRecords, SeedToolGrants } from "./workspace-seed.port"

/** The workspace a seed run writes into, its owner and the nodes the graphs may use. */
interface SeedSeat {
    readonly workspaceId: string
    readonly ownerId: string
    readonly installed: NodeIndex
}

/** The language the agents and installations seeded here are named in, as the profile seed names them. */
const SEED_LOCALE = "vi"
/** The most workspaces looked through for the named one. */
const WORKSPACE_SCAN_LIMIT = 1000

/**
 * The tools of the ledger copy the seed grants `auto` to the agent whose graph declares them (the append-only copy, its void, and the
 * read that says whether a ledger is connected: without it a read with no grant is denied and the copy is never written); no other tool
 * is granted by the seed.
 */
const LEDGER_SEED_TOOLS: ReadonlySet<string> = new Set(["ledger.append", "ledger.void", "ledger.status"])

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
 * rerun with the same content changes nothing and is cheap: a module that is live and already runs the flow costs reads only (its
 * installation and its live graph), so the seed may run on every start. It prints what it did and never a value.
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
        private readonly bindings: AgentBindingsService,
        private readonly tagGrants: ModuleTagGrantsService,
        @InjectSeedToolGrants() private readonly toolGrants: SeedToolGrants,
    ) {}

    /**
     * Seeds every graph of the envelope read from `text` into the workspace named `workspaceName`; a refused graph stops the run. The module
     * catalogue is mirrored first, so the authority actions the default rules name exist even on a database no catalogue step reached yet.
     */
    async run(text: string, workspaceName: string): Promise<void> {
        const specs = readGraphSpecs(text)
        const installed = this.installedNodes()
        const workspaceId = await this.workspaceOf(workspaceName)
        const ownerId = await this.ownerOf(workspaceId)
        // The default rules a graph seeds name authority actions by foreign key: on an empty database the catalogue is not mirrored yet.
        await this.modules.sync()
        await eachInOrder(specs, (spec) => this.seedGraph({ workspaceId, ownerId, installed }, spec))
    }

    /** Seeds one graph into its module's agent: the rights first, then the rules, the activation and the published graph. */
    private async seedGraph(seat: SeedSeat, spec: GraphSpec): Promise<void> {
        const { workspaceId, ownerId, installed } = seat
        const module = await this.modules.find(spec.moduleKey)
        const { installation, agentId } = await this.seatOf(workspaceId, module)
        // Before the fast path: an agent seeded by an earlier run, or before tag rights existed, gets them on any rerun.
        await this.tagGrants.grantFor(workspaceId, module.key, agentId)
        await this.grantTools(workspaceId, agentId, spec)
        if (installation.status === "live" && (await this.flows.holds(workspaceId, agentId, spec))) {
            this.options.print(`${module.key} agent ${agentId} live, graph unchanged`)
            return
        }
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
        const bound = await this.bindConnections(workspaceId, ownerId, module.key, agentId)
        this.options.print(
            `${module.key} agent ${agentId} ${statuses[module.agent.handle] ?? "unknown"}, graph ${published}, ${bound} connections assigned`,
        )
    }

    /**
     * Gives the agent an `auto` gateway grant for the ledger tools its graph declares, when it has none: the ledger copy is written by
     * the graph without a person. Every other tool the graph declares keeps its behaviour, and a grant that exists (a mode the owner set
     * in the console) is never touched, so a rerun of the seed changes nothing.
     */
    private async grantTools(workspaceId: string, agentId: string, spec: GraphSpec): Promise<void> {
        const tools = spec.grant.tools.filter((tool) => LEDGER_SEED_TOOLS.has(tool))
        await this.toolGrants.insertMissing(
            tools.map((tool) => ({ workspaceId, agentId, tool, mode: "auto", limitVnd: null, constraints: [] })),
        )
    }

    /**
     * Assigns the agent to the connections its module is meant to serve, through the same grant the console's "assign agent to connection"
     * uses; a grant is an upsert, so a rerun changes nothing. A connection the workspace does not hold is skipped. Answers how many were assigned.
     */
    private async bindConnections(
        workspaceId: string,
        ownerId: string,
        moduleKey: string,
        agentId: string,
    ): Promise<number> {
        const wanted = CONNECTION_BINDINGS[moduleKey] ?? []
        let assigned = 0
        await eachInOrder(wanted, async (binding) => {
            try {
                await this.bindings.grant(ownerId, {
                    workspaceId,
                    agentId,
                    connectionId: MANAGEMENT_CONNECTION_IDS[binding.connection],
                    purpose: binding.purpose,
                    access: binding.access,
                })
                assigned += 1
            } catch (cause) {
                const missing =
                    cause instanceof AgentConnectionsError && cause.code === AgentConnectionsErrorCode.TargetNotFound
                if (!missing) throw cause
            }
        })
        return assigned
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
