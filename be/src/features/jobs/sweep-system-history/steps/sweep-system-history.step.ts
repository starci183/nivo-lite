import { Injectable } from "@nestjs/common"
import { JobHistoryRetentionService } from "@modules/domain/job-ops"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: finished queue, cron and http history older than its window is deleted in bounded batches, each under the job fence. */
export class SweepSystemHistoryStep implements JobStep {
    constructor(
        private readonly retention: JobHistoryRetentionService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds before every batch, so a stale token stops before any effect. */
    async run(job: ClaimedJob): Promise<void> {
        await this.retention.sweep(job.payload, () =>
            this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "sweep" }),
        )
    }
}
