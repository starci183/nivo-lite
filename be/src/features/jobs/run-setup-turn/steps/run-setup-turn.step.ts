import { Injectable } from "@nestjs/common"
import { SetupTurnService } from "@modules/domain/modules"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: NIVO answers the owner message of the setup chat the payload names (one model call, the draft, the cards and the reply). */
export class RunSetupTurnStep implements JobStep {
    constructor(
        private readonly turns: SetupTurnService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then the turn runs once.
     * A turn answered already is recognised by its reply and left alone.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "answer" })
        await this.turns.run(job.payload)
    }
}
