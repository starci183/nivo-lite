import { Injectable } from "@nestjs/common"
import { DataSyncService } from "@modules/domain/data-hub"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { isDataSyncPayload, isDataSyncTickPayload } from "@modules/queues/data-sync"

@Injectable()
/** The one effect of the job: a scheduler tick queues the due syncs, and a sync job reads the owner's system into the hub and settles its run. */
export class RunDataSyncStep implements JobStep {
    constructor(
        private readonly sync: DataSyncService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the tick or the sync.
     * A failed sync is settled on its run, not thrown, so the queue does not repeat a sync the owner already reads as failed.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "sync" })
        if (isDataSyncTickPayload(job.payload)) await this.sync.queueDue()
        else if (isDataSyncPayload(job.payload)) await this.sync.run(job.payload)
    }

    /** Settles the run of a job that ran out of attempts, so the owner stops waiting. */
    async abandon(payload: object): Promise<void> {
        if (isDataSyncPayload(payload)) await this.sync.abandon(payload.runId)
    }
}
