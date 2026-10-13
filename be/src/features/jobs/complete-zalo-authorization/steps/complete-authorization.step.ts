import { Injectable } from "@nestjs/common"
import { ChannelsError, ZALO_AUTHORIZATION_FAILED_REASON, ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import { isZaloRefusal } from "@modules/integrations/zalo"
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
        private readonly credentials: ZaloCredentialsService,
        private readonly connections: ConnectionsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST; then completes the authorization the payload names. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "complete" })
        if (!isZaloAuthorizationPayload(job.payload)) return
        const { workspaceId, state, code, oaId } = job.payload
        await this.credentials.completeAuthorization(workspaceId, { state, code, ...(oaId === null ? {} : { oaId }) }).catch(async (cause: unknown) => {
            if (!(cause instanceof ChannelsError) && !isZaloRefusal(cause)) throw cause
            await this.connections.markFailing(state.split(".")[0] ?? "", ZALO_AUTHORIZATION_FAILED_REASON)
        })
    }
}
