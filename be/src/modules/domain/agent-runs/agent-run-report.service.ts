import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { POST_REPORT_JOB } from "@nivo-lite/blocks-core/modules"
import { ModuleJobsQueue } from "@modules/queues/module-jobs"
import type { RunRecord } from "./agent-runs-records.contracts"

@Injectable()
/**
 * The report of a run that ended. The declared job that posts it is written in the transaction of the run's final status, so the report
 * exists exactly when the status does; the run id is the dedupe key, so a replay of the settling writes one delivery.
 */
export class AgentRunReportService {
    constructor(private readonly jobs: ModuleJobsQueue) {}

    /** Writes the delivery of the run's report in `manager`, the transaction that wrote the final status. */
    ended(manager: EntityManager, workspaceId: string, run: RunRecord): Promise<void> {
        return this.jobs.enqueue(
            {
                workspaceId,
                job: POST_REPORT_JOB,
                input: { runId: run.id, agentId: run.agentId, trigger: run.trigger },
            },
            manager,
            { dedupeKey: `${POST_REPORT_JOB}:${run.id}` },
        )
    }
}
