import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { ChatMessagesService } from "@modules/domain/chat-records"
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

const buildCore = async () => {
    const host = mock<GraphNodeHostService>()
    const messages = mock<ChatMessagesService>()
    messages.transcript.mockResolvedValue([{ role: "user", body: "Tôi chuyển 2k dư r" }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphAiCoreService,
            { provide: GraphNodeHostService, useValue: host },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({ installed: jest.fn(installed) }),
            },
            { provide: ChatMessagesService, useValue: messages },
        ],
    }).compile()
    return { core: moduleRef.get(AgentGraphAiCoreService), host, messages }
}

describe("AgentGraphAiCoreService the one decision on a step that could not complete", () => {
    it("lets the AI produce the output of a pure step, checked against the node's own schema (the `claim.names` shape of run 1a657e35)", async () => {
        const { core, host } = await buildCore()
        host.core.mockResolvedValue({ decision: "output", output: { names: [] } })

        await expect(core.decide(askOf())).resolves.toEqual({ kind: "output", output: { names: [] } })

        expect(host.core).toHaveBeenCalledTimes(1)
        const [turn, ask] = host.core.mock.calls[0] ?? []
        expect(turn).toBe(TURN)
        expect(ask?.purpose).toBe("engine:step-trouble")
        expect(ask?.input).toMatchObject({
            step: { key: "evidence", node: "payment.evidence" },
            conversation: [{ role: "user", body: "Tôi chuyển 2k dư r" }],
            whatWentWrong: { kind: "threw", code: "handler_threw", text: "TypeError: claim.names is not iterable" },
        })
    })

    it("answers the AI's report in its own words, and the line it chose for the customer (none when it chose none)", async () => {
        const { core, host } = await buildCore()
        const suggestions = [
            { text: "Nhận khoản dư và ghi sổ", handledBy: "workflow" },
            { text: "Hoàn lại khách", handledBy: "person" },
        ]
        host.core.mockResolvedValueOnce({
            decision: "report",
            reason: " Cần anh xem khoản dư. ",
            question: " Nhận khoản dư không? ",
            suggestions,
            customerLine: "Dạ shop đang kiểm tra ạ.",
        })
        host.core.mockResolvedValueOnce({
            decision: "report",
            reason: "Cần anh xem.",
            question: "  ",
            suggestions,
            customerLine: "  ",
        })

        await expect(core.decide(askOf())).resolves.toEqual({
            kind: "report",
            reason: "Cần anh xem khoản dư.",
            question: "Nhận khoản dư không?",
            suggestions,
            customerLine: "Dạ shop đang kiểm tra ạ.",
        })
        await expect(core.decide(askOf())).resolves.toEqual({
            kind: "report",
            reason: "Cần anh xem.",
            question: null,
            suggestions,
            customerLine: null,
        })
    })

    it("never answers for a step that acts on the world: it is asked for a report only, so no answer can stand in for the effect", async () => {
        const { core, host } = await buildCore()
        host.core.mockResolvedValue({
            decision: "report",
            reason: "Giao dịch không khớp đơn.",
            question: null,
            suggestions: [
                { text: "Nhận khoản dư và ghi sổ", handledBy: "workflow" },
                { text: "Hoàn lại khách", handledBy: "person" },
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
        messages.transcript.mockRejectedValueOnce(new Error("db"))

        await core.decide(askOf())
        await core.decide(askOf({ conversationId: null }))

        expect(host.core.mock.calls.map(([, ask]) => Reflect.get(Object(ask?.input), "conversation"))).toEqual([
            null,
            null,
        ])
    })
})
