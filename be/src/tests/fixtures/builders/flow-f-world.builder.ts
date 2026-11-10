import { EntityEngineService, EntityNodePortsService } from "@modules/domain/entity-engine"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Provider } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { isRefused } from "@nivo-lite/agent-sdk/node"
import type { EffectPayload, NodeModelRequest, NodeQuery, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools, TOOL } from "@nivo-lite/blocks-core"
import { AgentRunHandlersService, AgentRunsService } from "@modules/domain/agent-runs"
import type { StepJson, StepSpec, StepView } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import type { AgentWakeContext } from "@modules/domain/agent-work"
import {
    AgentGraphFlowRunsService,
    AgentGraphFreezeGateService,
    AgentGraphNodeStepService,
    AgentGraphRunNoticesService,
    AgentGraphsService,
    GRAPH_FLOW_TRIGGER_MESSAGES,
} from "@modules/domain/agent-graphs"
import type { FlowTriggerMessages, FlowWake } from "@modules/domain/agent-graphs"
import {
    GRAPH_NODE_MODEL,
    GRAPH_NODE_TOOL_DOOR,
    GRAPH_NODES_OPTIONS,
    GraphNodeEffectsService,
    GraphNodeHostService,
    GraphNodeRegistryService,
} from "@modules/domain/graph-nodes"
import type { NodeModelDoor, NodeRow, NodeToolDoor, NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { AgentGraphStepMemoryService } from "../../../modules/domain/agent-graphs/agent-graph-step-memory.service"
import { AgentGraphCallGuardService } from "../../../modules/domain/agent-graphs/agent-graph-call-guard.service"
import { AgentWorkflowRecordsService } from "../../../modules/domain/agent-graphs/agent-workflow-records.service"
import { AgentWorkflowRunsService } from "../../../modules/domain/agent-graphs/agent-workflow-runs.service"
import type { ConversationHoldsWorld } from "./conversation-holds-world.builder"
import { AgentGraphConversationHoldsService } from "../../../modules/domain/agent-graphs/agent-graph-conversation-holds.service"
import type { LeadMemoryWorld } from "./lead-memory-world.builder"
import type { WorkflowWorld } from "./workflow-world.builder"
import { stateOf } from "./agent-graph.builder"
import { stepViewOf } from "./agent-runs.builder"
import { agentTurnViewOf } from "./agent-work.builder"

/** Where the seed keeps its graph files, from this folder. */
const SEEDS_DIR = "../../../../../.starcistacks/dev/seeds/data/graphs"

/** The name of a graph the seed ships. */
export type SeededGraphName = "accounting" | "chatbot" | "sales"

/** The graph a seed file could not give: it holds no nodes and names the cause in its module key, so a spec that runs it fails on it. */
const unreadableSeed = (name: string, cause: unknown): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: `unreadable seed ${name}: ${String(cause)}`,
    trigger: { kind: "tag", sources: [] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [],
})

/** The graph of no workflow: what a world passes the services when every step reads its graph by the version id of its workflow. */
export const NO_FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "none",
    trigger: { kind: "tag", sources: [] },
    grant: { rights: [], tools: [], effects: [] },
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
    /** The customer messages of the store. */
    readonly conversation: FlowTriggerMessages
}

/**
 * The words of one team line a run posted: its plain `text`, or for the `workflow.stopped` card its summary with the AI core's reason and
 * question; the kind alone for a line with neither.
 */
export const teamLineOf = (payload: EffectPayload): string => {
    if (typeof payload.text === "string") return payload.text
    const card: unknown = payload.card
    const words = [payload.summary]
    if (typeof card === "object" && card !== null)
        words.push(Reflect.get(card, "reason"), Reflect.get(card, "question"))
    const told = words.filter((word) => typeof word === "string" && word !== "").join("\n")
    return told === "" ? String(payload.kind) : told
}

/** The kinds of subject the effects of the fake world answer. */
const SUBJECT_KINDS: Readonly<Record<string, string>> = {
    [TOOL.orderRecord]: "order",
    [TOOL.orderConfirm]: "order",
    [TOOL.paymentClaimRecord]: "payment-claim",
    [TOOL.leadEnsure]: "sales-lead",
    [TOOL.workItemRaise]: "work-item",
    [TOOL.customerMessageSend]: "message",
}

