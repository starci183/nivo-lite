import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the render-video job (the durable queue name). */
export const VIDEO_RENDER_QUEUE = "video_render"

/** The payload of one render-video job: the render row to produce, ids only. */
export interface RenderVideoPayload {
    /** The `video_renders` row waiting to be rendered. */
    readonly renderId: string
    /** The workspace of the render: the queue limits how many renders of one workspace run at once. */
    readonly workspaceId: string
}

/** True when a job payload is the payload of a render-video job. */
export const isRenderVideoPayload = (value: unknown): value is RenderVideoPayload =>
    typeof value === "object" && value !== null && "renderId" in value && typeof value.renderId === "string"

@Injectable()
/** The typed producer of the video-render queue: the one way a render-video job starts. */
export class VideoRenderQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the render of a new `video_renders` row in the caller's transaction: the job exists exactly when the row commits. */
    enqueueRenderVideo(payload: RenderVideoPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, VIDEO_RENDER_QUEUE, payload, {
            dedupeKey: `${VIDEO_RENDER_QUEUE}:${payload.renderId}`,
        })
    }
}
