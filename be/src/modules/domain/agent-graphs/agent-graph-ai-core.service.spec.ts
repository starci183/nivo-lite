import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { NodeBusinessFailure, NodeConfused } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { NOW, TRIGGER, stepOf } from "@tests/fixtures/builders/agent-graph-node-step.builder"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import { ChatMessagesService } from "@modules/domain/chat-records"
import { GraphNodeHostService, GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphAiCoreService } from "./agent-graph-ai-core.service"
import type { CoreAsk } from "./agent-graph-ai-core.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphNodeStepService } from "./agent-graph-node-step.service"
import { AgentGraphRunNoticesService } from "./agent-graph-run-notices.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { EMPTY_GRANT, ownRunGrantOf } from "./policies/workflow-grant.policy"

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

/** One node that reads and decides, one that acts; neither has a failure branch drawn. */
const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: [], effects: ["payment.mark-paid"] },
    nodes: [
        { key: "evidence", kind: "execute", step: "payment.evidence", next: "settle" },
        { key: "settle", kind: "output", step: "payment.settle" },
    ],
}

const buildSteps = async () => {
    const core = mock<AgentGraphAiCoreService>()
    const host = mock<GraphNodeHostService>()
    const notices = mock<AgentGraphRunNoticesService>()
    notices.stuck.mockResolvedValue(undefined)
    const flows = mock<AgentGraphFlowRunsService>()
    flows.stepOf.mockImplementation((node) =>
        mock<ReturnType<AgentGraphFlowRunsService["stepOf"]>>({ stepKey: node.key, nodeKey: node.key }),
    )
    const graphs = mock<AgentGraphsService>({
        documentOf: jest.fn().mockResolvedValue({ nodes: [], rights: [], flow: FLOW }),
        runGrantOf: jest.fn().mockResolvedValue(ownRunGrantOf(FLOW.grant ?? EMPTY_GRANT)),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphNodeStepService,
            { provide: AgentRunHandlersService, useValue: mock<AgentRunHandlersService>() },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphNodeHostService, useValue: host },
            { provide: AgentGraphFlowRunsService, useValue: flows },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({ installed: jest.fn(installed) }),
            },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentGraphRunNoticesService, useValue: notices },
            { provide: AgentGraphAiCoreService, useValue: core },
        ],
    }).compile()
    return { steps: moduleRef.get(AgentGraphNodeStepService), host, core, notices }
}

const at = (nodeKey: string) => stepOf(nodeKey, { earlier: {} })

