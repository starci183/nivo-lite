import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ChannelTarget } from "./channels.contracts"
import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ZaloPicturesService } from "./zalo-pictures.service"

const target: ChannelTarget = {
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
        caption: `Item ${index + 1}
${(index + 1) * 1000} VND`,
    }))

const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloPicturesService, { provide: LOGGER, useValue: logger }],
    }).compile()
    const sendOne = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined)
    return { service: moduleRef.get(ZaloPicturesService), logger, sendOne }
}

const sentOf = (sendOne: jest.Mock<Promise<void>, [string]>): ReadonlyArray<string> =>
    sendOne.mock.calls.map((call) => call[0])

describe("ZaloPicturesService", () => {
    it("sends the pictures one by one, in order", async () => {
        const { service, sendOne } = await build()

        await service.send(target, pics(3), sendOne)

        expect(sentOf(sendOne)).toEqual(["https://api/1.jpg", "https://api/2.jpg", "https://api/3.jpg"])
    })

    it("stops at the first picture Zalo refuses and only logs it", async () => {
        const { service, sendOne, logger } = await build()
        sendOne.mockRejectedValue(refusal)

        await expect(service.send(target, pics(2), sendOne)).resolves.toBeUndefined()

        expect(sendOne).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith("channels.zalo.image-failed", {
            conversationId: "conv-1",
            failure: "zalo_error",
        })
    })
})
