import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { TELEGRAM, TelegramError, TelegramErrorCode } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { target } from "@tests/fixtures/builders/channel-delivery.builder"
import { TelegramPicturesService } from "./telegram-pictures.service"

const pics = [
    { url: "https://api/1.jpg", caption: "Basket\n2.000 VND" },
    { url: "https://api/2.jpg", caption: "Pot\n1.000 VND" },
]

const build = async () => {
    const telegram = mock<TelegramClient>()
    telegram.sendPhoto.mockResolvedValue(undefined)
    telegram.sendMediaGroup.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramPicturesService,
            { provide: TELEGRAM, useValue: telegram },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(TelegramPicturesService), telegram, logger }
}

describe("TelegramPicturesService", () => {
    it("sends the pictures as ONE album with a caption on each", async () => {
        const { service, telegram } = await build()

        await service.send(target(), "123:token", "555", pics)

        expect(telegram.sendMediaGroup.mock.calls).toEqual([
            [
                "123:token",
                "555",
                [
                    { url: "https://api/1.jpg", caption: "Basket\n2.000 VND" },
                    { url: "https://api/2.jpg", caption: "Pot\n1.000 VND" },
                ],
            ],
        ])
        expect(telegram.sendPhoto).not.toHaveBeenCalled()
    })

    it("sends one picture as a photo, not as an album", async () => {
        const { service, telegram } = await build()

        await service.send(target(), "123:token", "555", pics.slice(0, 1))

        expect(telegram.sendPhoto).toHaveBeenCalledWith("123:token", "555", "https://api/1.jpg", "Basket\n2.000 VND")
        expect(telegram.sendMediaGroup).not.toHaveBeenCalled()
    })

    it("sends nothing when the reply has no pictures", async () => {
        const { service, telegram } = await build()

        await service.send(target(), "123:token", "555", [])

        expect(telegram.sendMediaGroup).not.toHaveBeenCalled()
        expect(telegram.sendPhoto).not.toHaveBeenCalled()
    })

    it("sends at most ten pictures in the album", async () => {
        const { service, telegram } = await build()
        const twelve = Array.from({ length: 12 }, (_unused, index) => ({
            url: `https://api/${index}.jpg`,
            caption: "x",
        }))

        await service.send(target(), "123:token", "555", twelve)

        expect(telegram.sendMediaGroup.mock.calls[0]?.[2]).toHaveLength(10)
    })

    it("sends the photos one by one, skipping one Telegram refuses, when Telegram refuses the album", async () => {
        const { service, telegram, logger } = await build()
        const rejected = new TelegramError({ code: TelegramErrorCode.Rejected })
        telegram.sendMediaGroup.mockRejectedValue(rejected)
        telegram.sendPhoto.mockRejectedValueOnce(rejected)

        await expect(service.send(target(), "123:token", "555", pics)).resolves.toBeUndefined()

        expect(telegram.sendPhoto).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenCalledWith("channels.telegram.album-failed", {
            conversationId: "conv-1",
            failure: "TELEGRAM_REJECTED",
        })
    })
})
