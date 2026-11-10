import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import { AgentGraphFreezeGateService, AgentGraphsService } from "@modules/domain/agent-graphs"
import { AgentRunRecoveryService, AgentRunsService } from "@modules/domain/agent-runs"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { stoppedRunOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { LeadFreezeRunsService } from "./lead-freeze-runs.service"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"

/** The retry a spec reads back from the run engine's double. */
type RetryCall = Parameters<AgentRunRecoveryService["retry"]>[0]

const HELD = {
    stepKey: "claim-ack",
    nodeKey: "claim-ack",
    kind: "graph_node",
    errorCode: "GRAPH_NODES_EXECUTOR_MISSING",
    input: {
        versionId: "v-1",
        nodeKey: "claim-ack",
        trigger: { conversationId: "c-1", text: "paid", messageIds: ["m-1"] },
    },
}

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "claim-ack", kind: "output", step: "payment.settle" }],
}

/** What the founder replied in the team chat to the report of the stuck step, oldest first. */
const ANSWERS = [
    { text: "Khach chuyen thieu 2k, cho qua", at: "2026-11-10T03:00:00.000Z" },
    { text: "Danh dau da tra giup anh", at: "2026-11-10T03:01:00.000Z" },
]

const build = async (withChat = false) => {
    const runs = mock<AgentRunsService>({
        runOf: jest
            .fn()
            .mockResolvedValue(
                runViewOf({ id: "run-1", agentId: "chatbot", status: "parked", context: { locale: "en" } }),
            ),
        advance: jest.fn().mockResolvedValue({ run: runViewOf({ status: "done" }), retryAfterMs: null }),
    })
    const recovery = mock<AgentRunRecoveryService>({
        failedStepOf: jest.fn().mockResolvedValue(HELD),
        keep: jest.fn().mockResolvedValue(true),
        retry: jest.fn().mockResolvedValue({ kind: "resumed", stepKey: "claim-ack", workspaceId: "ws-1" }),
        abandon: jest.fn().mockResolvedValue("abandoned"),
    })
    const graphs = mock<AgentGraphsService>({
        documentOf: jest.fn().mockResolvedValue({ nodes: [], rights: [], flow: FLOW }),
    })
    const index = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })
    const nodes = mock<GraphNodeRegistryService>({ installed: jest.fn().mockReturnValue(index) })
    const gate = mock<AgentGraphFreezeGateService>({
        isNodeStep: jest.fn((kind: string) => kind === "graph_node"),
        linesOf: jest.fn().mockResolvedValue([{ id: "m-2", text: "please check", at: "t", attachments: [] }]),
    })
    const logger = mock<Logger>()
    const chat = mock<TeamChatRoomsService>({ repliesToAgentLine: jest.fn().mockResolvedValue(ANSWERS) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeRunsService,
            ...(withChat ? [{ provide: TeamChatRoomsService, useValue: chat }] : []),
            { provide: LOGGER, useValue: logger },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentRunRecoveryService, useValue: recovery },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: AgentGraphFreezeGateService, useValue: gate },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezeRunsService), runs, recovery, graphs, gate, logger, chat }
}

/** The retry the run engine was asked for. */
const retryOf = (recovery: ReturnType<typeof mock<AgentRunRecoveryService>>, at = 0): RetryCall | undefined =>
    recovery.retry.mock.calls[at]?.[0]

