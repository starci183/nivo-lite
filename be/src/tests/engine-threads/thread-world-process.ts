import { Module, type DynamicModule, type InjectionToken, type Provider } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import {
    AgentGraphAiCoreService,
    AgentGraphFlowRunsService,
    AgentGraphRunNoticesService,
    AgentGraphStepMemoryService,
    AgentGraphsService,
    AgentWorkflowRunsService,
} from "@modules/domain/agent-graphs"
import {
    AgentRunsService,
    AgentRunsViewService,
    type RunOpen,
    type RunView,
} from "@modules/domain/agent-runs"
import {
    AgentThreadsModule,
    RUN_STOP_STORE,
    RunStopsService,
    ThreadApprovalsService,
    ThreadDeadlinesService,
    ThreadResumeRequestsService,
    ThreadRunsService,
} from "@modules/domain/agent-threads"
import { WorkItemsService, type NewWorkItem, type Proposal, type WorkItem } from "@modules/domain/work-items"
import { AgentWakeService, AgentWorkHandlersService, type AgentWake } from "@modules/domain/agent-work"
import { DeliveredWakesService } from "@modules/domain/provider-triggers"
import { CUSTOMER_ROUTE_STORE } from "@modules/domain/customer-routes/customer-route-store.port"
import { EntityEngineService, EntityMutationService, EntityNodePortsService, type ScopedTx } from "@modules/domain/entity-engine"
import {
    GRAPH_NODES_OPTIONS,
    GRAPH_NODE_AGENT_LOOPS,
    GRAPH_NODE_MODEL,
    GRAPH_NODE_TOOL_DOOR,
    GraphNodeEffectsService,
    NODE_EFFECT_STORE,
    GraphNodeHostService,
    GraphNodeRegistryService,
    type NodeEffectExecutor,
    type NodeModelDoor,
    type NodeToolDoor,
} from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { AgentNodeRequestsService } from "@modules/domain/agent-graphs/agent-node-requests.service"
import { AgentGraphRawRowsService } from "@modules/domain/agent-graphs/agent-graph-raw-rows.service"
import { AccountDataReadService, AccountDataTypesService } from "@modules/domain/account-data"
import { AgentAccountsService, NODE_REQUESTS_GATE } from "@modules/domain/tools"
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
import { QUEUE_OUTBOX, type QueueOutbox } from "@modules/platform/queue"
import { LOGGER, type Logger } from "@modules/platform/logging"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { AgentRunStoreService } from "../../modules/domain/agent-runs/agent-run-store.service"
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
import { ChatWorld } from "./thread-world-chat"
import { chatServicesOf, seededCustomer, wakeQueueOf } from "./thread-world-intake"
import { worldRunStopStore } from "./thread-world-tables"
import { AGENT_RUNS, RUN_DEFAULTS, memoryEffectStore, memoryRunStore } from "@tests/fixtures/builders/engine-core-tables.builder"
import {
    DESK_AGENT,
    DESK_ANSWER,
    DESK_COMPLAINT,
    DESK_FRONT,
    DESK_UNDERSTAND,
} from "../fixtures/builders/thread-desk-plugin.builder"

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
/** The route of the default customer on their Zalo entrance (the id every engine row of the world names: holds, stops, freezes, the send's default route). */
export const CONV = "conv-1"
/** The Zalo account (connection) the conversation came in on. */
export const ZALO = "zalo-1"
/** The customer: the sales module's lead the conversation names (a module bridge member of the trigger). */
export const LEAD = "lead-1"
/** The customer's own id on Zalo (the channel's id of the person: Zalo user ids are digits, the send refuses any other as a placeholder). */
export const ZALO_USER = "8800110022"
/**
 * The person: the contact the channel meets for them (the engine's subject). The contacts store makes uuids in order; the world's default
 * customer is the first person it meets (`seededCustomer` checks it), so this id is a constant the specs can name.
 */
