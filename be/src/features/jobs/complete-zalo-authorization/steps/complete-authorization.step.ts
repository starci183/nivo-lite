import { Injectable } from "@nestjs/common"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/**
 * The one effect of the job: the authorization Zalo returned the browser with is exchanged for tokens and stored. The one-time code cannot be tried
 * twice, so a state or a code that is refused marks the connection failing for the owner to see and ends the job; any other failure is retried.
 */
export class CompleteAuthorizationStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly credentials: ZaloCredentialsService,
    ) {}

    /** Records the step with the token this worker holds FIRST; then completes the authorization the payload names. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "complete" })
        return this.credentials.completeFromJob(job.payload)
    }
}
