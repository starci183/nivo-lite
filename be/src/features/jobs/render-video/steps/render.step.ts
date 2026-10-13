import { Injectable } from "@nestjs/common"
import { VideoRenderService } from "@modules/domain/video"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the render the claimed job names is produced, uploaded and settled. */
export class RenderStep implements JobStep {
    constructor(
        private readonly video: VideoRenderService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then renders. A render that
     * is already done or failed is left as it is, so a repeated delivery changes nothing.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "render" })
        await this.video.render(job.payload)
    }
}
