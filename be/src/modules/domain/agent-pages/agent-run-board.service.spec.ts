import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import { AgentRunsLimitService, AgentRunsViewService } from "@modules/domain/agent-runs"
import { AiUsageEventsService } from "@modules/domain/ai-usage-events"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { CLOCK } from "@modules/platform/clock"
import { AgentRunBoardService } from "./agent-run-board.service"

const build = async (installation: { readonly agentId: string | null } | null) => {
    const access = mock<AgentWorkAccessService>({ managedInstallation: jest.fn().mockResolvedValue(installation) })
    const runs = mock<AgentRunsViewService>({ list: jest.fn().mockResolvedValue([]) })
    const graphs = mock<AgentGraphsService>({ versionsOf: jest.fn().mockResolvedValue([]) })
    const items = mock<WorkItemsViewsReadService>({ ofInstallation: jest.fn().mockResolvedValue([]) })
    const usage = mock<AiUsageEventsService>({ creditsByRun: jest.fn().mockResolvedValue(new Map()) })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunBoardService,
            { provide: CLOCK, useValue: new FakeClock(new Date("2026-11-11T02:00:00.000Z")) },
            { provide: AgentWorkAccessService, useValue: access },
            { provide: AgentRunsViewService, useValue: runs },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: WorkItemsViewsReadService, useValue: items },
            { provide: AiUsageEventsService, useValue: usage },
            { provide: AgentRunsLimitService, useValue: mock<AgentRunsLimitService>({ concurrency: 4 }) },
        ],
    }).compile()
    return { service: container.get(AgentRunBoardService), access, runs, items }
}

describe("AgentRunBoardService.board", () => {
    it("proves the seat first, then reads the runs, the versions and the work items of the instance once", async () => {
        const { service, access, runs, items } = await build({ agentId: "agent-1" })

        const board = await service.board("user-1", "ws-1", "inst-1")

        expect(access.managedInstallation).toHaveBeenCalledWith("user-1", "ws-1", "inst-1")
        expect(runs.list).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(items.ofInstallation).toHaveBeenCalledWith("ws-1", "inst-1", 100)
        expect(board).toMatchObject({ runs: [], concurrencyLimit: 4 })
    })

    it.each([[null], [{ agentId: null }]])("answers an empty board with the concurrency limit for the instance %j, reading no run", async (installation) => {
        const { service, runs } = await build(installation)

        await expect(service.board("user-1", "ws-1", "inst-1")).resolves.toEqual({
            runs: [],
            workflows: [],
            runningCount: 0,
            queuedCount: 0,
            concurrencyLimit: 4,
            activeCount: 0,
        })
        expect(runs.list).not.toHaveBeenCalled()
    })
})
