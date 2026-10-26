import { Injectable } from "@nestjs/common"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { InjectRealtimeRetention } from "@modules/platform/realtime"
import type { RealtimeRetention } from "@modules/platform/realtime"

@Injectable()
/** The one effect of the job: the replay frames older than the replay window are deleted in bounded batches, each under the job fence; a repeated pass changes nothing more. */
export class SweepExpiredEventsStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        @InjectRealtimeRetention() private readonly retention: RealtimeRetention,
    ) {}

    /** Records the step with the token this worker holds before every batch, so a stale token stops before any effect. */
    async run(job: ClaimedJob): Promise<void> {
        await this.retention.sweep(() =>
            this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "sweep" }),
        )
    }
}
