import { Injectable } from "@nestjs/common"
import { ContentService } from "@modules/domain/content"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { contentTickPayloadOf } from "@modules/queues/content-tick"

@Injectable()
/** The one effect of the job: the content automations that are due run for the workspaces of the tick. */
export class RunAutomationsStep implements JobStep {
    constructor(
        private readonly content: ContentService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the automations. Every
     * automation keeps a mark per day or week, so a repeated tick changes nothing twice.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "run" })
        await this.content.runTick(contentTickPayloadOf(job.payload))
    }
}
