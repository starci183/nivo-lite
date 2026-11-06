import { EntityNodePortsService } from "@modules/domain/entity-engine"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { EffectPayload, NodeModelRequest, NodeQuery, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import { AgentRunHandlersService, AgentRunsService } from "@modules/domain/agent-runs"
import type { StepJson, StepSpec, StepView } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import type { AgentWakeContext } from "@modules/domain/agent-work"
import {
    AgentGraphFlowRunsService,
    AgentGraphNodeStepService,
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
    readonly execute: (effect: string, payload: EffectPayload) => Promise<SubjectRef>
    /** Reads rows of a data kind from the store. */
    readonly read: (kind: string, query: NodeQuery) => Promise<ReadonlyArray<NodeRow>>
    /** The customer messages of the store. */
    readonly conversation: FlowTriggerMessages
}

/** The kinds of subject the effects of the fake world answer. */
const SUBJECT_KINDS: Readonly<Record<string, string>> = {
    "order.record": "order",
    "payment-claim.record": "payment-claim",
    "lead.ensure": "sales-lead",
    "work-item.raise": "work-item",
    "channel.send": "message",
}

/** The world the graphs run against: an in-memory store behind every data kind, every effect recorded, scripted model and tools. */
export const flowWorldOf = (store: Record<string, Array<NodeRow>>, failOn: string | null = null): FlowWorld => {
    const ran: Array<FlowRan> = []
    const execute = (effect: string, payload: EffectPayload): Promise<SubjectRef> => {
        if (effect === failOn) return Promise.reject(new Error(`${effect} is down`))
        const kind = SUBJECT_KINDS[effect] ?? effect
        const subject = { kind, id: `${kind}-${ran.length + 1}` }
        if (effect === "order.record") {
            const rows = (store.order ??= [])
            rows.push({ id: subject.id, orderNo: "DH001", status: "draft", ...payload })
        }
        if (effect === "order.confirm") {
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

/** The services of the graphs, wired as Nest wires them, over the fake world and a model that answers as scripted per purpose. */
export const flowServicesOf = async (
    world: FlowWorld,
    graph: GraphSpec,
    model: FlowModelScript,
): Promise<FlowServices> => {
    const next = (ask: NodeModelRequest): string | Readonly<Record<string, unknown>> | undefined =>
        model[ask.purpose]?.shift()
    const ai = mock<NodeModelDoor>({
        nodeText: (_scope, ask) => {
            const said = next(ask)
            return Promise.resolve(typeof said === "string" ? said : "")
        },
        nodeJson: (_scope, ask) => {
            const said = next(ask)
            return Promise.resolve(typeof said === "object" ? said : {})
        },
    })
    const effects = mock<GraphNodeEffectsService>({ once: (_workspace, _effect, _call, act) => act() })
    const graphs = mock<AgentGraphsService>({
        documentOf: () => Promise.resolve({ nodes: [], rights: [], flow: graph }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeRegistryService,
            GraphNodeHostService,
            AgentGraphFlowRunsService,
            AgentGraphNodeStepService,
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
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: DOOR },
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentRunsService, useValue: mock<AgentRunsService>() },
            { provide: AgentRunHandlersService, useValue: mock<AgentRunHandlersService>() },
            { provide: AgentWorkHandlersService, useValue: mock<AgentWorkHandlersService>() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: {} },
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
        registry.addExecutor({ effect: effect.id, execute: (_turn, payload) => world.execute(effect.id, payload) })
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

/** The wake of the tag the Chatbot's hand-off writes for Sales: the words, and the items and address as the tag's data. */
export const salesWake = (): FlowWake => {
    const context: AgentWakeContext = {
        text: "The customer wants one flower pot",
        tagContext: JSON.stringify({
            items: [{ name: "flower pot", quantity: 1, priceVnd: null }],
            address: "69 Hang Xanh",
        }),
        conversationId: "conv-1",
        leadId: "lead-1",
        locale: "vi",
        authorAgentId: "chatbot-1",
    }
    return { source: "tag", actorMemberId: null, context }
}

/** The wake of the tag the Chatbot's hand-off writes for Accounting when a customer claims a payment. */
export const claimWake = (claimId: string): FlowWake => {
    const context: AgentWakeContext = {
        text: "I transferred 2k",
        tagContext: JSON.stringify({ claimKind: "payment-claim.record", claimId }),
        conversationId: "conv-1",
        leadId: "lead-1",
        locale: "vi",
        authorAgentId: "chatbot-1",
    }
    return { source: "tag", actorMemberId: null, context }
}

/** The claim row of a MoMo receipt for 2,000. */
export const CLAIM_ROW: NodeRow = {
    id: "claim-momo",
    leadId: "lead-1",
    conversationId: "conv-1",
    amountVnd: 2000,
    names: [],
    body: "[MoMo receipt photo] I transferred 2,000 dong",
    claimedAt: "2026-11-03T22:55:00.000Z",
    status: "open",
}

/** The bank transaction of 2,000 the feed holds, matched to no order. */
export const FEED_ROW: NodeRow = {
    id: "tx-95937289",
    amountVnd: 2000,
    content: "Test Sepay",
    counterpartName: null,
    receivedAt: "2026-11-03T22:51:00.000Z",
    orderId: null,
    status: "unmatched",
}

/** A confirmed order of 5,000 that no claim of 2,000 matches. */
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
