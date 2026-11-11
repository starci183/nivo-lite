import { Module, type DynamicModule, type InjectionToken, type Provider } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import { latestTemplateVersion, workflowTemplateOf } from "@nivo-lite/blocks-core/modules"
import {
    AgentGraphAiCoreService,
    AgentGraphFlowRunsService,
    AgentGraphRunNoticesService,
    AgentGraphStepMemoryService,
    AgentGraphsService,
    AgentWorkflowRunsService,
    GRAPH_FLOW_TRIGGER_MESSAGES,
    type FlowTriggerMessages,
} from "@modules/domain/agent-graphs"
import {
    AgentRunsService,
    AgentRunsViewService,
    type RunOpen,
    type RunView,
} from "@modules/domain/agent-runs"
import { AgentThreadsModule, RunStopsService, ThreadApprovalsService, ThreadRunsService } from "@modules/domain/agent-threads"
import { WorkEngineService, type WorkSpec } from "@modules/domain/decisions"
import { WorkItemsService, type WorkItem } from "@modules/domain/work-items"
import { AgentTagService, AgentWakeService, AgentWorkHandlersService, type AgentWake } from "@modules/domain/agent-work"
import { EntityEngineService, EntityMutationService, EntityNodePortsService } from "@modules/domain/entity-engine"
import {
    GRAPH_NODES_OPTIONS,
    GRAPH_NODE_AGENT_LOOPS,
    GRAPH_NODE_MODEL,
    GraphNodeEffectsService,
    GraphNodeHostService,
    GraphNodeRegistryService,
    type NodeModelDoor,
} from "@modules/domain/graph-nodes"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { ProviderAbilitiesService } from "@modules/domain/mcp-gateway"
import {
    AGENT_LOOPS,
    CHECKPOINT_LIMITS,
    CHECKPOINT_STORE,
    GRAPH_THREADS,
    LanggraphModule,
    type CheckpointLimits,
    type CheckpointStore,
    type GraphThreads,
} from "@modules/integrations/langgraph"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { LOGGER, type Logger } from "@modules/platform/logging"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { AgentRunRecordsService } from "../../modules/domain/agent-runs/agent-run-records.service"
import { ThreadGraphsService } from "../../modules/domain/agent-threads/thread-graphs.service"
import { memoryCheckpointStore, type MemoryCheckpointStore } from "../fixtures/builders/checkpoint-store.builder"
import { leadMemoryWorldOf } from "../fixtures/builders/lead-memory-world.builder"
import { workflowWorldOf, type WorkflowWorld } from "../fixtures/builders/workflow-world.builder"
import {
    ScriptedModel,
    TickingClock,
    registerOutside,
    rightsProvidersOf,
    type Outside,
    type Rights,
} from "./thread-world-outside"
import { MemoryRecords, WS, WorldError } from "./thread-world-records"

// THE WORLD OF THE PHASE-0 WAVE-C SPECS (package 0-9). One in-memory "database" (`ThreadDb`) outlives any number of "processes"
// (`ThreadProcess`). A process composes the REAL modules of the thread engine (`LanggraphModule`: LanggraphClient over
// CheckpointSaverClient; `AgentThreadsModule`: stops, projection, node function, thread graphs, thread runs) and the real flow, node
// host, effect ledger (GraphNodeEffectsService), rights judge and door checks over that one database, so a spec can kill a process
// mid-step and drive the thread again from a fresh one. Faked: the model (scripted per purpose), the outside world (channel, team
// chat, tag), and the wake and run tables (only what the engine reads of them).

export { WS } from "./thread-world-records"
export { AGENT_FIRST_TRY_MS, AGENT_RETRY_MS } from "./thread-world-outside"
export type { Act, Line, TeamMessage } from "./thread-world-outside"

/** The front-desk agent. */
export const FRONT = "chatbot-agent"
/** The customer's conversation. */
export const CONV = "conv-1"
/** The Zalo account (connection) the conversation came in on. */
export const ZALO = "zalo-1"
/** The customer. */
export const LEAD = "lead-1"
/** The workflow under test. */
export const FRONT_DESK = "chatbot.front-desk"
/** The purpose the front desk's understand step asks the model under. */
export const UNDERSTAND = "chatbot.understand:understand"
/** The purpose of the answer step. */
export const ANSWER = "chatbot.answer:answer"
/** The purpose of the complaint step. */
export const COMPLAINT = "chatbot.complaint:complaint"
/** The purpose of the engine's AI core. */
export const CORE = "engine:step-trouble"

