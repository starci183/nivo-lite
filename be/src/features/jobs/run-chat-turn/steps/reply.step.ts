import { Injectable } from "@nestjs/common"
import { ChatTurnService } from "@modules/domain/conversations"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the customer message of the claimed job is answered on its channel, or the stored greeting is pushed. */
export class ReplyStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly chatTurns: ChatTurnService,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the turn, which repeats nothing on a redelivery. */
    async run(job: ClaimedJob): Promise<void> {
        const { jobId, fencingToken, payload } = job
        await this.claims.advance({ jobId, expectedFencingToken: fencingToken, step: "reply" })
        await this.chatTurns.runFromJob(payload)
    }
}
