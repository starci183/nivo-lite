import { Injectable } from "@nestjs/common"
import { ZaloWizardService } from "@modules/domain/channels"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the wizard step the owner asked for (seal the app keys, seal the OA Secret Key, or build the Zalo permission URL) is done and its result written. */
export class WizardStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly wizard: ZaloWizardService,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the wizard command of the payload. */
    async run(job: ClaimedJob): Promise<void> {
        const { payload } = job
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "wizard" })
        await this.wizard.run(payload)
    }
}
