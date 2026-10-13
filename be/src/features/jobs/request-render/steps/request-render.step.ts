import { Injectable } from "@nestjs/common"
import { VideoRenderCommandsService } from "@modules/domain/video"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the render the web app asked for is opened and its render-video job queued, and the asker finds the answer on the command row. */
export class RequestRenderStep implements JobStep {
    constructor(
        private readonly commands: VideoRenderCommandsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Settles the command of a job that ran out of attempts, so the asker stops waiting. */
    async abandon(payload: object): Promise<void> {
        await this.commands.abandon(payload)
    }

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then asks the video capability to
     * queue the render as the person who asked (a refusal of the domain settles the command as failed, any other failure is thrown so the
     * queue retries the delivery).
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "request" })
        await this.commands.run(job.payload)
    }
}
