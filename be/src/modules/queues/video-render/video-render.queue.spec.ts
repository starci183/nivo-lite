import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { VIDEO_RENDER_QUEUE, VideoRenderQueue, isRenderVideoPayload } from "./video-render.queue"

const payload = { renderId: "render-1", workspaceId: "ws-1" }

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [VideoRenderQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(VideoRenderQueue), outbox }
}

describe("VideoRenderQueue", () => {
    it("writes the render keyed on the row", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueRenderVideo(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, VIDEO_RENDER_QUEUE, payload, {
            dedupeKey: "video_render:render-1",
        })
    })
})

describe("isRenderVideoPayload", () => {
    it("accepts a render id and refuses a payload without one", () => {
        expect(isRenderVideoPayload(payload)).toBe(true)
        expect(isRenderVideoPayload({ renderId: "render-1" })).toBe(true)
        expect(isRenderVideoPayload(null)).toBe(false)
        expect(isRenderVideoPayload("render-1")).toBe(false)
        expect(isRenderVideoPayload({ workspaceId: "ws-1" })).toBe(false)
        expect(isRenderVideoPayload({ renderId: 1 })).toBe(false)
    })
})
