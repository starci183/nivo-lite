import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IMAGE_MAX_BYTES, NodeImagesService } from "./node-images.service"

const answer = (body: Uint8Array, type: string | null, ok = true): Response =>
    ({
        ok,
        headers: { get: () => type },
        arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)),
    }) as unknown as Response

const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [NodeImagesService, { provide: LOGGER, useValue: logger }],
    }).compile()
    return { service: moduleRef.get(NodeImagesService), logger }
}

describe("NodeImagesService", () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch")
    afterEach(() => fetchSpy.mockReset())
    afterAll(() => fetchSpy.mockRestore())

    it("inlines each picture as a data URL of its own type, in order", async () => {
        fetchSpy.mockResolvedValue(answer(new Uint8Array([1, 2, 3]), "image/jpeg; charset=binary"))
        const { service, logger } = await build()

        await expect(service.inline(["https://store.test/a", "https://store.test/b"])).resolves.toEqual({
            images: ["data:image/jpeg;base64,AQID", "data:image/jpeg;base64,AQID"],
            dropped: 0,
        })
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("leaves out what is unreadable, refused, no picture, empty or too large, and logs how many", async () => {
        fetchSpy
            .mockRejectedValueOnce(new Error("timeout"))
            .mockResolvedValueOnce(answer(new Uint8Array([1]), "image/png", false))
            .mockResolvedValueOnce(answer(new Uint8Array([1]), "text/html"))
            .mockResolvedValueOnce(answer(new Uint8Array([1]), null))
            .mockResolvedValueOnce(answer(new Uint8Array([]), "image/png"))
            .mockResolvedValueOnce(answer(new Uint8Array(IMAGE_MAX_BYTES + 1), "image/png"))
            .mockResolvedValueOnce(answer(new Uint8Array([9]), "image/png"))
        const { service, logger } = await build()

        const inlined = await service.inline(["1", "2", "3", "4", "5", "6", "7"])

        expect(inlined).toEqual({ images: ["data:image/png;base64,CQ=="], dropped: 6 })
        expect(logger.warn).toHaveBeenCalledWith("ai_tasks.images_dropped", { dropped: 6, sent: 1 })
    })
})
