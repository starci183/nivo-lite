import { EntityEngineService, EntityNodePortsService } from "@modules/domain/entity-engine"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Provider } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { graphSpecSchema, type GraphSpec } from "@nivo-lite/agent-sdk/graph"
import {
    isRefused,
    type EffectPayload,
    type NodeModelRequest,
    type NodeQuery,
    type SubjectRef,
} from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import {
    AgentGraphFlowRunsService,
    AgentGraphFreezeGateService,
    AgentGraphRunNoticesService,
    AgentGraphsService,
} from "@modules/domain/agent-graphs"
import {
    GRAPH_NODE_MODEL,
    GRAPH_NODE_TOOL_DOOR,
    GRAPH_NODES_OPTIONS,
    GraphNodeEffectsService,
    GraphNodeHostService,
    GraphNodeRegistryService,
    type NodeModelDoor,
    type NodeRow,
    type NodeToolDoor,
    type NodeTurn,
} from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { AgentGraphStepMemoryService } from "../../../modules/domain/agent-graphs/agent-graph-step-memory.service"
import { AgentGraphCallGuardService } from "../../../modules/domain/agent-graphs/agent-graph-call-guard.service"
import { AgentWorkflowRecordsService } from "../../../modules/domain/agent-graphs/agent-workflow-records.service"
import { AgentWorkflowRunsService } from "../../../modules/domain/agent-graphs/agent-workflow-runs.service"
import type { LeadMemoryWorld } from "./lead-memory-world.builder"
import type { WorkflowWorld } from "./workflow-world.builder"
import { stateOf } from "./agent-graph.builder"

// The flow world of the graphs (seeded graphs, an in-memory store behind every data kind, the real flow over it). Phase 3 (package X1):
// the old engine's node step and its drivers are gone; a run is driven on a thread only.

/** A run engine that writes nothing: the flow's start of a run reads it, no step of the world lives in it. */
const quietRuns = (): AgentRunsService => mock<AgentRunsService>()

/** Where the seed keeps its graph files, from this folder. */
const SEEDS_DIR = "../../../../../.starcistacks/dev/seeds/data/graphs"

/** The name of a graph the seed ships. */
export type SeededGraphName = "chatbot" | "sales"

/** The graph a seed file could not give: it holds no nodes and names the cause in its module key, so a spec that runs it fails on it. */
const unreadableSeed = (name: string, cause: unknown): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: `unreadable seed ${name}: ${String(cause)}`,
    trigger: { kind: "tag", sources: [] },
    grant: { tools: [], effects: [] },
    nodes: [],
})

/** The graph of no workflow: what a world passes the services when every step reads its graph by the version id of its workflow. */
export const NO_FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "none",
    trigger: { kind: "tag", sources: [] },
    grant: { tools: [], effects: [] },
    nodes: [],
}

/** The flow F graph as the seed ships it, parsed by the SDK's own schema. */
export const seededGraphOf = (name: SeededGraphName): GraphSpec => {
    try {
        return graphSpecSchema.parse(JSON.parse(readFileSync(join(__dirname, SEEDS_DIR, `${name}.json`), "utf8")))
    } catch (cause) {
        return unreadableSeed(name, cause)
    }
}

/** One effect the fake world ran: its id, payload and the subject it answered. */
export interface FlowRan {
    /** The effect id. */
    readonly effect: string
    /** What it was asked to do. */
    readonly payload: EffectPayload
    /** The subject it answered. */
    readonly subject: SubjectRef
}

/** The fake world the graphs run against: its recorded effects, and the ports that read and write its store. */
export interface FlowWorld {
    /** Every effect the graph ran, in order. */
    readonly ran: Array<FlowRan>
    /** Runs one effect against the store and records it. */
    readonly execute: (effect: string, payload: EffectPayload, turn?: NodeTurn) => Promise<SubjectRef>
    /** Reads rows of a data kind from the store. */
    readonly read: (kind: string, query: NodeQuery) => Promise<ReadonlyArray<NodeRow>>
}

/** The kinds of subject the effects of the fake world answer. */
const SUBJECT_KINDS: Readonly<Record<string, string>> = {
    [TOOL.customerMessageSend]: "message",
}

