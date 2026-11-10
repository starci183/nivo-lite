import { mock } from "@starci/jest-preset"
import type { AgentGraphDecisionsService, AgentGraphsService } from "@modules/domain/agent-graphs"
import type { AgentRunsViewService, RunDetail } from "@modules/domain/agent-runs"
import type { AgentWorkAccessService } from "@modules/domain/agent-work"
import type { AiUsageEventsService, RunCallKindUsage } from "@modules/domain/ai-usage-events"
import type { InstallationRecordsService } from "@modules/domain/module-installations"
import type { WorkItemsViewsReadService } from "@modules/domain/work-items"
import type { Clock } from "@modules/platform/clock"
import type { Logger } from "@modules/platform/logging"
import { ReadAgentRunHandler } from "./read-agent-run.handler"
import { ReadAgentRunQuery } from "./read-agent-run.query"

/** A finished run of one step that waits on nothing. */
const doneRun = (): RunDetail =>
    ({
        run: {
            id: "run-1",
            workspaceId: "ws-1",
            agentId: "agent-1",
            trigger: "tag",
            graphVersionId: null,
            status: "done",
            context: { conversationId: "c-1" },
            errorCode: null,
            endedAt: new Date("2026-11-11T01:00:05.000Z"),
            startedAt: new Date("2026-11-11T01:00:00.000Z"),
            stepSeq: 1,
            cancelledAt: null,
            cancelledBy: null,
        },
        steps: [
            {
                stepKey: "match",
                nodeKey: "match",
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
                durationMs: null,
                errorCode: null,
            },
        ],
    }) as unknown as RunDetail

const MATCH: RunCallKindUsage = {
    purpose: "accounting.match-payment:agent",
    calls: 2,
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

const build = (found: RunDetail | null = doneRun()) => {
    const usage = mock<AiUsageEventsService>({
        creditsByRun: jest.fn().mockResolvedValue(new Map()),
        callKindsByRun: jest.fn().mockResolvedValue([MATCH]),
    })
    const handler = new ReadAgentRunHandler(
        mock<Logger>(),
        mock<Clock>({ now: jest.fn().mockReturnValue(new Date("2026-11-11T02:00:00.000Z")) }),
        mock<AgentWorkAccessService>({ manager: jest.fn().mockResolvedValue("member-1") }),
        mock<InstallationRecordsService>({ find: jest.fn().mockResolvedValue({ agentId: "agent-1" }) }),
        mock<AgentRunsViewService>({ detail: jest.fn().mockResolvedValue(found) }),
        mock<AgentGraphsService>({ versionsOf: jest.fn().mockResolvedValue([]) }),
        mock<WorkItemsViewsReadService>({ find: jest.fn().mockResolvedValue(null) }),
        usage,
        mock<AgentGraphDecisionsService>(),
    )
    return { handler, usage }
}

const query = (): ReadAgentRunQuery =>
    new ReadAgentRunQuery({
        request: { workspaceId: "ws-1", installationId: "inst-1", runId: "run-1" },
        principal: { id: "user-1" } as never,
    })

describe("ReadAgentRunHandler", () => {
    it("answers the run's model calls per call kind, read for this workspace and run", async () => {
        const { handler, usage } = build()

        const detail = await handler.execute(query())

        expect(detail?.aiCalls).toEqual([MATCH])
        expect(usage.callKindsByRun).toHaveBeenCalledWith("ws-1", "run-1")
    })

    it("reads no calls for a run the agent does not have", async () => {
        const { handler, usage } = build(null)

        await expect(handler.execute(query())).resolves.toBeNull()
        expect(usage.callKindsByRun).not.toHaveBeenCalled()
    })
})
