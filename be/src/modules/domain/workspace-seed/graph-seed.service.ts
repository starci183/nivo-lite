import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf, type NodeIndex } from "@nivo-lite/agent-sdk/node"
import {
    AgentBindingsService,
    AgentConnectionsError,
    AgentConnectionsErrorCode,
} from "@modules/domain/agent-connections"
import { AgentGraphFlowService, AgentWorkflowsService } from "@modules/domain/agent-graphs"
import { MANAGEMENT_CONNECTION_IDS } from "@modules/domain/channel-provisioning"
import { AgentAccountsService, type AttachmentWish } from "@modules/domain/tools"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { ModulesService, type ModuleDefinition } from "@modules/domain/modules"
import { WorkspaceEnterpriseService, WorkspacesService } from "@modules/domain/workspaces"
import { eachInOrder } from "@modules/platform/primitives"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { CONNECTION_BINDINGS, readGraphSpecs } from "./graph-seed.policy"
import { SeedActivationService } from "./seed-activation.service"
import { InjectSeedAgents, InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"
import type { SeedAgentRecords } from "./workspace-seed.port"

/** The workspace a seed run writes into, its owner and the nodes the graphs may use. */
interface SeedSeat {
    readonly workspaceId: string
    readonly ownerId: string
    readonly installed: NodeIndex
}

/** The language the agents and installations seeded here are named in, as the module catalogue names them. */
const SEED_LOCALE = "vi"
/** The most workspaces looked through for the named one. */
const WORKSPACE_SCAN_LIMIT = 1000

/** The installation that runs a module's graph, with the agent it drives, and whether this run had to make it. */
interface Seat {
    readonly installation: InstallationRecord
    readonly agentId: string
    readonly created: boolean
}

/** The accounts an agent is attached to where it holds none, or null for its module's own proposal. */
export type AttachmentWishes = ReadonlyArray<AttachmentWish> | null

/**
 * One module's graph to seed, with the attachments its agent gets where it holds none: `null` for the module's own proposal (every
 * working account of each provider its template lists), else exactly these accounts (the roster seed picks them by kind).
 */
export interface GraphSeedEntry {
    /** The graph, read as the seed reads a graph file (its module key names the module). */
    readonly spec: GraphSpec
    /** The accounts to attach where the agent holds none; null for the module's proposal. */
    readonly wishes: AttachmentWishes
}

/** What seeding one module did. */
export interface SeededModule {
    /** The module. */
    readonly moduleKey: string
    /** Its agent in the workspace. */
    readonly agentId: string
    /** True when anything was written (an installation, an activation or a graph, an attachment, a workflow). */
    readonly changed: boolean
}

@Injectable()
/**
 * The seed of the agent graphs: for each graph spec of the stack seed step, the module is installed in the named workspace (its agent
 * under the handle of its module, so `sales` and `chatbot` name the installed agents), brought live through the seed activation (the gates are confirmed with the wording of the module
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
        private readonly activation: SeedActivationService,
        private readonly flows: AgentGraphFlowService,
        private readonly bindings: AgentBindingsService,
        private readonly abilities: AgentAccountsService,
        @Optional() private readonly workflows?: AgentWorkflowsService,
        @Optional() private readonly enterprise?: WorkspaceEnterpriseService,
    ) {}

    /**
     * Seeds every graph of the envelope read from `text` into the workspace named `workspaceName`; a refused graph stops the run. The module
     * catalogue is mirrored first, so the module rows the installations name exist even on a database no catalogue step reached yet.
     */
    async run(text: string, workspaceName: string): Promise<void> {
        const specs = readGraphSpecs(text)
        this.installedNodes()
        const workspaceId = await this.workspaceOf(workspaceName)
        await this.seedInto(workspaceId, specs.map((spec) => ({ spec, wishes: null })))
    }

    /**
     * Seeds each graph into its module's agent in a workspace already found (the stack's named workspace, or an enterprise workspace the
     * roster seed installs into), in order; a refused graph stops the run. Answers what each module came to.
     */
    async seedInto(workspaceId: string, entries: ReadonlyArray<GraphSeedEntry>): Promise<ReadonlyArray<SeededModule>> {
        const installed = this.installedNodes()
        const ownerId = await this.ownerOf(workspaceId)
        // An installation names its module by foreign key: on an empty database the catalogue is not mirrored yet.
        await this.modules.sync()
        const seeded: Array<SeededModule> = []
        await eachInOrder(entries, async (entry) => {
            seeded.push(await this.seedGraph({ workspaceId, ownerId, installed }, entry))
        })
        return seeded
    }

    /** Seeds one graph into its module's agent: the rights first, then the activation and the published graph. */
    private async seedGraph(seat: SeedSeat, entry: GraphSeedEntry): Promise<SeededModule> {
        const { workspaceId, ownerId, installed } = seat
        const { spec } = entry
        const module = await this.modules.find(spec.moduleKey)
        await this.requireOpen(workspaceId, module.key)
        const { installation, agentId, created } = await this.seatOf(workspaceId, module)
        const attached = await this.attachProviders(workspaceId, agentId, module.key, entry.wishes)
        if (installation.status === "live" && (await this.flows.holds(workspaceId, agentId, spec))) {
            this.options.print(`${module.key} agent ${agentId} live, graph unchanged`)
            const drafts = await this.seedWorkflows(workspaceId, module.key, agentId)
            return { moduleKey: module.key, agentId, changed: created || attached > 0 || drafts > 0 }
        }
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
        await this.seedWorkflows(workspaceId, module.key, agentId)
        return { moduleKey: module.key, agentId, changed: true }
    }

    /**
     * Makes the published graph the agent's primary workflow (or brings it up to the graph just published) and adds a draft workflow
     * from each other template of the module, so the workflows tab of a seeded shop has its history and its templates. A rerun adds
     * nothing; it prints how many drafts it added and answers it. An app without workflows does nothing.
     */
    private async seedWorkflows(workspaceId: string, moduleKey: string, agentId: string): Promise<number> {
        if (this.workflows === undefined) return 0
        const drafts = await this.workflows.seedAgent(workspaceId, agentId, moduleKey)
        this.options.print(`${moduleKey} agent ${agentId} workflows adopted, ${drafts} drafts added`)
        return drafts
    }

    /**
     * Attaches the agent to the accounts it gets (the wishes, else the working accounts of the providers its module's template lists),
     * where it holds none: an attachment that exists is left exactly as the workspace holds it, so a rerun of the seed or a new version of
     * a module never changes a right. Without them the published graph could not send, draw a QR or write the ledger. Answers how many it
     * made; a wish the workspace cannot store is printed by its reason, never fatal.
     */
    private async attachProviders(workspaceId: string, agentId: string, moduleKey: string, wishes: AttachmentWishes): Promise<number> {
        const made = await this.abilities.attachDefaults({ workspaceId, agentId, moduleKey }, wishes, null)
        if (!made.ok) {
            this.options.print(`${moduleKey} agent ${agentId} attachments refused: ${made.reason}`)
            return 0
        }
        if (made.attached.length > 0)
            this.options.print(`${moduleKey} agent ${agentId} attached to ${made.attached.map((entry) => entry.provider).join(", ")}`)
        return made.attached.length
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

    /**
     * Refuses to seed a module of a private plugin into a workspace that is not one of the enterprise workspaces the plugin names
     * (the workspace's enterprise identifier is set first, by `WorkspaceEnterpriseService.set`): the seed is no way around who may
     * hold a private module. A module of a public plugin costs no read.
     */
    private async requireOpen(workspaceId: string, moduleKey: string): Promise<void> {
        if (INSTALLED.isOpenTo(moduleKey, null)) return
        if ((await this.enterprise?.opens(workspaceId, moduleKey)) === true) return
        throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
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
        if (held !== null) return this.seatOfRecord(held, false)
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
        return this.seatOfRecord(await this.installations.firstOfModule(workspaceId, module.key), true)
    }

    private seatOfRecord(installation: InstallationRecord | null, created: boolean): Seat {
        const agentId = installation?.agentId ?? null
        if (installation === null || agentId === null) {
            throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
        }
        return { installation, agentId, created }
    }
}
