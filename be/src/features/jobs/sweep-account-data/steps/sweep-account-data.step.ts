import { Injectable } from "@nestjs/common"
import { AccountDataRetentionService } from "@modules/domain/account-data"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/**
 * The one effect of the job: the rows of `account_data` past the retention their type declares (processed rows only, for a type that
 * wakes a consumer) and the rows past their type's time to live are deleted in bounded batches, each under the job fence; a type
 * declared `keep` loses no row to retention.
 */
export class SweepAccountDataStep implements JobStep {
    constructor(
        private readonly retention: AccountDataRetentionService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds before every batch, so a stale token stops before any effect. */
    async run(job: ClaimedJob): Promise<void> {
        await this.retention.sweep(job.payload, () =>
            this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "sweep" }),
        )
    }
}
