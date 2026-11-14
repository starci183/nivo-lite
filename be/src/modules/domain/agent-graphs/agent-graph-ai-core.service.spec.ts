import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { ChannelDeliveriesService, type StoredDelivery } from "@modules/domain/customer-routes"
import { GraphNodeHostService, GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { AgentGraphAiCoreService } from "./agent-graph-ai-core.service"
import type { CoreAsk } from "./agent-graph-ai-core.service"

const TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "c-1",
    locale: "vi",
    origin: "system",
    memberId: null,
    handedOffBy: null,
}

/** A pure step (it reads and decides) and a step that acts on the world (it runs an effect). */
const EVIDENCE = mock<NodeDefinition>({
    id: "payment.evidence",
    effects: [],
    output: z.object({ names: z.array(z.string()) }),
})
const SETTLE = mock<NodeDefinition>({
    id: "payment.settle",
    effects: ["payment.mark-paid"],
    output: z.object({ result: z.string() }),
})

const installed = (): ReturnType<GraphNodeRegistryService["installed"]> =>
    mock<ReturnType<GraphNodeRegistryService["installed"]>>({
        nodes: new Map([
            ["payment.evidence", EVIDENCE],
            ["payment.settle", SETTLE],
        ]),
    })

const THREW = {
    kind: "threw" as const,
    code: "handler_threw",
    text: "TypeError: claim.names is not iterable",
    data: {},
}

const askOf = (over: Partial<CoreAsk> = {}): CoreAsk => ({
    turn: TURN,
    nodeKey: "evidence",
    nodeStep: "payment.evidence",
    trouble: THREW,
    given: { claimId: "claim-1", names: { values: [] } },
    trigger: { conversationId: "c-1" },
    earlier: {},
    memory: null,
    conversationId: "c-1",
    ...over,
})

/** One ledger row of what the shop told on the route. */
const toldOf = (text: string, state: StoredDelivery["state"]): StoredDelivery => ({
    id: `d-${text}`,
    seq: "1",
    sendKey: `k-${text}`,
    routeId: "c-1",
    contactId: "contact-1",
    agentId: "agent-1",
    runId: "run-0",
    stepKey: "answer",
    text,
    attachmentCount: 0,
    attachmentKinds: [],
    state,
    reason: null,
    providerMessageId: null,
    channel: "zalo",
    accountId: "conn-1",
    createdAt: "2026-11-14T01:00:00.000Z",
    deliveredAt: state === "delivered" ? "2026-11-14T01:00:01.000Z" : null,
})

const buildCore = async () => {
    const host = mock<GraphNodeHostService>()
    const messages = mock<ChannelDeliveriesService>()
    messages.listByRoute.mockResolvedValue({ rows: [toldOf("Da em ghi nhan a", "delivered")], next: null })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphAiCoreService,
            { provide: GraphNodeHostService, useValue: host },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({ installed: jest.fn(installed) }),
            },
            { provide: ChannelDeliveriesService, useValue: messages },
        ],
    }).compile()
    return { core: moduleRef.get(AgentGraphAiCoreService), host, messages }
}