/** One graph version as a spec publishes it. */
export interface PublishedVersion {
    /** The version number. */
    readonly number: number
    /** The graph. */
    readonly flow: GraphSpec
}

/** A wake the thread runs wrote, with the id the table gave it. */
export interface WrittenWake extends AgentWake {
    /** The wake id. */
    readonly id: string
}

/** The database of the world: everything that outlives a process. */
export interface ThreadDb extends Outside {
    /** The records engine. */
    readonly records: MemoryRecords
    /** The checkpoint tables. */
    readonly checkpoints: MemoryCheckpointStore
    /** The wakes the thread runs wrote. */
    readonly wakes: Array<WrittenWake>
    /** The runs, by id. */
    readonly runs: Map<string, RunView>
    /** The graph of each workflow version, by version id; a spec publishes a new version here. */
    readonly versions: Map<string, PublishedVersion>
    /** The workflows behind the real routing. */
    readonly workflows: WorkflowWorld
    /** The scripted model. */
    readonly model: ScriptedModel
    /** The agents whose conversation lock was given back, in order. */
    readonly released: Array<string>
    /** When true, the checkpoint store answers no recorded task writes: the replay records are lost, only the ledger remains. */
    forgetTaskWrites: boolean
    /** The fence of the newest lease. */
    fence: number
    /** How many turns were made. */
    turns: number
    /** When true, run ids are uuid-shaped, as on the app: the ledger then keeps each step call's run and step (P5's `placeOf`). */
    readonly uuidRuns?: boolean
}

/** What a database starts with. */
export interface DbOptions {
    /** The customer of the conversation; null for a conversation of no customer. */
    readonly leadId?: string | null
    /** The account the conversation came in on. */
    readonly connectionId?: string
    /** Run ids shaped as the app's (uuid), so the ledger's run + step read (`recordsOf`) sees the step's calls; absent: `run-<n>`. */
    readonly uuidRuns?: boolean
}

/** The front desk as blocks-core ships it. */
export const frontDeskFlow = (): GraphSpec => {
    const template = workflowTemplateOf(FRONT_DESK)
    if (template === null) throw new WorldError({ code: "WORLD_TEMPLATE_MISSING", params: { id: FRONT_DESK } })
    return latestTemplateVersion(template).graph
}

/** The rights of the shop: one Zalo account and one bank account, the front desk attached to both with the abilities ticked `auto`. */
const rightsOf = (): Rights => ({
    accounts: [
        { id: ZALO, provider: "zalo_oa" },
        { id: "sepay-1", provider: "sepay" },
    ],
    attachments: [
        { agentId: FRONT, connectionId: ZALO, provider: "zalo_oa", abilities: { "customer.send": "auto" } },
        { agentId: FRONT, connectionId: "sepay-1", provider: "sepay", abilities: { "qr.create": "auto" } },
    ],
    defaults: new Map(),
    asks: new Set(),
    toolCalls: [],
})

/** A fresh database: the front desk's workflows seeded from the templates, one customer, one Zalo conversation. */
export const threadDbOf = (options: DbOptions = {}): ThreadDb => {
    const clock = new TickingClock()
    const leadId = options.leadId === undefined ? LEAD : options.leadId
    const workflows = workflowWorldOf({ [FRONT]: "chatbot" })
    const versions = new Map(
        [...workflows.graphs.entries()].map(([id, flow]) => [id, { number: Number(id.split("@").at(-1)), flow }]),
    )
    const conversation = { id: CONV, leadId, channel: "zalo", connectionId: options.connectionId ?? ZALO }
    return {
        clock,
        store: {
            message: [],
            inbox: [],
            conversation: [conversation],
            "sales-lead": leadId === null ? [] : [{ id: leadId }],
        },
        acts: [],
        lines: [],
        team: [],
        throwOn: new Map(),
        rights: rightsOf(),
        records: new MemoryRecords(clock),
        checkpoints: memoryCheckpointStore(),
        wakes: [],
        runs: new Map(),
        versions,
        workflows,
        model: new ScriptedModel(),
        released: [],
        forgetTaskWrites: false,
        fence: 10,
        turns: 0,
        ...(options.uuidRuns === true ? { uuidRuns: true } : {}),
    }
}

/** The front desk's version id the routing gives a new run. */
export const frontDeskVersion = (db: ThreadDb): string => db.workflows.workflowsOf(FRONT).at(0)?.versionId ?? ""