/** The world the graphs run against: an in-memory store behind every data kind, every effect recorded, scripted model and tools. */
export const flowWorldOf = (store: Record<string, Array<NodeRow>>, failOn: string | null = null): FlowWorld => {
    const ran: Array<FlowRan> = []
    const execute = (effect: string, payload: EffectPayload): Promise<SubjectRef> => {
        if (effect === failOn) return Promise.reject(new Error(`${effect} is down`))
        const kind = SUBJECT_KINDS[effect] ?? effect
        // An effect on a record that is there answers that record (confirming an order answers the order), else a new one.
        const named = typeof payload.orderId === "string" && kind === "order" ? payload.orderId : null
        const subject = { kind, id: named ?? `${kind}-${ran.length + 1}` }
        if (effect === TOOL.orderRecord) {
            const rows = (store.order ??= [])
            rows.push({ id: subject.id, orderNo: "DH001", status: "draft", ...payload })
        }
        if (effect === TOOL.orderConfirm) {
            for (const row of store.order ?? [])
                if (row.id === payload.orderId) Object.assign(row, { status: "confirmed" })
        }
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
    /** The conversation the customer wrote in, as the store answers a channel wake: the words, the times and the files. */
    const conversation: FlowTriggerMessages = {
        messagesOf: (_workspace, _conversation, ids) =>
            Promise.resolve(
                (store.messages ?? [])
                    .filter((row) => ids.includes(String(row.id)))
                    .map((row) => ({
                        id: String(row.id),
                        text: String(row.body),
                        at: String(row.at),
                        attachments: [],
                    })),
            ),
        conversationOf: () => Promise.resolve({ leadId: "lead-1", channel: "zalo" }),
    }
    return { ran, execute, read, conversation }
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
    /** Opens the run of a wake and writes the step of a node. */
    readonly flows: AgentGraphFlowRunsService
    /** Runs a step of a node and undoes it. */
    readonly steps: AgentGraphNodeStepService
}

/** What the scripted model answers, by the purpose a node asks it for: text or a structured answer, one per call. */
export type FlowModelScript = Record<string, Array<string | Readonly<Record<string, unknown>>>>

/** What a spec swaps in the engine around the graphs: the gate of the freezes, and the run engine the start of a run writes to. */
export interface FlowEngine {
    /** The gate the start of a run and a stopped run ask; none by default. */
    readonly gate?: AgentGraphFreezeGateService
    /** The run engine; a mock that writes nothing by default. */
    readonly runs?: AgentRunsService
    /**
     * The workflows of the shop's agents behind the real routing service: a wake is routed to one of them, and a step reads its graph by
     * the version id of its workflow. Absent, the `graph` given is the agent's only graph.
     */
    readonly workflows?: WorkflowWorld
    /** The conversations the Sales consult keeps between turns: a customer's line to another agent is sent on to the keeper. */
    readonly holds?: ConversationHoldsWorld
    /** True to run the engine's guards on a hand-off (depth, cycle, a standing duplicate) at the start of every run; needs `workflows`. */
    readonly guarded?: boolean
    /** The lead memory the steps read and write: one per customer across workflows. Absent, refs read the run and the trigger only. */
    readonly memory?: LeadMemoryWorld
    /**
     * The ledger of the effects, by effect and call key: given, it outlives these services, so a run played again later (a retry from
     * its failed step) repeats no call it already made. Absent, the services keep their own.
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
            Promise.resolve({ nodes: [], rights: [], flow: graphOf(versionId ?? "") }),
        stateOfAgent: () =>
            Promise.resolve(
                workflows === undefined
                    ? stateOf({ activeVersionId: "version-1", active: { nodes: [], rights: [], flow: graph } })
                    : null,
            ),
        runGrantOf: (_workspace: string, _agent: string, versionId?: string) => {
            const grant = graphOf(versionId ?? "").grant
            return Promise.resolve({ rights: grant.rights, tools: grant.tools, effects: null })
        },
    })
}

/** The providers a spec swaps in around the graphs: the gate of the freezes, the routing, the guards and the lead memory. */
const engineProvidersOf = (engine: FlowEngine, graphs: AgentGraphsService): ReadonlyArray<Provider> => {
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
        { provide: AgentRunsService, useValue: engine.runs ?? mock<AgentRunsService>() },
        ...(gate === undefined ? [] : [{ provide: AgentGraphFreezeGateService, useValue: gate }]),
        ...(workflows === undefined ? [] : [{ provide: AgentWorkflowRunsService, useValue: workflows.service }]),
        ...guards,
        ...(engine.holds === undefined
            ? []
            : [
                  {
                      provide: AgentGraphConversationHoldsService,
                      useValue: engine.holds.serviceOver(graphs, engine.workflows),
                  },
              ]),
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
            AgentGraphNodeStepService,
            AgentGraphRunNoticesService,
            {
                provide: GRAPH_NODES_OPTIONS,
                useValue: {
                    install: { nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds },
                },
            },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: EntityNodePortsService, useValue: mock<EntityNodePortsService>({ ports: () => [] }) },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: door },
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: AgentGraphsService, useValue: graphs },
            ...engineProvidersOf(engine, graphs),
            { provide: AgentRunHandlersService, useValue: mock<AgentRunHandlersService>() },
            { provide: AgentWorkHandlersService, useValue: mock<AgentWorkHandlersService>() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: { transaction: (work: (tx: object) => unknown) => work({}) } },
            { provide: GRAPH_FLOW_TRIGGER_MESSAGES, useValue: world.conversation },
            { provide: MESSAGE_CATALOG, useValue: { get: (key: string) => key } },
        ],
    }).compile()
    const registry = moduleRef.get(GraphNodeRegistryService)
    for (const kind of coreDataKinds) {
        registry.addDataPort({
            kind: kind.kind,
            read: (_turn: NodeTurn, query: NodeQuery) => world.read(kind.kind, query),
        })
    }
    for (const effect of coreEffects) {
        registry.addExecutor({ effect: effect.id, execute: (turn, payload) => world.execute(effect.id, payload, turn) })
    }
    return { flows: moduleRef.get(AgentGraphFlowRunsService), steps: moduleRef.get(AgentGraphNodeStepService) }
}

