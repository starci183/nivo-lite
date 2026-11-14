import { Injectable } from "@nestjs/common"
import { ZaloConnectService, ZaloCredentialsService } from "@modules/domain/channels"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"
import { isZaloAuthorizationPayload } from "@modules/queues/zalo-authorization"

@Injectable()
/**
 * The one effect of the job: the authorization Zalo returned the browser with is exchanged for tokens and stored. The one-time code cannot be tried
 * twice, so a state or a code that is refused marks the connection failing for the owner to see and ends the job; any other failure is retried.
 */
export class CompleteAuthorizationStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly credentials: ZaloCredentialsService,
        private readonly connect: ZaloConnectService,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST; then completes the authorization the payload names, then starts reading
     * the OA's display name in the background (best effort: it never fails, retries or delays the job).
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "complete" })
        await this.credentials.completeFromJob(job.payload)
        if (isZaloAuthorizationPayload(job.payload)) {
            this.connect.rememberOaNameLater(job.payload.state.split(".")[0] ?? "")
        }
    }
}