/** The checkpoint store as the saver sees it: the memory store, or with the recorded task writes gone. */
const storeOf = (db: ThreadDb): CheckpointStore => ({
    ...db.checkpoints.port,
    writes: (workspaceId, refs) =>
        db.forgetTaskWrites ? Promise.resolve([]) : db.checkpoints.port.writes(workspaceId, refs),
})

/** The customer messages of the trigger, as the store answers a channel wake. */
const triggerMessagesOf = (db: ThreadDb): FlowTriggerMessages => ({
    messagesOf: (_workspace, _conversation, ids) =>
        Promise.resolve(
            (db.store.inbox ?? [])
                .filter((row) => ids.includes(String(row.id)))
                .map((row) => ({ id: String(row.id), text: String(row.body), at: String(row.at), attachments: [] })),
        ),
    conversationOf: () => {
        const leadId = db.store.conversation?.at(0)?.leadId
        return Promise.resolve({ leadId: typeof leadId === "string" ? leadId : null, channel: "zalo" })
    },
})

/** The graph store: each version's graph by its id (the versions map a spec may publish to). */
const graphsOf = (db: ThreadDb): AgentGraphsService => {
    const flowOf = (versionId: string | undefined): GraphSpec => {
        const found = db.versions.get(versionId ?? "")
        if (found === undefined)
            throw new WorldError({ code: "WORLD_VERSION_MISSING", params: { versionId: versionId ?? "" } })
        return found.flow
    }
    return mock<AgentGraphsService>({
        documentOf: (_ws: string, _agent: string, versionId?: string) =>
            Promise.resolve({ nodes: [], rights: [], flow: flowOf(versionId) }),
        stateOfAgent: () => Promise.resolve(null),
        runGrantOf: (_ws: string, _agent: string, versionId?: string) => {
            const { grant } = flowOf(versionId)
            return Promise.resolve({ rights: grant.rights, tools: grant.tools, effects: null })
        },
        versionAt: (_ws: string, _agent: string, versionId: string) =>
            Promise.resolve().then(() => ({
                version: db.versions.get(versionId)?.number ?? 0,
                document: { nodes: [], rights: [], flow: flowOf(versionId) },
            })),
    })
}

/** Opens the run of a wake (once per wake) and its row in the records, where the projection marks it. */
export const openedRun = (db: ThreadDb, input: RunOpen): RunView => {
    const known = [...db.runs.values()].find((run) => run.wakeId === input.wakeId)
    if (known !== undefined) return known
    const id = db.uuidRuns === true ? `00000000-0000-4000-8000-${String(db.runs.size + 1).padStart(12, "0")}` : `run-${db.runs.size + 1}`
    const view: RunView = {
        id,
        workspaceId: WS,
        agentId: input.agentId,
        wakeId: input.wakeId,
        trigger: "graph_flow",
        versionId: input.versionId,
        status: "running",
        context: structuredClone(input.context),
        errorCode: null,
        spoken: false,
    }
    db.runs.set(id, view)
    db.records.put("agent.run", id, runRowOf(db, input))
    return view
}

/**
 * The run row as the run store inserts it (`AgentRunStoreService.insertRun`), every field the REAL reader requires (FX1, D-P10-6): the
 * world reads the run and its step rows through the real `AgentRunsViewService`, never a fake that skips the mapper. Like the real
 * insert it names no engine: the thread runs mark the row `langgraph` when they take the run (`ThreadRunsService.opened`).
 */
export const runRowOf = (db: { readonly clock: { now(): Date } }, input: RunOpen): RecordRow["data"] => ({
    agentId: input.agentId,
    wakeId: input.wakeId,
    trigger: "graph_flow",
    graphVersionId: input.versionId,
    planning: false,
    status: "running",
    context: structuredClone(input.context),
    error: null,
    resumeAttempts: 0,
    stepSeq: 0,
    startedAt: db.clock.now().toISOString(),
})

/** The REAL run reader (records + mapper) over the world's records: what the thread runs, the stop door and the run page read. */
export const runsViewOf = (records: MemoryRecords): AgentRunsViewService =>
    new AgentRunsViewService(records.engine, new AgentRunRecordsService(records.engine, records.mutations))

