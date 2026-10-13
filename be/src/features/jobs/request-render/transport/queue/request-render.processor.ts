import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { RENDER_REQUEST_QUEUE } from "@modules/queues/render-request"
import { RequestRenderStep } from "../../steps/request-render.step"

@Injectable()
/** The processor of the request-render job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class RequestRenderProcessor extends FencedProcessor {
    readonly queue = RENDER_REQUEST_QUEUE

    constructor(private readonly request: RequestRenderStep) {
        super()
    }

    /** Queues the render; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.request.run(job)
    }

    /** The job ended as failed: the command is settled as failed so the asker is told. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.request.abandon(delivery.payload)
    }
}