/** How a run of a graph ended: the nodes done, in order, the step that failed, and the steps a compensation undid. */
export interface FlowDrive {
    /** The node steps done, in order. */
    readonly path: ReadonlyArray<string>
    /** The result of each done step, by step key. */
    readonly outputs: Readonly<Record<string, StepJson>>
    /** The step that failed or threw, or null. */
    readonly failed: string | null
    /** The steps a compensation undid, last first. */
    readonly undone: ReadonlyArray<string>
}

/** What a run has done so far. */
interface FlowProgress {
    /** The steps done, in order. */
    readonly done: ReadonlyArray<StepView>
    /** The result of each done step, by step key. */
    readonly earlier: Readonly<Record<string, StepJson>>
    /** The step that failed or threw, or null. */
    readonly failed: string | null
}

/** Runs the queued steps one after another, each with the results of the done ones, until the queue is empty or a step fails. */
const advance = async (
    steps: AgentGraphNodeStepService,
    queue: ReadonlyArray<StepSpec>,
    progress: FlowProgress,
): Promise<FlowProgress> => {
    const [spec, ...rest] = queue
    if (spec === undefined || progress.failed !== null) return progress
    const view = stepViewOf({ ...spec, earlier: { ...progress.earlier }, result: null })
    const answer = await steps.run(view).catch((cause: unknown) => ({ kind: "failed" as const, code: String(cause) }))
    if (answer.kind !== "done") return { ...progress, failed: spec.stepKey }
    return advance(steps, [...rest, ...answer.next], {
        done: [...progress.done, { ...view, result: answer.result }],
        earlier: { ...progress.earlier, [spec.stepKey]: answer.result },
        failed: null,
    })
}

/**
 * Drives a graph the way the run engine does, from the wake as the store answers it: the first node's step, then each step the last one
 * wrote, with the results of the done steps as `earlier`. A step that throws or fails ends the run; when no pivot is done, the done
 * compensable steps are undone, last first, as the engine's compensation does.
 */
