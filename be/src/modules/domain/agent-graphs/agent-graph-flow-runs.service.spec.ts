import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import { graphSpecProblems } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import {
    CATALOGUE,
    CLAIM_ROW,
    FEED_ROW,
    ORDER_ROW,
    salesWake,
    claimWake,
    driveFlow,
    flowServicesOf,
    flowWorldOf,
    seededGraphOf,
} from "@tests/fixtures/builders/flow-f-world.builder"
import type { SeededGraphName } from "@tests/fixtures/builders/flow-f-world.builder"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { GRAPH_FLOW_TRIGGER_MESSAGES } from "./agent-graphs.decorators"
import type { FlowTriggerConversation, FlowTriggerMessage, FlowTriggerMessages } from "./agent-graphs.port"
import { tagSourceOf, triggerScopeOf } from "./policies/graph-flow.policy"
import type { FlowWake } from "./policies/graph-flow.policy"

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: [], effects: ["order.record"] },
    nodes: [
        { key: "keep", kind: "output", step: "sales.order-from-chat", next: "end" },
        { key: "end", kind: "output", step: "stop" },
    ],
}

const TURN = agentTurnViewOf({
    source: "tag",
    context: { authorAgentId: "agent-2", text: "order" },
})

const stateWith = (flow: GraphSpec | undefined, versionId: string | null = "version-1"): GraphState =>
    stateOf({
        activeVersionId: versionId,
        active: { nodes: [], rights: [], ...(flow === undefined ? {} : { flow }) },
    })

/** The answers the port of the trigger messages gives, when the app binds one. */
interface TriggerAnswers {
    readonly said: ReadonlyArray<FlowTriggerMessage>
    readonly conversation: FlowTriggerConversation | null
}

const build = async (state: GraphState | null, answers: TriggerAnswers | null = null) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const runs = mock<AgentRunsService>({
        open: jest.fn().mockResolvedValue(runViewOf({ id: "run-1" })),
        append: jest.fn().mockResolvedValue(undefined),
    })
    const handlers = mock<AgentWorkHandlersService>()
    const nodes = mock<GraphNodeRegistryService>({
        installed: jest
            .fn()
            .mockReturnValue(
                nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds }),
            ),
    })
    const messages = mock<FlowTriggerMessages>({
        messagesOf: jest.fn().mockResolvedValue(answers?.said ?? []),
        conversationOf: jest.fn().mockResolvedValue(answers?.conversation ?? null),
    })
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef =
        answers === null
            ? await Test.createTestingModule({
                  providers: [
                      AgentGraphFlowRunsService,
                      { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
                      { provide: AgentGraphsService, useValue: graphs },
                      { provide: AgentRunsService, useValue: runs },
                      { provide: AgentWorkHandlersService, useValue: handlers },
                      { provide: GraphNodeRegistryService, useValue: nodes },
                  ],
              }).compile()
            : await Test.createTestingModule({
                  providers: [
                      AgentGraphFlowRunsService,
                      { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
                      { provide: AgentGraphsService, useValue: graphs },
                      { provide: AgentRunsService, useValue: runs },
                      { provide: AgentWorkHandlersService, useValue: handlers },
                      { provide: GraphNodeRegistryService, useValue: nodes },
                      { provide: GRAPH_FLOW_TRIGGER_MESSAGES, useValue: messages },
                  ],
              }).compile()
    return { flows: moduleRef.get(AgentGraphFlowRunsService), runs, handlers, messages }
}

describe("AgentGraphFlowRunsService", () => {
    it("sets itself as the drain's flow once the app has started", async () => {
        const { flows, handlers } = await build(null)
        flows.onModuleInit()
        expect(handlers.setFlow).toHaveBeenCalledWith(flows)
    })

    it("takes a wake whose origin the active flow's trigger names, and no other", async () => {
        await expect((await build(stateWith(FLOW))).flows.takes(TURN)).resolves.toBe(true)
        const channel = agentTurnViewOf({ source: "tag", context: { conversationId: "c-1" } })
        await expect((await build(stateWith(FLOW))).flows.takes(channel)).resolves.toBe(false)
        await expect((await build(stateWith(undefined))).flows.takes(TURN)).resolves.toBe(false)
        await expect((await build(stateWith(FLOW, null))).flows.takes(TURN)).resolves.toBe(false)
        await expect((await build(null)).flows.takes(TURN)).resolves.toBe(false)
    })

    it("opens the wake's run and writes the first node's step, compensable when its effects undo", async () => {
        const { flows, runs } = await build(stateWith(FLOW))

        await expect(flows.run(TURN)).resolves.toEqual({ status: "done", reason: null, outcome: { runId: "run-1" } })

        expect(runs.open).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            trigger: "tag",
            versionId: "version-1",
            context: TURN.context,
        })
        expect(runs.append).toHaveBeenCalledWith("ws-1", expect.anything(), "run-1", [
            {
                stepKey: "keep",
                nodeKey: "keep",
                kind: "graph_node",
                effect: { kind: "compensable", compensation: "graph_node" },
                input: {
                    versionId: "version-1",
                    nodeKey: "keep",
                    trigger: {
                        authorAgentId: "agent-2",
                        text: "order",
                        subject: null,
                        context: {},
                        source: "agent",
                        origin: "agent",
                        locale: "vi",
                    },
                },
            },
        ])
    })

    it("skips a wake when the agent no longer runs a flow, and reads a step of an uninstalled or stop node", async () => {
        const { flows, runs } = await build(stateWith(undefined))
        await expect(flows.run(TURN)).resolves.toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(runs.open).not.toHaveBeenCalled()
        const input = { versionId: "v", nodeKey: "end", trigger: {} }
        expect(flows.stepOf({ key: "end", kind: "output", step: "stop" }, input).effect).toEqual({ kind: "read" })
    })
})

