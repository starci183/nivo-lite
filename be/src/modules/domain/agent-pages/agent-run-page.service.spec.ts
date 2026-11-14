import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentRunsViewService, type RunDetail } from "@modules/domain/agent-runs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { AiUsageEventsService, type RunCallKindUsage } from "@modules/domain/ai-usage-events"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { CLOCK } from "@modules/platform/clock"
import { runRecordOf } from "@tests/fixtures/builders/agent-runs.builder"
import { MATCH_PAYMENT_LABEL_VI } from "@tests/fixtures/i18n/agent-work-spec.messages"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import { AgentRunPageService } from "./agent-run-page.service"

/** A finished run of one step that waits on nothing. */
const doneRun = (): RunDetail => ({
    run: runRecordOf({
        trigger: "tag",
        graphVersionId: null,
        status: "done",
        context: { conversationId: "c-1" },
        endedAt: new Date("2026-11-11T01:00:05.000Z"),
        startedAt: new Date("2026-11-11T01:00:00.000Z"),
        stepSeq: 1,
    }),
    steps: [
        {
            stepKey: "match",
            nodeKey: "match",
            kind: "graph_node",
            ordinal: 1,
            status: "done",
            waitItemId: null,
            workItemId: null,
            input: {},
            result: {},
            calls: [],
            attempt: 1,
            maxAttempts: 3,
            startedAt: null,
            endedAt: null,
            durationMs: null,
            errorCode: null,
        },
    ],
})

const MATCH: RunCallKindUsage = {
    stepKey: "match",
    purpose: "sales.payment-short:agent",
    calls: 2,
    tries: 3,
    failedTries: 1,
    cacheWriteTokens: 0,
    failedPromptTokens: 8_000,
    failedCostUsd: 0.016,
    failures: ["timeout"],
    workKinds: ["node"],
    credits: 10.884956,
    failedCredits: 14.159292,
    maxTry: 2,
    promptTokens: 16_000,
    cachedTokens: 8_064,
    completionTokens: 900,
    reasoningTokens: 600,
    durationMs: 14_000,
    slowestMs: 9_000,
    costUsd: 0.0123,
    upstreams: ["parasail"],
    finishReasons: ["stop"],
    models: ["deepseek/deepseek-v3.2"],
    declaredModels: ["auto"],
    modelProviders: ["openrouter"],
    modelReasons: ["auto:weight"],
}

const build = async (found: RunDetail | null = doneRun()) => {
    const usage = mock<AiUsageEventsService>({
        creditsByRun: jest.fn().mockResolvedValue(new Map()),
        callKindsByRun: jest.fn().mockResolvedValue([MATCH]),
    })
    const callLog = mock<ToolCallLogService>({
        truthReadsOfRun: jest.fn().mockResolvedValue([
            {
                id: "l1",
                tool: "nivo.tool.brain.search",
                at: new Date("2026-11-11T01:59:00.000Z"),
                facts: [{ factId: "f-ship", version: 2 }],
            },
        ]),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunPageService,
            { provide: CLOCK, useValue: new FakeClock(new Date("2026-11-11T02:00:00.000Z")) },
            {
                provide: AgentWorkAccessService,
                useValue: mock<AgentWorkAccessService>({
                    managedInstallation: jest.fn().mockResolvedValue({ agentId: "agent-1" }),
                }),
            },
            { provide: AgentRunsViewService, useValue: mock<AgentRunsViewService>({ detail: jest.fn().mockResolvedValue(found) }) },
            { provide: AgentGraphsService, useValue: mock<AgentGraphsService>({ versionsOf: jest.fn().mockResolvedValue([]) }) },
            {
                provide: WorkItemsViewsReadService,
                useValue: mock<WorkItemsViewsReadService>({ find: jest.fn().mockResolvedValue(null) }),
            },
            { provide: AiUsageEventsService, useValue: usage },
            { provide: ToolCallLogService, useValue: callLog },
        ],
    }).compile()
    const service = container.get(AgentRunPageService)
    const handler = { page: () => service.page("user-1", "ws-1", "inst-1", "run-1", undefined) }
    return { handler, usage, callLog }
}

describe("AgentRunPageService.page", () => {
    it("answers what the run's agents read of the truth graph: each Brain read with the truths and versions it served", async () => {
        const { handler, callLog } = await build()

        const detail = await handler.page()

        expect(detail?.truthReads).toEqual([
            { tool: "nivo.tool.brain.search", at: "2026-11-11T01:59:00.000Z", facts: [{ factId: "f-ship", version: 2 }] },
        ])
        expect(callLog.truthReadsOfRun).toHaveBeenCalledWith("ws-1", "run-1", 100)
    })

    it("answers the run's model calls per call kind, read for this workspace and run", async () => {
        const { handler, usage } = await build()

        const detail = await handler.page()

        // ENG1: each kind carries blocks-core's words for it (the step's title), never the raw kind.
        expect(detail?.aiCalls).toEqual([{ ...MATCH, label: MATCH_PAYMENT_LABEL_VI }])
        expect(usage.callKindsByRun).toHaveBeenCalledWith("ws-1", "run-1")
    })

    it("answers the run's totals: exact USD and credits as fractions, the failed tries apart", async () => {
        const { handler } = await build()

        const detail = await handler.page()

        expect(detail?.aiTotals).toEqual({
            calls: 2,
            tries: 3,
            failedTries: 1,
            promptTokens: 16_000,
            cachedTokens: 8_064,
            cacheWriteTokens: 0,
            completionTokens: 900,
            reasoningTokens: 600,
            costUsd: 0.0123,
            credits: 10.884956,
            failedCostUsd: 0.016,
            failedCredits: 14.159292,
        })
    })

    it("reads no calls for a run the agent does not have", async () => {
        const { handler, usage } = await build(null)

        await expect(handler.page()).resolves.toBeNull()
        expect(usage.callKindsByRun).not.toHaveBeenCalled()
    })
})
