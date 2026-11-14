import { AgentThreadsModule } from "./agent-threads.module"
import { ApprovalItemsService } from "./stops/approval-items.service"
import { RUN_STOP_STORE } from "./stops/run-stop-store.port"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import { TypeormRunStopStore } from "./stops/run-stop-store.typeorm"
import { RunStopsService } from "./stops/run-stops.service"
import { StopCardsService } from "./stops/stop-cards.service"
import { StopDoorService } from "./stops/stop-door.service"
import { StopHandBackService } from "./stops/stop-hand-back.service"
import { ThreadApprovalsService } from "./thread-approvals.service"
import { ThreadDeadlinesService } from "./thread-deadlines.service"
import { ThreadGraphsService } from "./thread-graphs.service"
import { ThreadResumeRequestsService } from "./thread-resume-requests.service"
import { ThreadRunsService } from "./thread-runs.service"
import { ThreadStepService } from "./thread-step.service"
import { ThreadSweepService } from "./thread-sweep.service"

describe("AgentThreadsModule records only (the mcp app: the open stops and the answer road on stores, no thread run)", () => {
    it("registers the stops' store, its records and the store-based answer road, with no deadline queue and nothing that drives a thread", () => {
        const module = AgentThreadsModule.registerRecords({})
        const providers = module.providers ?? []
        const answers = [
            ApprovalItemsService,
            StopCardsService,
            RunStopsService,
            ThreadApprovalsService,
            ThreadResumeRequestsService,
            StopDoorService,
            // R51 item 3: a hand-back ends the take-overs on the route through the resume door (stores only), in any app that hands back.
            StopHandBackService,
        ]

        expect(providers).toContain(TypeormRunStopStore)
        expect(providers).toContain(RunStopRecordsService)
        for (const answer of answers) expect(providers).toContain(answer)
        for (const engine of [ThreadRunsService, ThreadGraphsService, ThreadStepService, ThreadDeadlinesService, ThreadSweepService])
            expect(providers).not.toContain(engine)
        expect(module.imports ?? []).toEqual([])
        expect(module.exports).toEqual([RUN_STOP_STORE, RunStopRecordsService, ...answers])
    })
})