describe("AgentGraphFlowRunsService.triggerOf", () => {
    const CHANNEL = agentTurnViewOf({
        source: "customer",
        context: {
            conversationId: "c-1",
            messageId: "m-2",
            channelEventId: "e-2",
            lookupName: false,
            mergedMessageIds: "m-1,m-3",
        },
    })
    const said = [
        { id: "m-1", text: "Hello shop", at: "2026-11-04T01:00:00.000Z", attachments: [] },
        {
            id: "m-2",
            text: "Transfer done",
            at: "2026-11-04T01:00:05.000Z",
            attachments: [{ id: "f-1", name: "bidv.jpg", contentType: "image/jpeg", url: "https://files.test/f-1" }],
        },
    ]

    it("reads the words, times and files of every customer message a channel wake answers, in the order they were said", async () => {
        const { flows, messages } = await build(stateWith(FLOW), {
            said,
            conversation: { leadId: "l-1", channel: "zalo" },
        })

        const trigger = await flows.triggerOf(CHANNEL)

        expect(messages.messagesOf).toHaveBeenCalledWith("ws-1", "c-1", ["m-2", "m-1", "m-3"])
        expect(trigger).toMatchObject({
            conversationId: "c-1",
            origin: "channel",
            text: "Hello shop\nTransfer done",
            messageIds: ["m-1", "m-2"],
            messages: said,
        })
    })

    it("reads the one message of a wake with no burst, keeps a tag's own words, and reads nothing without the port", async () => {
        const { flows, messages } = await build(stateWith(FLOW), { said: [], conversation: null })
        const single = agentTurnViewOf({
            source: "customer",
            context: { conversationId: "c-1", messageId: "m-2", channelEventId: "e-2" },
        })

        await expect(flows.triggerOf(single)).resolves.toMatchObject({
            text: "",
            messageIds: [],
            leadId: null,
            channel: null,
        })
        expect(messages.messagesOf).toHaveBeenCalledWith("ws-1", "c-1", ["m-2"])
        await expect(flows.triggerOf(TURN)).resolves.toMatchObject({ text: "order" })
        expect(messages.messagesOf).toHaveBeenCalledTimes(1)

        const bare = await build(stateWith(FLOW))
        await expect(bare.flows.triggerOf(single)).resolves.not.toHaveProperty("text")
    })
})

describe("flow F graphs on fake ports", () => {
    it("pass the installed nodes with the saga rule on", () => {
        const installed = nodeIndexOf({
            nodes: coreNodes,
            effects: coreEffects,
            tools: coreTools,
            dataKinds: coreDataKinds,
        })
        const names: ReadonlyArray<SeededGraphName> = ["sales", "chatbot", "accounting"]
        for (const name of names) expect(graphSpecProblems(seededGraphOf(name), installed)).toEqual([])
    })
})

