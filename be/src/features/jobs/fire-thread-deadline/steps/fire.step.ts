import { Injectable } from "@nestjs/common"
import { ThreadDeadlinesService } from "@modules/domain/agent-threads"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { isThreadDeadlinePayload } from "@modules/queues/thread-deadline"

@Injectable()
/** The one effect of the job: the deadline of a stop came; the stop is answered `timeout` when it still stands as it was armed for. */
export class FireStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly deadlines: ThreadDeadlinesService,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops before any effect; a payload it cannot read does nothing. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "fire" })
        if (!isThreadDeadlinePayload(job.payload)) return
        await this.deadlines.fire(job.payload)
    }
}
