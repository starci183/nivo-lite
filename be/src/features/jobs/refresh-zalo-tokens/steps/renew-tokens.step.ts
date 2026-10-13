import { Injectable } from "@nestjs/common"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: every Zalo OA whose access token ends soon gets a new pair, which also keeps the 3-month refresh token rolling. */
export class RenewTokensStep implements JobStep {
    constructor(
        private readonly credentials: ZaloCredentialsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST; then renews the due connections, each under its own database lease. */
    async run(job: ClaimedJob): Promise<void> {
        const { jobId, fencingToken, payload } = job
        await this.claims.advance({ jobId, expectedFencingToken: fencingToken, step: "renew" })
        await this.credentials.refreshFromJob(payload)
    }
}
