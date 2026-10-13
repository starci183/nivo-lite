import { Injectable } from "@nestjs/common"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { isZaloRefreshPayload } from "@modules/queues/zalo-refresh"

/** Seven hours: a token that ends within this time is renewed when the tick carries no horizon of its own. */
const DEFAULT_WITHIN_MS = 7 * 3_600_000

@Injectable()
/** The one effect of the job: every Zalo OA whose access token ends soon gets a new pair, which also keeps the 3-month refresh token rolling. */
export class RenewTokensStep implements JobStep {
    constructor(
        private readonly credentials: ZaloCredentialsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST; then renews the due connections, each under its own database lease. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "renew" })
        await this.credentials.refreshDue(isZaloRefreshPayload(job.payload) ? job.payload.withinMs : DEFAULT_WITHIN_MS)
    }
}
