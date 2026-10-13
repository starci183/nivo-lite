import { Injectable } from "@nestjs/common"
import { ChatTurnService } from "@modules/domain/conversations"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { isChatTurnPayload } from "@modules/queues/chat-turn"

@Injectable()
/** The one effect of the job: the customer message of the claimed job is answered on its channel, or the stored greeting is pushed. */
export class ReplyStep implements JobStep {
    constructor(
        private readonly chatTurns: ChatTurnService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the turn, which repeats nothing on a redelivery. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "reply" })
        if (isChatTurnPayload(job.payload)) await this.chatTurns.run(job.payload)
    }
}