export const CONTACT = "00000000-0000-4000-8000-000000000001"

/**
 * Whether this spec installed the WORLD'S DESK beside the core (`jest.mock("@nivo-lite/plugin-registry")` with `DESK_PLUGIN`): the engine
 * worlds do, to keep an agent step that acts itself (`thread-desk-plugin.builder.ts`); a world that does not runs the core's shipped
 * front desk. Read once, at load: the mock is hoisted above every import.
 */
const WORLD_DESK = INSTALLED.templateAgentOf(DESK_AGENT) !== null
/** The module of the front-desk agent's workflows: the world's desk, or the core's Chatbot. */
export const DESK_MODULE: string = WORLD_DESK ? DESK_AGENT : "chatbot"
/** The workflow under test. */
export const FRONT_DESK: string = WORLD_DESK ? DESK_FRONT : "chatbot.front-desk"
/** The purpose the front desk's understand step asks the model under (a template node's agent: `<node id>:agent`). */
export const UNDERSTAND: string = WORLD_DESK ? DESK_UNDERSTAND : "chatbot.understand:agent"
/** The node of the answer step (the one an `AGENT_LOOP=prebuilt:<node>` flag names in the prebuilt-loop cases). */
export const ANSWER_NODE: string = WORLD_DESK ? "wdesk.answer" : "chatbot.answer"
/** The purpose of the answer step. */
export const ANSWER: string = WORLD_DESK ? DESK_ANSWER : "chatbot.answer:agent"
/** The purpose of the complaint step (on the core's desk: its reply to the customer, `complaint-reply`). */
export const COMPLAINT: string = WORLD_DESK ? DESK_COMPLAINT : "chatbot.complaint-reply:agent"
/** The purpose of the core desk's side step that tells the team about a complaint (`complaint-notify`); the world's desk has none. */
export const COMPLAINT_NOTIFY = "chatbot.complaint-notify:agent"
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
    /** The contact of the conversation (its channel identity's); null for a conversation no contact holds. */
    readonly contactId?: string | null
    /** The account the conversation came in on. */
    readonly connectionId?: string
    /** Run ids shaped as the app's (uuid), so the ledger's run + step read (`recordsOf`) sees the step's calls; absent: `run-<n>`. */
    readonly uuidRuns?: boolean
    /** The module whose workflows each agent runs (agent id → module key), seeded from its templates; absent: the front desk's. */
    readonly modules?: Readonly<Record<string, string>>
}

/** The front desk as blocks-core ships it. */
export const frontDeskFlow = (): GraphSpec => {
    const template = INSTALLED.templateOf(FRONT_DESK)
    if (template === null) throw new WorldError({ code: "WORLD_TEMPLATE_MISSING", params: { id: FRONT_DESK } })
    return latestTemplateVersion(template).graph
}

/** The rights of the shop: one Zalo account and one bank account, the front desk attached to both (the kill switch is the attachment). */
const rightsOf = (): Rights => ({
    accounts: [
        { id: ZALO, provider: "zalo_oa" },
        { id: "sepay-1", provider: "sepay" },
    ],
    attachments: [
        { agentId: FRONT, connectionId: ZALO, provider: "zalo_oa" },
        { agentId: FRONT, connectionId: "sepay-1", provider: "sepay" },
    ],
    defaults: new Map(),
    asks: new Set(),
    toolCalls: [],
})

