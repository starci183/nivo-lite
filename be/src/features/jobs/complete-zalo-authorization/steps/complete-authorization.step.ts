import { Injectable } from "@nestjs/common"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { ZaloInboxPollService } from "@modules/domain/zalo-inbox"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
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
        private readonly inboxPoll: ZaloInboxPollService,
    ) {}

    /** Records the step with the token this worker holds FIRST; then completes the authorization the payload names. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "complete" })
        await this.credentials.completeFromJob(job.payload)
        // The connection is ready now: read back the messages that reached the webhook before it could take them. A refused authorization leaves no token, so that run skips it.
        if (isZaloAuthorizationPayload(job.payload)) {
            await this.inboxPoll.requestReconcile(job.payload.workspaceId, job.payload.state.split(".")[0] ?? "")
        }
    }
}