/** The run table, as far as the engine reads it. */
const runsOf = (db: ThreadDb): AgentRunsService =>
    mock<AgentRunsService>({
        open: (_tx: unknown, input: RunOpen) => Promise.resolve(openedRun(db, input)),
        runOf: (_ws: string, id: string) => Promise.resolve(db.runs.get(id) ?? null),
        runIdOfWake: (_ws: string, wakeId: string) =>
            Promise.resolve([...db.runs.values()].find((run) => run.wakeId === wakeId)?.id ?? null),
    })

/** One owner's item the work engine raised, with the business key it was raised under. */
export interface RaisedItem {
    /** The item. */
    readonly item: WorkItem
    /** Its business key. */
    readonly key: string
}

/** The owner's items each database's engine raised (an approval of an `ask` call), in order; outlives a process like the database. */
const raised = new WeakMap<ThreadDb, Array<RaisedItem>>()

/** The owner's items the engine raised over a database, in order. */
export const itemsOf = (db: ThreadDb): Array<RaisedItem> => {
    const kept = raised.get(db) ?? []
    raised.set(db, kept)
    return kept
}

/** An owner's item as the work engine raises it: waiting for a decision, its fields as the spec seeded them. */
const itemOf = (db: ThreadDb, spec: WorkSpec): WorkItem =>
    mock<WorkItem>({
        id: `item-${itemsOf(db).length + 1}`,
        workspace_id: WS,
        action: spec.action,
        status: "waiting_decision",
        proposal: mock<WorkItem["proposal"]>({ summary: spec.seed?.summary ?? "", fields: { ...spec.seed?.fields } }),
    })

/** The work engine and items, as far as the approvals of `ask` calls use them: raise an item once per key, find it again. */
const itemProvidersOf = (db: ThreadDb): Array<Provider> => [
    {
        provide: WorkEngineService,
        useValue: mock<WorkEngineService>({
            runWork: (_context: unknown, spec: WorkSpec) => {
                const item = itemOf(db, spec)
                itemsOf(db).push({ item, key: spec.dedupeKey })
                return Promise.resolve(item)
            },
        }),
    },
    {
        provide: WorkItemsService,
        useValue: mock<WorkItemsService>({
            findByDedupe: (_ws: string, key: string) =>
                Promise.resolve(itemsOf(db).find((one) => one.key === key)?.item ?? null),
            latestOfKey: (_ws: string, action: string, base: string) =>
                Promise.resolve(
                    itemsOf(db).findLast((one) => one.item.action === action && one.key.startsWith(base))?.item ?? null,
                ),
            findMany: (ids: ReadonlyArray<string>) =>
                Promise.resolve(itemsOf(db).flatMap((one) => (ids.includes(one.item.id) ? [one.item] : []))),
        }),
    },
]

/** The work core, as far as the thread runs use it: the wake table and the conversation lock. */
const workProvidersOf = (db: ThreadDb): Array<Provider> => [
    {
        provide: AgentWakeService,
        useValue: mock<AgentWakeService>({
            write: (_tx: unknown, wake: AgentWake) => {
                if (db.wakes.some((one) => one.agentId === wake.agentId && one.eventKey === wake.eventKey))
                    return Promise.resolve(null)
                const id = `wake-t${db.wakes.length + 1}`
                db.wakes.push({ ...structuredClone(wake), id })
                return Promise.resolve(id)
            },
        }),
    },
    {
        provide: AgentTagService,
        useValue: mock<AgentTagService>({
            release: (_ws: string, _conversation: string, agentId: string) => {
                db.released.push(agentId)
                return Promise.resolve()
            },
        }),
    },
    { provide: AgentWorkHandlersService, useValue: mock<AgentWorkHandlersService>() },
    { provide: AgentRunsService, useValue: runsOf(db) },
    { provide: AgentRunsViewService, useValue: runsViewOf(db.records) },
]

/** What a process is built with. */
export interface ProcessOptions {
    /** The checkpoint limits of this process; absent takes the saver's defaults. */
    readonly limits?: CheckpointLimits
    /** The model door; absent is the scripted model of the database. */
    readonly model?: NodeModelDoor
    /**
     * The nodes whose agent's turns the host's own loop takes (the `AGENT_LOOP=prebuilt:<node ids>` flag): the REAL loop of the
     * LangGraph integration on the REAL tries policy, answering from the scripted model. Absent, every agent runs the SDK's JSON loop.
     */
    readonly agentLoop?: ReadonlyArray<string>
}

