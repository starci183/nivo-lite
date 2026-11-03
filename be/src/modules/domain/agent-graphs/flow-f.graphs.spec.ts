import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { graphSpecProblems, graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import type { EffectCall, EffectPayload, NodeQuery, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import type { NodeModelRequest as NodeAsk } from "@nivo-lite/agent-sdk/node"
import { AgentRunHandlersService, AgentRunsService } from "@modules/domain/agent-runs"
import type { StepJson, StepSpec, StepView } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import {
    GRAPH_NODE_MODEL,
    GRAPH_NODE_TOOL_DOOR,
    GRAPH_NODES_OPTIONS,
    GraphNodeEffectsService,
    GraphNodeHostService,
    GraphNodeRegistryService,
} from "@modules/domain/graph-nodes"
import type { NodeModelDoor, NodeRow, NodeToolDoor, NodeTurn } from "@modules/domain/graph-nodes"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphNodeStepService } from "./agent-graph-node-step.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { tagSourceOf, triggerScopeOf } from "./policies/graph-flow.policy"
import type { FlowWake } from "./policies/graph-flow.policy"

/** The flow F graphs as the seed ships them. */
const graphOf = (name: string): GraphSpec =>
    graphSpecSchema.parse(
        JSON.parse(readFileSync(join(__dirname, `../../../../../.starcistacks/dev/seeds/data/graphs/${name}.json`), "utf8")),
    )

/** One effect the fake world ran: its id, payload and the subject it answered. */
interface Ran {
    readonly effect: string
    readonly payload: EffectPayload
    readonly subject: SubjectRef
}

/** The world the graphs run against: an in-memory store behind every data kind, every effect recorded, scripted model and tools. */
const worldOf = (store: Record<string, Array<NodeRow>>, failOn: string | null = null) => {
    const ran: Array<Ran> = []
    const subjectKinds: Readonly<Record<string, string>> = {
        "order.record": "order",
        "payment-claim.record": "payment-claim",
        "work-item.raise": "work-item",
        "channel.send": "message",
    }
    const execute = (effect: string, payload: EffectPayload): Promise<SubjectRef> => {
        if (effect === failOn) return Promise.reject(new Error(`${effect} is down`))
        const kind = subjectKinds[effect] ?? effect
        const subject = { kind, id: `${kind}-${ran.length + 1}` }
        if (effect === "order.record") {
            const rows = (store.order ??= [])
            rows.push({ id: subject.id, orderNo: "DH001", status: "draft", ...payload })
        }
        if (effect === "order.confirm") {
            for (const row of store.order ?? []) if (row.id === payload.orderId) Object.assign(row, { status: "confirmed" })
        }
        ran.push({ effect, payload, subject })
        return Promise.resolve(subject)
    }
    const read = (kind: string, query: NodeQuery): Promise<ReadonlyArray<NodeRow>> => {
        const where = Object.entries(query.where ?? {})
        const rows = (store[kind] ?? []).filter((row) => where.every(([name, value]) => row[name] === value))
        return Promise.resolve(
            rows.slice(0, query.limit).map((row) => Object.fromEntries(query.fields.map((field) => [field, row[field]]))),
        )
    }
    return { ran, execute, read }
}

const build = async (world: ReturnType<typeof worldOf>, graph: GraphSpec, model: Record<string, Array<unknown>>) => {
    const logger = mock<Logger>()
    const ai = mock<NodeModelDoor>({
        nodeText: jest.fn((_scope, ask: NodeAsk) => Promise.resolve(String(model[ask.purpose]?.shift() ?? ""))),
        nodeJson: jest.fn((_scope, ask: NodeAsk) => Promise.resolve(model[ask.purpose]?.shift() as never)),
    })
    const effects = mock<GraphNodeEffectsService>({
        once: jest.fn((_workspace: string, _effect: string, _call: EffectCall, act: () => Promise<SubjectRef>) => act()),
    })
    const door: NodeToolDoor = {
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeRegistryService,
            GraphNodeHostService,
            AgentGraphFlowRunsService,
            AgentGraphNodeStepService,
            {
                provide: GRAPH_NODES_OPTIONS,
                useValue: { install: { nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds } },
            },
            { provide: LOGGER, useValue: logger },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: door },
            {
                provide: AgentGraphsService,
                useValue: mock<AgentGraphsService>({
                    documentOf: jest.fn().mockResolvedValue({ nodes: [], rights: [], flow: graph }),
                }),
            },
            { provide: AgentRunsService, useValue: mock<AgentRunsService>() },
            { provide: AgentRunHandlersService, useValue: mock<AgentRunHandlersService>() },
            { provide: AgentWorkHandlersService, useValue: mock<AgentWorkHandlersService>() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: {} },
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
interface Drive {
    readonly path: ReadonlyArray<string>
    readonly outputs: Readonly<Record<string, StepJson>>
    readonly failed: string | null
    readonly undone: ReadonlyArray<string>
}

/**
 * Drives a graph the way the run engine does: the first node's step, then each step the last one wrote, with the results of the done
 * steps as `earlier`. A step that throws or fails ends the run; when no pivot is done, the done compensable steps are undone, last
 * first, as the engine's compensation does.
 */
const drive = async (built: Awaited<ReturnType<typeof build>>, graph: GraphSpec, wake: FlowWake): Promise<Drive> => {
    const trigger = triggerScopeOf(wake)
    const first = graph.nodes[0]
    if (first === undefined) throw new Error("empty graph")
    const pending: Array<StepSpec> = [built.flows.stepOf(first, { versionId: "version-1", nodeKey: first.key, trigger })]
    const done: Array<StepView> = []
    const earlier: Record<string, StepJson> = {}
    let failed: string | null = null
    for (let spec = pending.shift(); spec !== undefined && failed === null; spec = pending.shift()) {
        const view = { ...spec, runId: "run-1", workspaceId: "ws-1", agentId: "agent-1", earlier: { ...earlier }, result: null } as StepView
        const answer = await built.steps.run(view).catch((cause: unknown) => ({ kind: "failed" as const, code: String(cause) }))
        if (answer.kind !== "done") failed = spec.stepKey
        else {
            earlier[spec.stepKey] = answer.result
            done.push({ ...view, result: answer.result })
            pending.push(...answer.next)
        }
    }
    const pivoted = done.some((step) => step.effect.kind === "pivot")
    const undoable = failed === null || pivoted ? [] : done.filter((step) => step.effect.kind === "compensable").reverse()
    for (const step of undoable) await built.steps.compensate(step)
    return { path: done.map((step) => step.stepKey), outputs: earlier, failed, undone: undoable.map((step) => step.stepKey) }
}

const CATALOGUE = [{ id: "c1", name: "Chậu hoa", priceVnd: 150_000, active: true }]

const SALES_WAKE: FlowWake = {
    source: "tag",
    actorMemberId: null,
    context: {
        text: "Khách muốn đặt 1 chậu hoa",
        conversationId: "conv-1",
        leadId: "lead-1",
        authorAgentId: "chatbot-1",
        tagContext: JSON.stringify({ items: [{ name: "chậu hoa", quantity: 1, priceVnd: null }], address: "69 Hàng Xanh" }),
    },
}

describe("flow F graphs on fake ports", () => {
    it("pass the installed nodes with the saga rule on", () => {
        const installed = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })
        for (const name of ["sales", "chatbot", "accounting"]) expect(graphSpecProblems(graphOf(name), installed)).toEqual([])
    })

    it("Sales records the order, confirms it under the threshold and asks for the payment", async () => {
        const graph = graphOf("sales")
        const world = worldOf({ "catalogue-item": [...CATALOGUE] })
        const run = await drive(await build(world, graph, {}), graph, SALES_WAKE)

        expect(run.failed).toBeNull()
        expect(run.path).toEqual(["record", "complete", "needs-approval", "confirm", "request-payment"])
        expect(world.ran.map((entry) => entry.effect)).toEqual(["order.record", "order.confirm", "channel.send"])
        expect(world.ran[0]?.payload).toMatchObject({ leadId: "lead-1", amountVnd: 150_000 })
        expect(String(world.ran[2]?.payload.text)).toContain("DH001")
    })

    it("Sales voids the order it recorded when the confirmation fails before any pivot", async () => {
        const graph = graphOf("sales")
        const world = worldOf({ "catalogue-item": [...CATALOGUE] }, "order.confirm")
        const run = await drive(await build(world, graph, {}), graph, SALES_WAKE)

        expect(run.failed).toBe("confirm")
        expect(run.undone).toEqual(["record"])
        expect(world.ran.map((entry) => [entry.effect, entry.payload])).toEqual([
            ["order.record", expect.anything()],
            ["order.void", { id: "order-1" }],
        ])
    })

    it("Sales undoes nothing when the payment request fails after the confirmation, a pivot", async () => {
        const graph = graphOf("sales")
        const world = worldOf({ "catalogue-item": [...CATALOGUE] }, "channel.send")
        const run = await drive(await build(world, graph, {}), graph, SALES_WAKE)

        expect(run.failed).toBe("request-payment")
        expect(run.undone).toEqual([])
        expect(world.ran.map((entry) => entry.effect)).toEqual(["order.record", "order.confirm"])
    })

    it("Chatbot answers nothing and hands an order to Sales with its items as context", async () => {
        const graph = graphOf("chatbot")
        const world = worldOf({})
        const model = {
            "intent.classify:intent-classify": [
                {
                    intents: ["order"],
                    order: { items: [{ name: "chậu hoa", quantity: 1 }], address: "69 Hàng Xanh", customer: "Định" },
                    payment_claim: null,
                },
            ],
        }
        const wake: FlowWake = {
            source: "customer",
            actorMemberId: null,
            context: { text: "Đặt 1 chậu hoa, giao 69 Hàng Xanh", conversationId: "conv-1", leadId: "lead-1", channel: "zalo" },
        }
        const run = await drive(await build(world, graph, model), graph, wake)

        expect(run.failed).toBeNull()
        expect(run.path).toEqual(["classify", "has-question", "has-order", "handoff-sales", "has-claim", "end"])
        expect(world.ran.map((entry) => entry.effect)).toEqual(["agent.tag"])
        expect(world.ran[0]?.payload).toMatchObject({
            toModuleKey: "sales",
            leadId: "lead-1",
            conversationId: "conv-1",
            context: { items: [{ name: "chậu hoa", quantity: 1, priceVnd: null }], address: "69 Hàng Xanh" },
        })
    })

    it("Accounting judges a credit no order code explains, finds no claim to wait on, and says nothing", async () => {
        const graph = graphOf("accounting")
        const world = worldOf({
            "bank-transaction": [
                {
                    id: "t-1",
                    amountVnd: 99_000,
                    content: "CHUYEN TIEN",
                    counterpartName: "NGUYEN VAN A",
                    receivedAt: "2026-11-04T01:00:00.000Z",
                    orderId: null,
                    status: "new",
                },
            ],
        })
        const wake: FlowWake = {
            source: "tag",
            actorMemberId: null,
            context: { text: "credit", tagSource: "sepay", subject: "bank-transaction:t-1" },
        }
        const model = { "payment.judge:payment-judge": [{ verdict: "no_match", candidateId: null, reasons: ["nothing"] }] }
        const run = await drive(await build(world, graph, model), graph, wake)

        expect(run.failed).toBeNull()
        expect(run.path).toEqual(["evidence", "match-code", "judge", "claim-wait"])
        expect(world.ran).toEqual([])
    })
})