describe("AgentGraphNodeStepService a step that cannot complete (the one wrapper)", () => {
    it("hands a node that threw to the AI core first, and goes on with the output it produced: the step is done, marked recovered by the AI, the raw cause logged", async () => {
        const { steps, host, core, notices } = await buildSteps()
        host.run.mockRejectedValue(new TypeError("claim.names is not iterable"))
        core.decide.mockResolvedValue({ kind: "output", output: { names: [] } })

        const answer = await steps.run(at("evidence"))

        expect(answer).toMatchObject({
            kind: "done",
            result: {
                output: { names: [] },
                effects: [],
                recovered: { by: "ai", code: "handler_threw", kind: "threw" },
            },
            next: [{ stepKey: "settle" }],
        })
        expect(core.decide).toHaveBeenCalledTimes(1)
        expect(core.decide).toHaveBeenCalledWith(
            expect.objectContaining({
                nodeKey: "evidence",
                nodeStep: "payment.evidence",
                trouble: {
                    kind: "threw",
                    code: "handler_threw",
                    text: "TypeError: claim.names is not iterable",
                    data: {},
                },
                trigger: TRIGGER,
                conversationId: "c-1",
            }),
        )
        expect(notices.troubled).toHaveBeenCalledTimes(1)
        expect(notices.recovered).toHaveBeenCalledTimes(1)
        expect(notices.stuck).not.toHaveBeenCalled()
    })

    it("reports in the AI's words and fails the step with the trouble's code when the AI cannot produce the output: nothing is parked silently", async () => {
        const { steps, host, core, notices } = await buildSteps()
        host.run.mockRejectedValue(Object.assign(new Error("payment_refused"), { code: "payment_refused" }))
        core.decide.mockResolvedValue({
            kind: "report",
            reason: "Khoản chuyển dư 1.000đ.",
            question: "Nhận không?",
            suggestions: [
                { text: "Nhận khoản dư và ghi sổ", handledBy: "workflow" },
                { text: "Hoàn lại khách", handledBy: "person" },
            ],
            customerLine: "Dạ shop đang kiểm tra ạ.",
        })

        const answer = await steps.run(at("settle"))

        expect(answer).toEqual({ kind: "failed", code: "payment_refused" })
        expect(notices.stuck).toHaveBeenCalledWith(expect.objectContaining({ code: "payment_refused" }), {
            report: {
                reason: "Khoản chuyển dư 1.000đ.",
                question: "Nhận không?",
                suggestions: [
                    { text: "Nhận khoản dư và ghi sổ", handledBy: "workflow" },
                    { text: "Hoàn lại khách", handledBy: "person" },
                ],
            },
            customerLine: "Dạ shop đang kiểm tra ạ.",
            leadId: null,
            facts: expect.arrayContaining([
                ["workflow", "accounting"],
                ["step", "settle (payment.settle)"],
                ["code", "payment_refused"],
                ["run", "run-1"],
            ]),
        })
    })

    it("takes a business failure (no graph draws a branch for it) and the confusion of the node's own AI the same way", async () => {
        const { steps, host, core } = await buildSteps()
        core.decide.mockResolvedValue({
            kind: "report",
            reason: "x",
            question: null,
            suggestions: [],
            customerLine: null,
        })
        host.run.mockRejectedValueOnce(
            new NodeBusinessFailure({
                code: "not_paid",
                messageKey: "k",
                message: "amount_mismatch",
                fields: { orderId: "o-1" },
            }),
        )
        host.run.mockRejectedValueOnce(new NodeConfused({ reason: "Hai đơn cùng số tiền", question: "Đơn nào?" }))

        await expect(steps.run(at("settle"))).resolves.toEqual({ kind: "failed", code: "not_paid" })
        await expect(steps.run(at("settle"))).resolves.toEqual({ kind: "failed", code: "ai_confused" })

        expect(core.decide.mock.calls.map(([asked]) => asked.trouble)).toEqual([
            { kind: "failed", code: "not_paid", text: "amount_mismatch", data: { orderId: "o-1" } },
            { kind: "confused", code: "ai_confused", text: "Hai đơn cùng số tiền", data: { question: "Đơn nào?" } },
        ])
    })

    it("lets the engine speak only when the AI itself failed: the report carries no words of a model and no customer line", async () => {
        const { steps, host, core, notices } = await buildSteps()
        host.run.mockRejectedValue(new Error("boom"))
        core.decide.mockResolvedValue({ kind: "ai_failed", code: "ai_core_failed" })

        await expect(steps.run(at("evidence"))).resolves.toEqual({ kind: "failed", code: "handler_threw" })

        expect(notices.stuck).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ report: null, customerLine: null }),
        )
    })

    it("asks the AI core exactly once per try, and not at all for a step that completes", async () => {
        const { steps, host, core } = await buildSteps()
        host.run.mockResolvedValueOnce({ output: { names: ["A"] }, effects: [] })
        host.run.mockRejectedValueOnce(new Error("boom"))
        core.decide.mockResolvedValue({ kind: "ai_failed", code: "ai_core_failed" })

        await steps.run(at("evidence"))
        expect(core.decide).not.toHaveBeenCalled()
        await steps.run(at("evidence"))
        expect(core.decide).toHaveBeenCalledTimes(1)
    })
})