/** A fresh database: the front desk's workflows seeded from the templates, one customer, one Zalo conversation. */
export const threadDbOf = (options: DbOptions = {}): ThreadDb => {
    const clock = new TickingClock()
    const leadId = options.leadId === undefined ? LEAD : options.leadId
    const contactId = options.contactId === undefined ? CONTACT : options.contactId
    const workflows = workflowWorldOf(options.modules ?? { [FRONT]: DESK_MODULE })
    const versions = new Map(
        [...workflows.graphs.entries()].map(([id, flow]) => [id, { number: Number(id.split("@").at(-1)), flow }]),
    )
    const conversation = { id: CONV, leadId, contactId, channel: "zalo", connectionId: options.connectionId ?? ZALO }
    const chat = new ChatWorld()
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
        chat,
        records: new MemoryRecords(clock),
        checkpoints: memoryCheckpointStore(),
        wakes: [],
        runs: new Map(),
        versions,
        workflows,
        model: new ScriptedModel(),
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
            Promise.resolve({ nodes: [], flow: flowOf(versionId) }),
        stateOfAgent: () => Promise.resolve(null),
        // The world pins each thread to the version id it runs; that id is the one its steps are named by.
        workflowVersionIdOf: (_ws: string, _agent: string, versionId: string) => Promise.resolve(versionId),
        runGrantOf: (_ws: string, _agent: string, versionId?: string) => {
            const { grant } = flowOf(versionId)
            return Promise.resolve({ tools: grant.tools, effects: null })
        },
        versionAt: (_ws: string, _agent: string, versionId: string) =>
            Promise.resolve().then(() => ({
                version: db.versions.get(versionId)?.number ?? 0,
                document: { nodes: [], flow: flowOf(versionId) },
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
    db.records.put(AGENT_RUNS, id, runRowOf(db, input))
    return view
}

/** A database that has a clock to read. */
export interface ClockedDb {
    /** The clock the rows are stamped by. */
    readonly clock: ReadClock
}

/** A clock that can be read. */
interface ReadClock {
    /** The current instant. */
    now(): Date
}

/** The proposal a work item is marked done with. */
interface ProposalHolder {
    /** The proposal. */
    readonly proposal: Proposal
}

/**
 * The run row as the run store inserts it (`AgentRunStoreService.insertRun`), every column the table fills (FX1, D-P10-6): the world
 * reads the run and its step rows through the real `AgentRunsViewService`, never a fake that skips the mapper. The world's row is not
 * marked a thread's yet (`legacy`), as the world has always opened it: the thread runs mark it `langgraph` when they take the run
 * (`ThreadRunsService.opened`), one write of the projection the walks' baselines count.
 */
export const runRowOf = (db: ClockedDb, input: RunOpen): RecordRow["data"] => ({
    ...RUN_DEFAULTS,
    engine: "legacy",
    ...(input.subject === undefined || input.subject === null ? {} : { subjectKind: input.subject.kind, subjectId: input.subject.id }),
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
    new AgentRunsViewService(records.engine, new AgentRunRecordsService(memoryRunStore(records)))

/**
 * The subject reads of the run table (`inFlightOf`, `parkedOfSubject`, `waitersOf`): the REAL store's over the world's run rows, whose subject columns
 * (`subject_kind`, `subject_id`) the open wrote, so a wait of a subject is found first and exactly.
 */
export const subjectRunReadsOf = (
    db: ClockedDb & { readonly records: MemoryRecords; readonly workflows: { readonly pins: ReadonlyMap<string, { readonly workflowId: string; readonly workflowVersionId: string; readonly workflowVersion: number }> } },
): Pick<AgentRunsService, "inFlightOf" | "parkedOfSubject" | "waitersOf" | "markWait" | "endParkedOfSubjects" | "runOf"> => {
    const table = memoryRunStore(db.records)
    const store = new AgentRunStoreService(db.clock as never, db.records.engine, new AgentRunRecordsService(table))
    // The run row carries its workflow as the flow pins it (`AgentRunTableStore.pinRun`, written with the pin): the in-flight read filters on it.
    const pinned = async (): Promise<void> => {
        for (const [runId, pin] of db.workflows.pins)
            await table.pinRun(mock<ScopedTx>(), runId, { workflowId: pin.workflowId, workflowVersionId: pin.workflowVersionId, workflowVersion: pin.workflowVersion })
    }
    return {
        // The wait step writes its match keys right before it parks and clears them when it has what came: the real store's write.
        // The run as its ROW stands now (the thread engine patches the row: ended, waiting, cancelled), through the real store.
        runOf: (ws: string, runId: string) => store.runById(ws, runId),
        markWait: (ws: string, runId: string, match: ReadonlyArray<string>) => store.markWait(ws, runId, match),
        inFlightOf: async (ws: string, workflowId: string, subject: { kind: string; id: string }) => {
            await pinned()
            return store.inFlightOf(ws, workflowId, subject)
        },
        parkedOfSubject: (ws: string, agentId: string, subject: { kind: string; id: string }) => store.parkedOfSubject(ws, agentId, subject),
        waitersOf: (ws: string, filter: Parameters<AgentRunsService["waitersOf"]>[1]) => store.waitersOf(ws, filter),
        // The erasure of a subject (R37): the real store ends every run parked on it.
        endParkedOfSubjects: (tx: Parameters<AgentRunsService["endParkedOfSubjects"]>[0], ws: string, subjects: Parameters<AgentRunsService["endParkedOfSubjects"]>[2], code: string) =>
            store.endParkedOfSubjects(tx, ws, subjects, code),
    }
}

/** The run table, as far as the engine reads it. */
const runsOf = (db: ThreadDb): AgentRunsService => {
    return mock<AgentRunsService>({
        ...subjectRunReadsOf(db),
        open: (_tx: unknown, input: RunOpen) => Promise.resolve(openedRun(db, input)),
        runIdOfWake: (_ws: string, wakeId: string) =>
            Promise.resolve([...db.runs.values()].find((run) => run.wakeId === wakeId)?.id ?? null),
    })
}

/** One owner's item the engine raised, with the business key it was raised under. */
export interface RaisedItem {
    /** The item, as it stands now (a verdict or a withdrawal replaces it). */
    item: WorkItem
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

/** An owner's item as the item store inserts it: queued, its fields as the approval raised them. */
const itemOf = (db: ThreadDb, raised: NewWorkItem): WorkItem =>
    mock<WorkItem>({
        id: `item-${itemsOf(db).length + 1}`,
        workspace_id: WS,
        action: raised.action,
        status: "queued",
        proposal: mock<WorkItem["proposal"]>({ summary: raised.proposal.summary, fields: { ...raised.proposal.fields } }),
    })

/** The item of an id with its status (and proposal) replaced, as the store's guarded transitions leave it; null when it is none. */
const moved = (db: ThreadDb, id: string, status: WorkItem["status"], proposal?: Proposal): WorkItem | null => {
    const kept = itemsOf(db).find((one) => one.item.id === id)
    if (kept === undefined) return null
    kept.item = mock<WorkItem>({ ...kept.item, status, proposal: proposal ?? kept.item.proposal })
    return kept.item
}

/** `moved`, for a close the store refuses on an unknown id (the store's own `requireWorkItem`). */
const closed = (db: ThreadDb, id: string, status: WorkItem["status"], proposal?: Proposal): Promise<WorkItem> => {
    const item = moved(db, id, status, proposal)
    return item === null ? Promise.reject(new Error(`no work item ${id}`)) : Promise.resolve(item)
}

/** The work items store, as far as the approvals of `ask` calls use it: raise an item once per key, find it again, take and close it. */
export const itemProvidersOf = (db: ThreadDb): Array<Provider> => [
    {
        provide: WorkItemsService,
        useValue: mock<WorkItemsService>({
            insert: (raised: NewWorkItem) => {
                if (itemsOf(db).some((one) => one.key === raised.dedupeKey)) return Promise.resolve(null)
                const item = itemOf(db, raised)
                itemsOf(db).push({ item, key: raised.dedupeKey })
                return Promise.resolve(item)
            },
            markWaiting: (id: string) => closed(db, id, "waiting_decision"),
            reopen: (_ws: string, id: string) =>
                Promise.resolve(
                    itemsOf(db).find((one) => one.item.id === id)?.item.status === "waiting_decision" ? moved(db, id, "queued") : null,
                ),
            markDone: (id: string, done: ProposalHolder) => closed(db, id, "done", done.proposal),
            markRejected: (id: string, proposal: Proposal) => closed(db, id, "rejected", proposal),
            markFailed: (id: string) => closed(db, id, "failed"),
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
            // What the run queue reads and closes of the wakes the delivery wrote (the customer road's wake table).
            ...wakeQueueOf(db.chat),
            write: (_tx: unknown, wake: AgentWake) => {
                if (db.wakes.some((one) => one.agentId === wake.agentId && one.eventKey === wake.eventKey))
                    return Promise.resolve(null)
                const id = `wake-t${db.wakes.length + 1}`
                db.wakes.push({ ...structuredClone(wake), id })
                return Promise.resolve(id)
            },
        }),
    },
    // The delivery piece's re-offer door over the world's wake table (the run queue, hand-back, holds and the erasure of a subject read it).
    DeliveredWakesService,
    // The routes of the world (a contact's erasure reads them to end the runs parked on them).
    { provide: CUSTOMER_ROUTE_STORE, useValue: db.chat.routes },
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
    /** The node door of this process in place of the world's (a spec that answers reads and writes its own way); absent: the world's. */
    readonly door?: NodeToolDoor
    /** The queue outbox of this process (a spec that keeps the delayed jobs, such as a loop's round timer); absent: none. */
    readonly outbox?: QueueOutbox
    /**
     * The executors of effects a fixture plugin declares (engine test doubles such as `nivo.tool.test.note.write`), registered on the
     * process's node registry beside the outside world's; absent: none.
     */
    readonly executors?: ReadonlyArray<NodeEffectExecutor>
    /** Providers this process adds to the world module (a capability a generic world composes, such as the holds of a subject); absent: none. */
    readonly extra?: ReadonlyArray<Provider>
}

/** The engine's raw message rows of the world: the reader of a channel wake's words, over the account store double. */
export const rawRowsProvidersOf = (db: ThreadDb): Array<Provider> => {
    const services = chatServicesOf(db)
    return [
        { provide: AccountDataReadService, useValue: services.raw },
        { provide: AccountDataTypesService, useValue: services.types },
        AgentGraphRawRowsService,
    ]
}

/** The default customer of the world is met once, before any process: their contact, and their route under the id the engine rows name. */
export const seededDb = (db: ThreadDb): Promise<string> => {
    const row = (db.store.conversation ?? []).find((one) => one.id === CONV)
    const connectionId = typeof row?.connectionId === "string" ? row.connectionId : ZALO
    return seededCustomer(db, { connectionId, userId: ZALO_USER, name: "Lan", channel: "zalo", routeId: CONV }, CONTACT)
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
    ...rightsProvidersOf(db.rights, db.store, db.chat),
    // What a channel wake reads of the engine's own raw message rows (the words, the time and the burst's lines of the customer).
    ...rawRowsProvidersOf(db),
    // The REAL money floor's reader of the step's pinned node (`agent-graphs.module.ts`: `NODE_REQUESTS_GATE`), always: the door's
    // money floor reads the mode the pinned node declares and never judges a world's money call "as before" for want of it.
    { provide: NODE_REQUESTS_GATE, useClass: AgentNodeRequestsService },
    ...workProvidersOf(db),
    ...itemProvidersOf(db),
    { provide: LeadMemoryService, useValue: leadMemoryWorldOf(db.store).service },
    { provide: AgentWorkflowRunsService, useValue: db.workflows.service },
    { provide: AgentGraphsService, useValue: graphsOf(db) },
    { provide: EntityEngineService, useValue: db.records.engine },
    { provide: EntityMutationService, useValue: db.records.mutations },
    // The engine's core tables of the runs and the effect ledger live in the world's database under their table names.
    { provide: AgentRunRecordsService, useValue: new AgentRunRecordsService(memoryRunStore(db.records, () => db.clock.now().toISOString())) },
    { provide: NODE_EFFECT_STORE, useValue: memoryEffectStore(db.records) },
    { provide: EntityNodePortsService, useValue: mock<EntityNodePortsService>({ ports: () => [] }) },
    {
        provide: GRAPH_NODES_OPTIONS,
        useValue: {
            install: INSTALLED.nodeInstall(),
            ...(options.agentLoop === undefined ? {} : { agentLoop: { nodes: options.agentLoop } }),
        },
    },
    ...(options.agentLoop === undefined ? [] : [{ provide: GRAPH_NODE_AGENT_LOOPS, useExisting: AGENT_LOOPS }]),
    { provide: GRAPH_NODE_MODEL, useValue: options.model ?? db.model.door() },
    { provide: CLOCK, useValue: db.clock },
    { provide: LOGGER, useValue: logger },
    { provide: MESSAGE_CATALOG, useValue: { get: (key: string) => key } },
    { provide: PRIMARY_ENTITY_MANAGER, useValue: { transaction: (work: (tx: object) => unknown) => work({}) } },
    { provide: CHECKPOINT_STORE, useValue: storeOf(db) },
    ...(options.limits === undefined ? [] : [{ provide: CHECKPOINT_LIMITS, useValue: options.limits }]),
    ...(options.outbox === undefined ? [] : [{ provide: QUEUE_OUTBOX, useValue: options.outbox }]),
    ...(options.extra ?? []),
    // Last, so it takes the place of the world's door.
    ...(options.door === undefined ? [] : [{ provide: GRAPH_NODE_TOOL_DOOR, useValue: options.door }]),
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
    /** The real resume requests: a decision is admitted from the stores and recorded as the run's resume wake, which the drain runs. */
    readonly requests: ThreadResumeRequestsService
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
    /** The real deadlines of the stops (and the round timers of a loop); absent in a world that builds its process another way. */
    readonly deadlines?: ThreadDeadlinesService
}

/** Builds one process over the database: the world's providers as a global module, the two real engine modules on top. */
export const processOf = async (db: ThreadDb, options: ProcessOptions = {}): Promise<ThreadProcess> => {
    const logger = mock<Logger>()
    await seededDb(db)
    const providers = worldProvidersOf(db, options, logger)
    const world: DynamicModule = {
        module: ThreadWorldModule,
        global: true,
        providers,
        exports: [...new Set(providers.map((one) => tokenOf(one)))],
    }
    const moduleRef = await Test.createTestingModule({
        imports: [
            world,
            LanggraphModule.register({ isGlobal: true, compiledMax: 20, stepLimit: 50 }),
            AgentThreadsModule.register({ isGlobal: true }),
        ],
    })
        // The stops of the runs live in the world's stops table, not on a connection.
        .overrideProvider(RUN_STOP_STORE)
        .useValue(worldRunStopStore(db.records))
        .compile()
    const registry = moduleRef.get(GraphNodeRegistryService)
    registerOutside(db, registry, moduleRef.get(AgentAccountsService), new Set((options.executors ?? []).map((one) => one.effect)), logger)
    for (const executor of options.executors ?? []) registry.addExecutor(executor)
    await moduleRef.init()
    return {
        db,
        flows: moduleRef.get(AgentGraphFlowRunsService),
        threadRuns: moduleRef.get(ThreadRunsService),
        requests: moduleRef.get(ThreadResumeRequestsService),
        threads: moduleRef.get<GraphThreads>(GRAPH_THREADS),
        graphs: moduleRef.get(ThreadGraphsService, { strict: false }),
        stops: moduleRef.get(RunStopsService),
        runs: moduleRef.get(AgentRunsService),
        logger,
        approvals: moduleRef.get(ThreadApprovalsService),
        deadlines: moduleRef.get(ThreadDeadlinesService),
    }
}