describe("AgentGraphAiCoreService the one decision on a step that could not complete", () => {
    it("lets the AI produce the output of a pure step, checked against the node's own schema (the `claim.names` shape of run 1a657e35)", async () => {
        const { core, host } = await buildCore()
        host.core.mockResolvedValue({ decision: "output", output: { names: [] } })

        const trigger = {
            conversationId: "c-1",
            messages: [{ id: "m-1", text: "Tôi chuyển 2k dư r", at: "2026-11-14T00:59:00.000Z", attachments: [] }],
        }
        await expect(core.decide(askOf({ trigger }))).resolves.toEqual({ kind: "output", output: { names: [] } })

        expect(host.core).toHaveBeenCalledTimes(1)
        const [turn, ask] = host.core.mock.calls[0] ?? []
        expect(turn).toBe(TURN)
        expect(ask?.purpose).toBe("engine:step-trouble")
        expect(ask?.input).toMatchObject({
            step: { key: "evidence", node: "payment.evidence" },
            // The wake's own lines and what the ledger says was told on the route, oldest first: no chatbot record is read.
            conversation: [
                { role: "user", body: "Tôi chuyển 2k dư r" },
                { role: "agent", body: "Da em ghi nhan a" },
            ],
            whatWentWrong: { kind: "threw", code: "handler_threw", text: "TypeError: claim.names is not iterable" },
        })
    })

    it("shows the AI core only what the customer was told: a refused or unknown send is no part of the thread", async () => {
        const { core, host, messages } = await buildCore()
        host.core.mockResolvedValue({ decision: "report", report: "x", customerLine: null })
        messages.listByRoute.mockResolvedValue({
            rows: [toldOf("not sent", "refused"), toldOf("maybe", "unknown"), toldOf("told", "delivered")],
            next: null,
        })

        await core.decide(askOf())

        expect(host.core.mock.calls.map(([, ask]) => Reflect.get(Object(ask?.input), "conversation"))).toEqual([
            [{ role: "agent", body: "told" }],
        ])
    })

    it("ENG1: hands the host the run step the call is booked to (the iteration's key), else the node key", async () => {
        const { core, host } = await buildCore()
        host.core.mockResolvedValue({ decision: "output", output: { names: [] } })

        await core.decide(askOf({ stepKey: "evidence[1]" }))
        await core.decide(askOf())

        expect(host.core.mock.calls.map((call) => call[3])).toEqual(["evidence[1]", "evidence"])
    })

    it("answers the AI's report in its own words, and the line it chose for the customer (none when it chose none)", async () => {
        const { core, host } = await buildCore()
        const suggestions = [
            { text: "Nh\u1eadn kho\u1ea3n d\u01b0 v\u00e0 ghi s\u1ed5", handledBy: "workflow" },
            { text: "Ho\u00e0n l\u1ea1i kh\u00e1ch", handledBy: "person" },
        ]
        host.core.mockResolvedValueOnce({
            decision: "report",
            reason: " C\u1ea7n anh xem kho\u1ea3n d\u01b0. ",
            question: " Nh\u1eadn kho\u1ea3n d\u01b0 kh\u00f4ng? ",
            suggestions,
            customerLine: "D\u1ea1 shop \u0111ang ki\u1ec3m tra \u1ea1.",
        })
        host.core.mockResolvedValueOnce({
            decision: "report",
            reason: "C\u1ea7n anh xem.",
            question: "  ",
            suggestions,
            customerLine: "  ",
        })

        await expect(core.decide(askOf())).resolves.toEqual({
            kind: "report",
            reason: "C\u1ea7n anh xem kho\u1ea3n d\u01b0.",
            question: "Nh\u1eadn kho\u1ea3n d\u01b0 kh\u00f4ng?",
            suggestions,
            customerLine: "D\u1ea1 shop \u0111ang ki\u1ec3m tra \u1ea1.",
        })
        await expect(core.decide(askOf())).resolves.toEqual({
            kind: "report",
            reason: "C\u1ea7n anh xem.",
            question: null,
            suggestions,
            customerLine: null,
        })
    })

    it("never answers for a step that acts on the world: it is asked for a report only, so no answer can stand in for the effect", async () => {
        const { core, host } = await buildCore()
        host.core.mockResolvedValue({
            decision: "report",
            reason: "Giao d\u1ecbch kh\u00f4ng kh\u1edbp \u0111\u01a1n.",
            question: null,
            suggestions: [
                { text: "Nh\u1eadn kho\u1ea3n d\u01b0 v\u00e0 ghi s\u1ed5", handledBy: "workflow" },
                { text: "Ho\u00e0n l\u1ea1i kh\u00e1ch", handledBy: "person" },
            ],
            customerLine: null,
        })

        await core.decide(askOf({ nodeKey: "settle", nodeStep: "payment.settle" }))

        const [, ask, schema] = host.core.mock.calls[0] ?? []
        expect(ask?.instructions).toContain("can NOT produce its output")
        expect(schema?.safeParse({ decision: "output", output: { result: "paid" } }).success).toBe(false)
        const report = { decision: "report", reason: "x", question: null, customerLine: null }
        const one = [{ text: "a", handledBy: "person" }]
        const two = [...one, { text: "b", handledBy: "workflow" }]
        const four = [...two, ...two]
        expect(schema?.safeParse({ ...report, suggestions: two }).success).toBe(true)
        expect(schema?.safeParse({ ...report, suggestions: one }).success).toBe(false)
        expect(schema?.safeParse({ ...report, suggestions: four }).success).toBe(false)
        expect(schema?.safeParse({ ...report, report: "x", reason: undefined, suggestions: two }).success).toBe(false)
    })

    it("is `ai_failed`, never a guess, when the AI cannot be reached or its output breaks the step's contract", async () => {
        const { core, host } = await buildCore()
        host.core.mockRejectedValueOnce(new Error("provider down"))
        host.core.mockResolvedValueOnce({ decision: "output", output: { names: "none" } })

        await expect(core.decide(askOf())).resolves.toEqual({ kind: "ai_failed", code: "ai_core_failed" })
        await expect(core.decide(askOf())).resolves.toEqual({ kind: "ai_failed", code: "ai_core_output_invalid" })
    })

    it("decides without a conversation when the run serves none or it cannot be read", async () => {
        const { core, host, messages } = await buildCore()
        host.core.mockResolvedValue({ decision: "report", report: "x", customerLine: null })
        messages.listByRoute.mockRejectedValueOnce(new Error("db"))

        await core.decide(askOf())
        await core.decide(askOf({ conversationId: null }))

        expect(host.core.mock.calls.map(([, ask]) => Reflect.get(Object(ask?.input), "conversation"))).toEqual([
            null,
            null,
        ])
    })
})