/** Everything the engine's modules read from the app, as one global module of the world. */
const worldProvidersOf = (db: ThreadDb, options: ProcessOptions, logger: Logger): Array<Provider> => [
    GraphNodeRegistryService,
    GraphNodeHostService,
    GraphNodeEffectsService,
    AgentGraphFlowRunsService,
    AgentGraphRunNoticesService,
    AgentGraphAiCoreService,
    AgentGraphStepMemoryService,
    ...rightsProvidersOf(db.rights),
    ...workProvidersOf(db),
    ...itemProvidersOf(db),
    { provide: LeadMemoryService, useValue: leadMemoryWorldOf(db.store).service },
    { provide: AgentWorkflowRunsService, useValue: db.workflows.service },
    { provide: AgentGraphsService, useValue: graphsOf(db) },
    { provide: EntityEngineService, useValue: db.records.engine },
    { provide: EntityMutationService, useValue: db.records.mutations },
    { provide: EntityNodePortsService, useValue: mock<EntityNodePortsService>({ ports: () => [] }) },
    {
        provide: GRAPH_NODES_OPTIONS,
        useValue: {
            install: { nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds },
            ...(options.agentLoop === undefined ? {} : { agentLoop: { nodes: options.agentLoop } }),
        },
    },
    ...(options.agentLoop === undefined ? [] : [{ provide: GRAPH_NODE_AGENT_LOOPS, useExisting: AGENT_LOOPS }]),
    { provide: GRAPH_NODE_MODEL, useValue: options.model ?? db.model.door() },
    { provide: GRAPH_FLOW_TRIGGER_MESSAGES, useValue: triggerMessagesOf(db) },
    { provide: CLOCK, useValue: db.clock },
    { provide: LOGGER, useValue: logger },
    { provide: MESSAGE_CATALOG, useValue: { get: (key: string) => key } },
    { provide: PRIMARY_ENTITY_MANAGER, useValue: { transaction: (work: (tx: object) => unknown) => work({}) } },
    { provide: CHECKPOINT_STORE, useValue: storeOf(db) },
    ...(options.limits === undefined ? [] : [{ provide: CHECKPOINT_LIMITS, useValue: options.limits }]),
]

@Module({})
class ThreadWorldModule {}

/** The token of a provider, for the world module's exports. */
const tokenOf = (provider: Provider): InjectionToken => (typeof provider === "function" ? provider : provider.provide)

/** One process of the app over the database: the real modules and services, wired as Nest wires them. */
export interface ThreadProcess {
    /** The database it runs over. */
    readonly db: ThreadDb
    /** The real graph flow: routes wakes, hands thread wakes to the thread runs. */
    readonly flows: AgentGraphFlowRunsService
    /** The real thread runs. */
    readonly threadRuns: ThreadRunsService
    /** The real LangGraph threads port. */
    readonly threads: GraphThreads
    /** The real thread graphs (pinned versions). */
    readonly graphs: ThreadGraphsService
    /** The real stops. */
    readonly stops: RunStopsService
    /** The run table of the world. */
    readonly runs: AgentRunsService
    /** The process's logger. */
    readonly logger: Logger
    /** The real approvals of `ask` calls (package 1-3); absent in a world that builds its process another way. */
    readonly approvals?: ThreadApprovalsService
}

/** Builds one process over the database: the world's providers as a global module, the two real engine modules on top. */
export const processOf = async (db: ThreadDb, options: ProcessOptions = {}): Promise<ThreadProcess> => {
    const logger = mock<Logger>()
    const providers = worldProvidersOf(db, options, logger)
    const world: DynamicModule = {
        module: ThreadWorldModule,
        global: true,
        providers,
        exports: providers.map((one) => tokenOf(one)),
    }
    const moduleRef = await Test.createTestingModule({
        imports: [
            world,
            LanggraphModule.register({ isGlobal: true, compiledMax: 20, stepLimit: 50 }),
            AgentThreadsModule.register({ isGlobal: true }),
        ],
    }).compile()
    registerOutside(db, moduleRef.get(GraphNodeRegistryService), moduleRef.get(ProviderAbilitiesService))
    await moduleRef.init()
    return {
        db,
        flows: moduleRef.get(AgentGraphFlowRunsService),
        threadRuns: moduleRef.get(ThreadRunsService),
        threads: moduleRef.get<GraphThreads>(GRAPH_THREADS),
        graphs: moduleRef.get(ThreadGraphsService, { strict: false }),
        stops: moduleRef.get(RunStopsService),
        runs: moduleRef.get(AgentRunsService),
        logger,
        approvals: moduleRef.get(ThreadApprovalsService),
    }
}
