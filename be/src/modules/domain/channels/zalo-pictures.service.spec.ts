import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelCollageService } from "./channel-collage.service"
import { ZaloPicturesService } from "./zalo-pictures.service"

const COLLAGE_URL = "https://api/api/public/collages/k"

const target: ChatConversationTarget = {
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "zalo",
    externalId: "user-1",
    connectionId: "c-1",
}

const refusal = new ZaloError({
    code: ZaloErrorCode.Rejected,
    params: { path: "/v3.0/oa/message/cs", reason: "no", zaloCode: -201 },
})

const pics = (count: number) =>
    Array.from({ length: count }, (_unused, index) => ({
        url: `https://api/${index + 1}.jpg`,
        caption: `Item ${index + 1}\n${(index + 1) * 1000} VND`,
    }))

/** The service with a collage store that answers `url` (null: it cannot build one) and can or cannot build at all. */
const build = async (url: string | null, canBuild = true) => {
    const collage = mock<ChannelCollageService>()
    collage.canBuild.mockReturnValue(canBuild)
    collage.urlOf.mockResolvedValue(url)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloPicturesService,
            { provide: LOGGER, useValue: logger },
            { provide: ChannelCollageService, useValue: collage },
        ],
    }).compile()
    const sendOne = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined)
    return { service: moduleRef.get(ZaloPicturesService), collage, logger, sendOne }
}

const sentOf = (sendOne: jest.Mock<Promise<void>, [string]>): ReadonlyArray<string> =>
    sendOne.mock.calls.map((call) => call[0])

describe("ZaloPicturesService collage", () => {
    it("sends several pictures as ONE collage image", async () => {
        const { service, sendOne, collage } = await build(COLLAGE_URL)

        await service.send(target, pics(5), sendOne)

        expect(collage.urlOf).toHaveBeenCalledWith(pics(5))
        expect(sentOf(sendOne)).toEqual([COLLAGE_URL])
    })

    it("sends a single picture as itself and never builds a collage for it", async () => {
        const { service, sendOne, collage } = await build(COLLAGE_URL)

        await service.send(target, pics(1), sendOne)

        expect(collage.urlOf).not.toHaveBeenCalled()
        expect(sentOf(sendOne)).toEqual(["https://api/1.jpg"])
    })

    it("sends the pictures beyond the six of the collage one by one after it", async () => {
        const { service, sendOne } = await build(COLLAGE_URL)

        await service.send(target, pics(8), sendOne)

        expect(sentOf(sendOne)).toEqual([COLLAGE_URL, "https://api/7.jpg", "https://api/8.jpg"])
    })
})

describe("ZaloPicturesService fallback", () => {
    it("sends the pictures one by one, in order, when the API has no public address to serve a collage from", async () => {
        const { service, sendOne, collage } = await build(COLLAGE_URL, false)

        await service.send(target, pics(3), sendOne)

        expect(collage.urlOf).not.toHaveBeenCalled()
        expect(sentOf(sendOne)).toEqual(["https://api/1.jpg", "https://api/2.jpg", "https://api/3.jpg"])
    })

    it("sends the pictures one by one when the collage cannot be built", async () => {
        const { service, sendOne } = await build(null)

        await service.send(target, pics(3), sendOne)

        expect(sentOf(sendOne)).toEqual(["https://api/1.jpg", "https://api/2.jpg", "https://api/3.jpg"])
    })

    it("sends the pictures one by one, and logs, when Zalo refuses the collage", async () => {
        const { service, sendOne, logger } = await build(COLLAGE_URL)
        sendOne.mockRejectedValueOnce(refusal)

        await service.send(target, pics(2), sendOne)

        expect(logger.warn).toHaveBeenCalledWith("channels.zalo.collage-refused", {
            conversationId: "conv-1",
            failure: "zalo_error",
        })
        expect(sentOf(sendOne)).toEqual([COLLAGE_URL, "https://api/1.jpg", "https://api/2.jpg"])
    })

    it("stops at the first picture Zalo refuses and only logs it", async () => {
        const { service, sendOne, logger } = await build(null, false)
        sendOne.mockRejectedValue(refusal)

        await expect(service.send(target, pics(2), sendOne)).resolves.toBeUndefined()

        expect(sendOne).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith("channels.zalo.image-failed", {
            conversationId: "conv-1",
            failure: "zalo_error",
        })
    })
})
