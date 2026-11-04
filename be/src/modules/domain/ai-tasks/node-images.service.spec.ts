import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { REMOTE_FILES } from "@modules/integrations/remote-files"
import type { RemoteFileAnswer, RemoteFileRequest, RemoteFiles } from "@modules/integrations/remote-files"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IMAGE_MAX_BYTES, NodeImagesService } from "./node-images.service"

/** What the remote files client answers for a file: it keeps the bytes out when the status, the type or the size of the request refuse them. */
const served =
    (body: Uint8Array, type: string | null, status = 200) =>
    (request: RemoteFileRequest): RemoteFileAnswer => {
        const contentType = type ?? ""
        const kept =
            status === 200 && request.accepts(contentType) && body.length > 0 && body.length <= request.maxBytes
        return { status, contentType, location: undefined, length: body.length, bytes: kept ? Buffer.from(body) : null }
    }

const build = async () => {
    const logger = mock<Logger>()
    const files = mock<RemoteFiles>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeImagesService,
            { provide: REMOTE_FILES, useValue: files },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(NodeImagesService), files, logger }
}

describe("NodeImagesService", () => {
    it("inlines each picture as a data URL of its own type, in order", async () => {
        const { service, files, logger } = await build()
        files.read.mockImplementation((request) =>
            Promise.resolve(served(new Uint8Array([1, 2, 3]), "image/jpeg; charset=binary")(request)),
        )

        await expect(service.inline(["https://store.test/a", "https://store.test/b"])).resolves.toEqual({
            images: ["data:image/jpeg;base64,AQID", "data:image/jpeg;base64,AQID"],
            dropped: 0,
        })
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("leaves out what is unreadable, refused, no picture, empty or too large, and logs how many", async () => {
        const { service, files, logger } = await build()
        const answers = [
            served(new Uint8Array([1]), "image/png", 404),
            served(new Uint8Array([1]), "text/html"),
            served(new Uint8Array([1]), null),
            served(new Uint8Array([]), "image/png"),
            served(new Uint8Array(IMAGE_MAX_BYTES + 1), "image/png"),
            served(new Uint8Array([9]), "image/png"),
        ]
        files.read.mockRejectedValueOnce(new Error("timeout"))
        answers.forEach((answer) => files.read.mockImplementationOnce((request) => Promise.resolve(answer(request))))

        const inlined = await service.inline(["1", "2", "3", "4", "5", "6", "7"])

        expect(inlined).toEqual({ images: ["data:image/png;base64,CQ=="], dropped: 6 })
        expect(logger.warn).toHaveBeenCalledWith("ai_tasks.image_unreadable", { error: "Error" })
        expect(logger.warn).toHaveBeenCalledWith("ai_tasks.images_dropped", { dropped: 6, sent: 1 })
    })
})