describe("flow F graphs: Sales", () => {
    it("Sales records the order, confirms it under the threshold, asks for the payment and then asks the engine to rematch a credit that arrived before the payment code", async () => {
        const graph = seededGraphOf("sales")
        const world = flowWorldOf({ "catalogue-item": [...CATALOGUE] })
        const run = await driveFlow(await flowServicesOf(world, graph, {}), graph, salesWake())

        expect(run.failed).toBeNull()
        expect(run.path).toEqual(["record", "complete", "needs-approval", "confirm", "request-payment"])
        expect(world.ran.map((entry) => entry.effect)).toEqual([
            "order.record",
            "order.confirm",
            "channel.send",
            "payment.rematch",
        ])
        expect(world.ran[0]?.payload).toMatchObject({ leadId: "lead-1", amountVnd: 150_000 })
        expect(String(world.ran[2]?.payload.text)).toContain("DH001")
        // The rematch comes last, after the message that carries the code: a bank credit that reached the account before the code existed
        // can only be matched once the code is issued. It names the order, and it is not run when the payment request itself fails (below).
        expect(world.ran[3]?.payload).toEqual({ orderId: "order-1" })
    })

    it("Sales voids the order it recorded when the confirmation fails before any pivot", async () => {
        const graph = seededGraphOf("sales")
        const world = flowWorldOf({ "catalogue-item": [...CATALOGUE] }, "order.confirm")
        const run = await driveFlow(await flowServicesOf(world, graph, {}), graph, salesWake())

        expect(run.failed).toBe("confirm")
        expect(run.undone).toEqual(["record"])
        expect(world.ran.map((entry) => [entry.effect, entry.payload])).toEqual([
            ["order.record", expect.anything()],
            ["order.void", { id: "order-1" }],
        ])
    })

    it("Sales undoes nothing when the payment request fails after the confirmation, a pivot", async () => {
        const graph = seededGraphOf("sales")
        const world = flowWorldOf({ "catalogue-item": [...CATALOGUE] }, "channel.send")
        const run = await driveFlow(await flowServicesOf(world, graph, {}), graph, salesWake())

        expect(run.failed).toBe("request-payment")
        expect(run.undone).toEqual([])
        expect(world.ran.map((entry) => entry.effect)).toEqual(["order.record", "order.confirm"])
    })
})

describe("flow F graphs: Chatbot", () => {
    it("Chatbot answers nothing and hands an order to Sales with its items as context", async () => {
        const graph = seededGraphOf("chatbot")
        const world = flowWorldOf({
            messages: [
                { id: "msg-1", body: "Order one flower pot, deliver to 69 Hang Xanh", at: "2026-11-04T01:00:00.000Z" },
            ],
        })
        const model = {
            "intent.classify:intent-classify": [
                {
                    intents: ["order"],
                    order: { items: [{ name: "flower pot", quantity: 1 }], address: "69 Hang Xanh", customer: "Dinh" },
                    payment_claim: null,
                },
            ],
        }
        const wake: FlowWake = {
            source: "customer",
            actorMemberId: null,
            context: { conversationId: "conv-1", messageId: "msg-1", channelEventId: "zalo:1", lookupName: false },
        }
        const run = await driveFlow(await flowServicesOf(world, graph, model), graph, wake)

        expect(run.failed).toBeNull()
        expect(run.path).toEqual([
            "classify",
            "has-attachment",
            "has-question",
            "has-claim",
            "has-order",
            "ensure-lead-order",
            "handoff-sales",
        ])
        expect(world.ran.map((entry) => entry.effect)).toEqual(["lead.ensure", "agent.tag"])
        expect(world.ran[0]?.payload).toMatchObject({ conversationId: "conv-1" })
        expect(world.ran[1]?.payload).toMatchObject({
            toModuleKey: "sales",
            leadId: "sales-lead-1",
            conversationId: "conv-1",
            context: { items: [{ name: "flower pot", quantity: 1, priceVnd: null }], address: "69 Hang Xanh" },
        })
    })
})