describe("LeadFreezeRunsService reads", () => {
    it("reads the stopped run with the step it failed on, whether it is a node step, in the run's language", async () => {
        const { service, runs } = await build()
        await expect(service.stoppedOf("ws-1", "run-1")).resolves.toEqual({
            runId: "run-1",
            agentId: "chatbot",
            status: "parked",
            failed: { ...HELD, nodeStep: true },
            context: { locale: "en" },
            locale: "en",
        })
        await expect(service.statusOf("ws-1", "run-1")).resolves.toBe("parked")
        runs.runOf.mockResolvedValue(null)
        await expect(service.stoppedOf("ws-1", "run-x")).resolves.toBeNull()
        await expect(service.statusOf("ws-1", "run-x")).resolves.toBeNull()
    })

    it("reads the run a wake already opened, and none for a wake that opened none", async () => {
        const { service, runs } = await build()
        runs.runIdOfWake.mockResolvedValueOnce("run-7").mockResolvedValueOnce(null)
        await expect(service.runOfWake("ws-1", "wake-1")).resolves.toBe("run-7")
        await expect(service.runOfWake("ws-1", "wake-2")).resolves.toBeNull()
        expect(runs.runIdOfWake).toHaveBeenCalledWith("ws-1", "wake-1")
    })

    it("answers no failed step for a run that has none", async () => {
        const { service, recovery } = await build()
        recovery.failedStepOf.mockResolvedValue(null)
        await expect(service.stoppedOf("ws-1", "run-1")).resolves.toMatchObject({ failed: null })
    })

    it("titles the failed step by the installed node, in the owner's language, else by its key", async () => {
        const { service, graphs, logger } = await build()
        const run = stoppedRunOf({ locale: "en" })
        const failed = run.failed ?? undefined

        await expect(service.stepTitleOf("ws-1", run)).resolves.toBe("Mark paid")
        await expect(
            service.stepTitleOf("ws-1", { ...run, failed: failed === undefined ? null : { ...failed, input: {} } }),
        ).resolves.toBe("claim-ack")
        await expect(service.stepTitleOf("ws-1", { ...run, failed: null })).resolves.toBeNull()
        graphs.documentOf.mockRejectedValueOnce(new Error("gone"))
        await expect(service.stepTitleOf("ws-1", run)).resolves.toBe("claim-ack")
        expect(logger.warn).toHaveBeenCalledWith(LeadFreezesLogEvent.StepTitleUnread, {
            runId: "run-1",
            code: "unexpected",
        })
        graphs.documentOf.mockResolvedValueOnce({ nodes: [], rights: [], flow: { ...FLOW, nodes: [] } })
        await expect(service.stepTitleOf("ws-1", run)).resolves.toBe("claim-ack")
    })
})

