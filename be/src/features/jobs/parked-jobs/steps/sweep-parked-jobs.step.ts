import { Injectable } from "@nestjs/common"
import { InjectJobClaims, InjectParkedJobResumer } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep, ParkedJobResumerService } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the sweep: the parked jobs (every one, or those of another build when the boot asks) go back to their queue, keeping its recorded steps and effect keys. */
export class SweepParkedJobsStep implements JobStep {
    constructor(
        @InjectParkedJobResumer() private readonly resumer: ParkedJobResumerService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the held token first, so a stale worker stops before any effect. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "sweep" })
        await this.resumer.sweep(job.payload)
    }
}