export const driveFlow = async (built: FlowServices, graph: GraphSpec, wake: FlowWake): Promise<FlowDrive> => {
    const turn = agentTurnViewOf({
        source: wake.source,
        actorMemberId: wake.actorMemberId,
        context: structuredClone(wake.context),
    })
    const trigger = await built.flows.triggerOf(turn)
    const first = graph.nodes[0]
    const queue =
        first === undefined ? [] : [built.flows.stepOf(first, { versionId: "version-1", nodeKey: first.key, trigger })]
    return driveQueue(built, queue)
}

/** Plays the queued first steps of a run the way the run engine does, and undoes the compensable ones when it fails before a pivot. */
export const driveQueue = async (built: FlowServices, queue: ReadonlyArray<StepSpec>): Promise<FlowDrive> => {
    const { done, earlier, failed } = await advance(built.steps, queue, { done: [], earlier: {}, failed: null })
    const pivoted = done.some((step) => step.effect.kind === "pivot")
    const undoable =
        failed === null || pivoted ? [] : done.filter((step) => step.effect.kind === "compensable").reverse()
    await eachInOrder(undoable, (step) => built.steps.compensate(step))
    return {
        path: done.map((step) => step.stepKey),
        outputs: earlier,
        failed,
        undone: undoable.map((step) => step.stepKey),
    }
}

/** The catalogue of the shop in the Sales scenarios: one flower pot. */
export const CATALOGUE: ReadonlyArray<NodeRow> = [{ id: "c1", name: "Flower pot", priceVnd: 150_000, active: true }]

/** The workflow a hand-off calls: its key and the version (`latest` unless one is pinned). */
export interface HandOffTarget {
    readonly workflow: string
    readonly version?: string | number
}

/**
 * The wake of the end hand-off a workflow writes for another: the words, the pin of the target (workflow and version), ONLY the params it
 * maps, and the calling run. It carries the lead and the conversation as flat members, as the tag door writes them.
 */
export const handOffWake = (
    target: HandOffTarget,
    params: Readonly<Record<string, unknown>>,
    text: string = "",
    callerRunId: string = "run-caller",
): FlowWake => {
    const context: AgentWakeContext = {
        text,
        tagContext: JSON.stringify({
            workflowCall: { workflow: target.workflow, version: target.version ?? "latest" },
            params,
            caller: { runId: callerRunId },
        }),
        ...(typeof params.conversationId === "string" ? { conversationId: params.conversationId } : {}),
        ...(typeof params.leadId === "string" ? { leadId: params.leadId } : {}),
        locale: "vi",
        authorAgentId: "chatbot-1",
    }
    return { source: "tag", actorMemberId: null, context }
}

/** The wake of the Chatbot's hand-off to the Sales consult: the customer's words, their conversation and channel, and who they are. */
export const salesWake = (): FlowWake =>
    handOffWake(
        { workflow: "consult" },
        {
            leadId: "lead-1",
            conversationId: "conv-1",
            text: "One flower pot to 69 Hang Xanh please",
            channel: "zalo",
        },
        "One flower pot to 69 Hang Xanh please",
    )

/** The wake of the tag the Chatbot's hand-off writes for Accounting when a customer says they paid: their words go to the reconcile workflow. */
export const claimWake = (text: string = "I transferred 2k"): FlowWake =>
    handOffWake({ workflow: "reconcile" }, { leadId: "lead-1", conversationId: "conv-1", text, channel: "zalo" }, text)

/** The bank transaction of 2,000 the feed holds, matched to no order. */
export const FEED_ROW: NodeRow = {
    id: "tx-95937289",
    amountVnd: 2000,
    reference: "Test Sepay",
    payer: null,
    occurredAt: "2026-11-03T22:51:00.000Z",
    orderId: null,
    status: "unmatched",
}

/** A confirmed order of 5,000 of the customer of the scenarios. */
export const ORDER_ROW: NodeRow = {
    id: "order-1",
    orderNo: "SO-0001",
    leadId: "lead-1",
    items: [],
    amountVnd: 5000,
    status: "confirmed",
    confirmedAt: "2026-11-04T00:40:00.000Z",
    createdAt: "2026-11-04T00:35:00.000Z",
}
