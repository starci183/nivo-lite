import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { VIDEO_RENDER_QUEUE } from "@modules/queues/video-render"
import { RenderStep } from "../../steps/render.step"

@Injectable()
/** The processor of the render-video job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class RenderVideoProcessor extends FencedProcessor {
    readonly queue = VIDEO_RENDER_QUEUE

    constructor(private readonly render: RenderStep) {
        super()
    }

    /** Renders the video; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.render.run(job)
    }
}
