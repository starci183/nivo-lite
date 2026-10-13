import { Injectable } from "@nestjs/common"
import { MetaInboxService, isMetaInboundJob } from "@modules/domain/meta-inbox"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: a direct message that reached a connected Page becomes a stored customer message and a chat turn. */
export class DeliverEventStep implements JobStep {
    constructor(
        private readonly inbox: MetaInboxService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then hands the event to its
     * conversation. The queue dedupes events by their Meta key, so a repeat never opens a second turn.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "deliver" })
        if (isMetaInboundJob(job.payload)) await this.inbox.deliver(job.payload)
    }
}
