import { Injectable } from "@nestjs/common"
import { ConnectionHealthService } from "@modules/domain/channels"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { isConnectionHealthPayload } from "@modules/queues/connection-health"

@Injectable()
/** The one effect of the job: every connection that is set up is judged and a changed verdict is recorded on it. */
export class JudgeConnectionsStep implements JobStep {
    constructor(
        private readonly health: ConnectionHealthService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST; then judges, which writes a verdict only when it changed. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "judge" })
        if (isConnectionHealthPayload(job.payload)) await this.health.checkAll(job.payload.silentAfterHours)
        else await this.health.checkAll()
    }
}