describe("LeadFreezeRunsService writes", () => {
    it("keeps and abandons through the run engine's recovery", async () => {
        const { service, recovery } = await build()
        await expect(service.keep("ws-1", "run-1")).resolves.toBe(true)
        await expect(service.abandon("ws-1", "run-1", "owner-1")).resolves.toBe("abandoned")
        expect(recovery.abandon).toHaveBeenCalledWith("ws-1", "run-1", "owner-1")
    })

    it("retries from the failed step with the folded lines in its trigger and drives the run in place", async () => {
        const { service, recovery, runs, gate } = await build()

        await expect(service.retry("ws-1", "run-1", "owner-1", ["m-2"])).resolves.toEqual({
            resume: { kind: "resumed", stepKey: "claim-ack", workspaceId: "ws-1" },
            status: "done",
        })

        const request = retryOf(recovery)
        expect(request).toMatchObject({
            workspaceId: "ws-1",
            runId: "run-1",
            actor: "owner-1",
            reason: "lead-freeze retry",
        })
        await expect(request?.input?.(HELD.input)).resolves.toMatchObject({
            trigger: { text: "paid\nplease check", messageIds: ["m-1", "m-2"] },
        })
        expect(gate.linesOf).toHaveBeenCalledWith("ws-1", "c-1", ["m-2"])
        expect(runs.advance).toHaveBeenCalledWith("ws-1", "run-1", expect.any(AbortSignal))
    })

    it("hands the retried step what the founder replied to its report in the team chat, as founderAnswers of its trigger", async () => {
        const { service, recovery, chat } = await build(true)

        await service.retry("ws-1", "run-1", "owner-1", ["m-2"])

        await expect(retryOf(recovery)?.input?.(HELD.input)).resolves.toMatchObject({
            versionId: "v-1",
            trigger: {
                conversationId: "c-1",
                // The customer's lines are folded in first, the founder's answers ride beside them.
                text: "paid\nplease check",
                founderAnswers: ANSWERS,
            },
        })
        // The replies are read under the key the report of that run and step was posted with.
        expect(chat.repliesToAgentLine).toHaveBeenCalledWith("ws-1", "run-stuck:run-1:claim-ack")
    })

    it("leaves the trigger as it is when the founder replied nothing, when the step has no trigger, and in an app without the team chat", async () => {
        const { service, recovery, chat } = await build(true)
        chat.repliesToAgentLine.mockResolvedValueOnce([])
        await service.retry("ws-1", "run-1", "owner-1", [])

        await expect(retryOf(recovery)?.input?.(HELD.input)).resolves.toBe(HELD.input)
        await expect(retryOf(recovery)?.input?.({ trigger: [] })).resolves.toEqual({ trigger: [] })

        const bare = await build()
        await bare.service.retry("ws-1", "run-1", "owner-1", [])
        await expect(retryOf(bare.recovery)?.input?.(HELD.input)).resolves.toBe(HELD.input)
        expect(bare.chat.repliesToAgentLine).not.toHaveBeenCalled()
    })

    it("keeps the input when there is nothing to fold or the trigger names no conversation", async () => {
        const { service, recovery } = await build()
        await service.retry("ws-1", "run-1", "owner-1", [])
        await service.retry("ws-1", "run-1", "owner-1", ["m-2"])
        await expect(retryOf(recovery, 0)?.input?.(HELD.input)).resolves.toBe(HELD.input)
        await expect(retryOf(recovery, 1)?.input?.({ trigger: [] })).resolves.toEqual({ trigger: [] })
    })

    it("does not drive a run whose resume was refused, and answers where it stands", async () => {
        const { service, recovery, runs } = await build()
        recovery.retry.mockResolvedValueOnce({ kind: "outcome_unknown" })
        await expect(service.retry("ws-1", "run-1", "owner-1", [])).resolves.toEqual({
            resume: { kind: "outcome_unknown" },
            status: "parked",
        })
        expect(runs.advance).not.toHaveBeenCalled()
    })
})

describe("LeadFreezeRunsService: which failed step takes the customer's new lines", () => {
    it("folds the lines into a step that reads the customer's words, and not into one that never reads them", async () => {
        const { service, graphs } = await build()
        const reading: GraphSpec = {
            ...FLOW,
            nodes: [{ key: "claim-ack", kind: "output", step: "payment.settle", params: { body: { $ref: "trigger.text" } } }],
        }
        jest.mocked(graphs.documentOf).mockResolvedValueOnce({ nodes: [], rights: [], flow: reading })
        await expect(service.readsCustomerWords("ws-1", "run-1")).resolves.toBe(true)

        const outcome: GraphSpec = {
            ...FLOW,
            nodes: [{ key: "claim-ack", kind: "output", step: "core.outcome", params: { outcome: "won", outputs: {} } }],
        }
        jest.mocked(graphs.documentOf).mockResolvedValueOnce({ nodes: [], rights: [], flow: outcome })
        await expect(service.readsCustomerWords("ws-1", "run-1")).resolves.toBe(false)
    })

    it("folds nothing when the graph or the failed step cannot be read", async () => {
        const { service, graphs, recovery } = await build()
        jest.mocked(graphs.documentOf).mockResolvedValueOnce({ nodes: [], rights: [] })
        await expect(service.readsCustomerWords("ws-1", "run-1")).resolves.toBe(false)
        jest.mocked(recovery.failedStepOf).mockResolvedValueOnce(null)
        await expect(service.readsCustomerWords("ws-1", "run-1")).resolves.toBe(false)
    })
})