/** The world the graphs run against: an in-memory store behind every data kind, every effect recorded, scripted model and tools. */
export const flowWorldOf = (store: Record<string, Array<NodeRow>>, failOn: string | null = null): FlowWorld => {
    const ran: Array<FlowRan> = []
    const execute = (effect: string, payload: EffectPayload): Promise<SubjectRef> => {
        if (effect === failOn) return Promise.reject(new Error(`${effect} is down`))
        const kind = SUBJECT_KINDS[effect] ?? effect
        const subject = { kind, id: `${kind}-${ran.length + 1}` }
        ran.push({ effect, payload, subject })
        return Promise.resolve(subject)
    }
    const read = (kind: string, query: NodeQuery): Promise<ReadonlyArray<NodeRow>> => {
        const where = Object.entries(query.where ?? {})
        const rows = (store[kind] ?? []).filter((row) => where.every(([name, value]) => row[name] === value))
        return Promise.resolve(
            rows
                .slice(0, query.limit ?? rows.length)
                .map((row) => Object.fromEntries(query.fields.map((field) => [field, row[field]]))),
        )
    }
    return { ran, execute, read }
}

/** The tool door of the fake world: the bank account a payment request quotes. */
const DOOR: NodeToolDoor = {
    call: () =>
        Promise.resolve({
            bankName: "Vietcombank",
            bankCode: "VCB",
            accountNumber: "0123",
            accountHolder: "SHOP",
            qrUrl: "https://qr.example/DH001",
            provider: "sepay",
        }),
}

/** The services that drive a graph. */
export interface FlowServices {
    /** Routes a wake, opens its run and hands it to the threads the spec registers (`setThreads`). */
    readonly flows: AgentGraphFlowRunsService
}

/** What the scripted model answers, by the purpose a node asks it for: text or a structured answer, one per call. */
export type FlowModelScript = Record<string, Array<string | Readonly<Record<string, unknown>>>>

/** What a spec swaps in the engine around the graphs: the gate of the freezes, and the run engine the start of a run writes to. */
export interface FlowEngine {
    /** The gate the start of a run asks; none by default. */
    readonly gate?: AgentGraphFreezeGateService
    /** The run engine; a mock that writes nothing by default. */
    readonly runs?: AgentRunsService
    /**
     * The workflows of the shop's agents behind the real routing service: a wake is routed to one of them, and a step reads its graph by
     * the version id of its workflow. Absent, the `graph` given is the agent's only graph.
     */
    readonly workflows?: WorkflowWorld
    /** True to run the engine's guards on a hand-off (depth, cycle, a standing duplicate) at the start of every run; needs `workflows`. */
    readonly guarded?: boolean
    /** The lead memory the steps read and write: one per customer across workflows. Absent, refs read the run and the trigger only. */
    readonly memory?: LeadMemoryWorld
    /**
     * The ledger of the effects, by effect and call key: given, it outlives these services, so a run played again later repeats no call
     * it already made. Absent, the services keep their own.
     */
    readonly ledger?: Map<string, SubjectRef>
}

/** The model door: it answers as scripted per purpose, one answer per call. */
const modelOf = (model: FlowModelScript): NodeModelDoor => {
    const next = (ask: NodeModelRequest): string | Readonly<Record<string, unknown>> | undefined =>
        model[ask.purpose]?.shift()
    return mock<NodeModelDoor>({
        nodeText: (_scope, ask) => {
            const said = next(ask)
            return Promise.resolve(typeof said === "string" ? said : "")
        },
        nodeJson: (_scope, ask) => {
            const said = next(ask)
            return Promise.resolve(typeof said === "object" ? said : {})
        },
    })
}

/**
 * The graph store of the services: with workflows, each step reads its graph by the version id of its workflow and routing is the only
 * way in (an agent has no graph of its own that answers a wake no workflow takes); else `graph` is the agent's only graph.
 */
