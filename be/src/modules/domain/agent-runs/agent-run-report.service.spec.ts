import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { ModuleJobsQueue } from "@modules/queues/module-jobs"
import { runRecordOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunReportService } from "./agent-run-report.service"

describe("AgentRunReportService", () => {
    it("writes the declared report job in the given transaction, keyed by the run so a replay is one delivery", async () => {
        const jobs = mock<ModuleJobsQueue>()
        jobs.enqueue.mockResolvedValue()
        const moduleRef = await Test.createTestingModule({
            providers: [AgentRunReportService, { provide: ModuleJobsQueue, useValue: jobs }],
        }).compile()
        const manager = mockEntityManager()
        const done = runRecordOf({ status: "done" })

        await expect(moduleRef.get(AgentRunReportService).ended(manager, "ws-1", done)).resolves.toBeUndefined()

        expect(jobs.enqueue).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                job: "platform.post-report",
                input: { runId: done.id, agentId: done.agentId, trigger: done.trigger },
            },
            manager,
            { dedupeKey: `platform.post-report:${done.id}` },
        )
    })
})