describe("the origin of the wakes the connections start", () => {
    it("takes an inbound message of a connection (Zalo OA or Telegram) as a channel origin, which the chatbot graph's trigger accepts", () => {
        const wake: FlowWake = {
            source: "customer",
            actorMemberId: null,
            context: { conversationId: "conv-1", messageId: "msg-1", channelEventId: "zalo:1", lookupName: true },
        }

        expect(tagSourceOf(wake)).toBe("channel")
        expect(graphOf("chatbot").trigger.sources).toContain(tagSourceOf(wake))
        expect(triggerScopeOf(wake)).toMatchObject({ origin: "channel", source: "channel", conversationId: "conv-1" })
    })

    it("takes the tag the bank feed writes for a new credit as a system event, which the accounting graph's trigger accepts", () => {
        const wake: FlowWake = {
            source: "tag",
            actorMemberId: null,
            context: { text: "Tiền về", tagSource: "bank_feed", subject: "bank-transaction:tx-1" },
        }

        expect(tagSourceOf(wake)).toBe("system-event")
        expect(graphOf("accounting").trigger.sources).toContain(tagSourceOf(wake))
        expect(triggerScopeOf(wake)).toMatchObject({
            origin: "system-event",
            source: "bank_feed",
            subject: { kind: "bank-transaction", id: "tx-1" },
        })
    })
})
