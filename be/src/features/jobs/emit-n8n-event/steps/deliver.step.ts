import { Injectable } from "@nestjs/common"
import { N8nRunsService } from "@modules/domain/n8n-runs"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the signed delivery of one run to its workflows. */
export class EmitN8nEventStep implements JobStep {
    constructor(
        private readonly runs: N8nRunsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then delivers the run (a delivery that cannot reach n8n marks the run failed in the domain). */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "deliver" })
        await this.runs.deliver(job.payload)
    }
}