describe("flow F graphs: Accounting", () => {
    it("Accounting judges a credit no order code explains, finds no claim to wait on, and says nothing", async () => {
        const graph = seededGraphOf("accounting")
        const world = flowWorldOf({
            "bank-transaction": [
                {
                    id: "t-1",
                    amountVnd: 99_000,
                    reference: "CHUYEN TIEN",
                    payer: "NGUYEN VAN A",
                    occurredAt: "2026-11-04T01:00:00.000Z",
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
        const model = {
            "payment.judge:payment-judge": [{ verdict: "no_match", candidateId: null, reasons: ["nothing"] }],
        }
        const run = await driveFlow(await flowServicesOf(world, graph, model), graph, wake)

        expect(run.failed).toBeNull()
        expect(run.path).toEqual(["entry", "evidence", "match-code", "judge", "claim-wait"])
        expect(world.ran).toEqual([])
    })
})

describe("flow F graphs: Accounting claims", () => {
    it("Accounting, tagged by the Chatbot with a claim of 2,000 and a MoMo receipt, finds transaction 95937289 but no order of 2,000 and raises it to the owner", async () => {
        const graph = seededGraphOf("accounting")
        const world = flowWorldOf({
            "bank-transaction": [FEED_ROW],
            "payment-claim": [CLAIM_ROW],
            order: [ORDER_ROW],
            "sales-lead": [{ id: "lead-1", contactName: "Bui Nguyen Dinh" }],
        })
        const model = {
            "payment.judge:payment-judge": [
                {
                    verdict: "ambiguous",
                    candidate_id: null,
                    reasons: ["The amount matches but there is no order of 2,000 dong"],
                },
            ],
        }
        const run = await driveFlow(await flowServicesOf(world, graph, model), graph, claimWake("claim-momo"))

        expect(run.failed).toBeNull()
        expect(run.path).toEqual(["entry", "evidence", "match-code", "judge", "raise-ambiguous"])
        expect(world.ran.map((entry) => entry.effect)).toEqual(["work-item.raise"])
        expect(world.ran[0]?.payload).toMatchObject({
            action: "reconcile_payment",
            payload: { transactionId: "tx-95937289" },
            claimId: "claim-momo",
        })
    })

    it("Accounting, tagged with a claim whose money is not in the feed yet, answers the customer neutrally and waits", async () => {
        const graph = seededGraphOf("accounting")
        const world = flowWorldOf({ "bank-transaction": [], "payment-claim": [CLAIM_ROW], order: [ORDER_ROW] })
        const run = await driveFlow(await flowServicesOf(world, graph, {}), graph, claimWake("claim-momo"))

        expect(run.failed).toBeNull()
        expect(run.path).toEqual(["entry", "evidence", "match-code", "judge", "claim-wait"])
        expect(world.ran.map((entry) => entry.effect)).toEqual(["channel.send"])
    })

    it("Accounting ends a tag that is neither a credit nor a claim", async () => {
        const graph = seededGraphOf("accounting")
        const world = flowWorldOf({})
        const wake: FlowWake = {
            source: "tag",
            actorMemberId: null,
            context: { text: "hello", authorAgentId: "agent-chat" },
        }
        const run = await driveFlow(await flowServicesOf(world, graph, {}), graph, wake)

        expect(run.failed).toBeNull()
        expect(run.path).toEqual(["entry", "end"])
        expect(world.ran).toEqual([])
    })

    it("the Chatbot passes the claim it recorded to Accounting as the context of its tag", () => {
        const handoff = seededGraphOf("chatbot").nodes.find((node) => node.key === "handoff-accounting")

        expect(handoff?.input).toMatchObject({ context: { claimId: { $ref: "claim-ack.claim.id" } } })
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
        expect(seededGraphOf("chatbot").trigger.sources).toContain(tagSourceOf(wake))
        expect(triggerScopeOf(wake)).toMatchObject({ origin: "channel", source: "channel", conversationId: "conv-1" })
    })

    it("takes the tag the bank feed writes for a new credit as a system event, which the accounting graph's trigger accepts", () => {
        const wake: FlowWake = {
            source: "tag",
            actorMemberId: null,
            context: { text: "Money in", tagSource: "bank_feed", subject: "bank-transaction:tx-1" },
        }

        expect(tagSourceOf(wake)).toBe("system-event")
        expect(seededGraphOf("accounting").trigger.sources).toContain(tagSourceOf(wake))
        expect(triggerScopeOf(wake)).toMatchObject({
            origin: "system-event",
            source: "bank_feed",
            subject: { kind: "bank-transaction", id: "tx-1" },
        })
    })
})
