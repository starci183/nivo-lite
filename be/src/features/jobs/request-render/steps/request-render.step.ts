import { Injectable } from "@nestjs/common"
import { AppCommandsService } from "@modules/domain/app-commands"
import { VideoService } from "@modules/domain/video/video.service"
import { DomainError } from "@modules/platform/errors"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { renderRequestPayloadOf } from "@modules/queues/render-request"

@Injectable()
/** The one effect of the job: the render the web app asked for is opened and its render-video job queued, and the asker finds the answer on the command row. */
export class RequestRenderStep implements JobStep {
    constructor(
        private readonly commands: AppCommandsService,
        private readonly video: VideoService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then asks the video capability to
     * queue the render as the person who asked. A refusal of the domain (project not found, busy, an invalid spec, a seat that may not render)
     * settles the command as failed with its code and ends the job; any other failure is thrown so the queue retries the delivery. A command
     * already settled is left as it is.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "request" })
        const payload = renderRequestPayloadOf(job.payload)
        if (payload === null) return
        const command = await this.commands.begin(payload.commandId)
        if (command === null) return
        const projectId = typeof command.input.projectId === "string" ? command.input.projectId : ""
        try {
            const queued = await this.video.requestRender(command.requestedBy, projectId)
            await this.commands.succeed(command.id, { renderId: queued.renderId, projectId: queued.projectId })
        } catch (cause) {
            if (!(cause instanceof DomainError)) throw cause
            await this.commands.fail(command.id, cause.code)
        }
    }

    /** Settles the command of a job that ran out of attempts, so the asker stops waiting. */
    async abandon(payload: object): Promise<void> {
        const named = renderRequestPayloadOf(payload)
        if (named !== null) await this.commands.fail(named.commandId, "unavailable")
    }
}