const graphStoreOf = (graph: GraphSpec, workflows: WorkflowWorld | undefined): AgentGraphsService => {
    const graphOf = (versionId: string): GraphSpec => workflows?.graphs.get(versionId) ?? graph
    return mock<AgentGraphsService>({
        documentOf: (_workspace: string, _agent: string, versionId?: string) =>
            Promise.resolve({ nodes: [], flow: graphOf(versionId ?? "") }),
        stateOfAgent: () =>
            Promise.resolve(
                workflows === undefined
                    ? stateOf({ activeVersionId: "version-1", active: { nodes: [], flow: graph } })
                    : null,
            ),
        runGrantOf: (_workspace: string, _agent: string, versionId?: string) => {
            const grant = graphOf(versionId ?? "").grant
            return Promise.resolve({ tools: grant.tools, effects: null })
        },
    })
}

/** The providers a spec swaps in around the graphs: the gate of the freezes, the routing, the guards and the lead memory. */
const engineProvidersOf = (engine: FlowEngine): ReadonlyArray<Provider> => {
    const { workflows, memory, gate } = engine
    const guards =
        workflows === undefined || engine.guarded !== true
            ? []
            : [
                  AgentGraphCallGuardService,
                  { provide: EntityEngineService, useValue: workflows.engine },
                  { provide: AgentWorkflowRecordsService, useValue: workflows.records },
              ]
    return [
        { provide: AgentRunsService, useValue: engine.runs ?? quietRuns() },
        ...(gate === undefined ? [] : [{ provide: AgentGraphFreezeGateService, useValue: gate }]),
        ...(workflows === undefined ? [] : [{ provide: AgentWorkflowRunsService, useValue: workflows.service }]),
        ...guards,
        ...(memory === undefined
            ? []
            : [AgentGraphStepMemoryService, { provide: LeadMemoryService, useValue: memory.service }]),
    ]
}

/** The services of the graphs, wired as Nest wires them, over the fake world and a model that answers as scripted per purpose. */
export const flowServicesOf = async (
    world: FlowWorld,
    graph: GraphSpec,
    model: FlowModelScript,
    door: NodeToolDoor = DOOR,
    engine: FlowEngine = {},
): Promise<FlowServices> => {
    const ai = modelOf(model)
    const graphs = graphStoreOf(graph, engine.workflows)
    /**
     * The ledger of the effects, as the back end keeps it: a call under a key it already ran answers the first subject and runs nothing
     * again; a call that threw or answered a refusal changed nothing and is kept under no key, so asking again really calls again.
     */
    const ran = engine.ledger ?? new Map<string, SubjectRef>()
    const effects = mock<GraphNodeEffectsService>({
        once: async (_workspace, _effect, call, act) => {
            const ledgerKey = `${_effect}|${call.key}`
            const first = ran.get(ledgerKey)
            if (first !== undefined) return first
            const subject = await act()
            if (!isRefused(subject)) ran.set(ledgerKey, subject)
            return subject
        },
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeRegistryService,
            GraphNodeHostService,
            AgentGraphFlowRunsService,
            AgentGraphRunNoticesService,
            {
                provide: GRAPH_NODES_OPTIONS,
                useValue: {
                    install: INSTALLED.nodeInstall(),
                },
            },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: EntityNodePortsService, useValue: mock<EntityNodePortsService>({ ports: () => [] }) },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: door },
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: AgentGraphsService, useValue: graphs },
            ...engineProvidersOf(engine),
            { provide: AgentWorkHandlersService, useValue: mock<AgentWorkHandlersService>() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: { transaction: (work: (tx: object) => unknown) => work({}) } },
            { provide: MESSAGE_CATALOG, useValue: { get: (key: string) => key } },
        ],
    }).compile()
    const registry = moduleRef.get(GraphNodeRegistryService)
    for (const kind of INSTALLED.nodeInstall().dataKinds) {
        registry.addDataPort({
            kind: kind.kind,
            read: (_turn: NodeTurn, query: NodeQuery) => world.read(kind.kind, query),
        })
    }
    for (const effect of INSTALLED.nodeInstall().effects) {
        registry.addExecutor({ effect: effect.id, execute: (turn, payload) => world.execute(effect.id, payload, turn) })
    }
    return { flows: moduleRef.get(AgentGraphFlowRunsService) }
}
