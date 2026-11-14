import { mock } from "@starci/jest-preset"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { refusedToken } from "@tests/fixtures/builders/channel-delivery.builder"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { TelegramError, TelegramErrorCode } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import type { Logger } from "@modules/platform/logging"
import { ChannelsErrorCode } from "./errors/channels.error"
import type { CustomerSendPort } from "./customer-send-ports.contracts"
import { TelegramCustomerSendService } from "./telegram-customer-send.service"
import { TelegramPicturesService } from "./telegram-pictures.service"

const ACCOUNT = connectionRecord({ id: "c-1", workspaceId: "ws-1", provider: "telegram" })
const TARGET = { id: "route-1", workspaceId: "ws-1", channel: "telegram", externalId: "555", connectionId: "c-1" }
const REQUEST = { workspaceId: "ws-1", conversationId: "route-1", messageId: "m-1", text: "Hello", at: new Date(0) }

const build = () => {
    const secrets = mock<ConnectionSecretReadsService>()
    secrets.botToken.mockResolvedValue({ kind: "ok", value: "123:token" })
    const pictures = mock<TelegramPicturesService>()
    const telegram = mock<TelegramClient>()
    telegram.sendMessage.mockResolvedValue(undefined)
    telegram.sendTyping.mockResolvedValue(true)
    const logger = mock<Logger>()
    return { secrets, pictures, telegram, logger, service: new TelegramCustomerSendService(secrets, pictures, telegram, logger) }
}

describe("TelegramCustomerSendService (the live Telegram send behind the port)", () => {
    it("sends the text through the account's bot, then the pictures, and answers delivered", async () => {
        const { service, secrets, telegram, pictures } = build()
        const images = [{ url: "https://example.test/a.png", caption: "A" }]

        expect(service.provider).toBe("telegram")
        await expect(service.send(ACCOUNT, TARGET, "555", { ...REQUEST, images })).resolves.toEqual({ delivered: true, failure: null, outcome: "acknowledged" })

        expect(secrets.botToken).toHaveBeenCalledWith("ws-1", "c-1")
        expect(telegram.sendMessage).toHaveBeenCalledWith("123:token", "555", "Hello")
        expect(pictures.send).toHaveBeenCalledWith(TARGET, "123:token", "555", images)
    })

    it("refuses a person with no chat id and an account whose bot is gone, and sends nothing", async () => {
        const { service, secrets, telegram } = build()

        await expect(service.send(ACCOUNT, TARGET, null, REQUEST)).resolves.toEqual({ delivered: false, failure: null, outcome: "rejected" })
        secrets.botToken.mockResolvedValue(refusedToken)
        await expect(service.send(ACCOUNT, TARGET, "555", REQUEST)).resolves.toEqual({ delivered: false, failure: null, outcome: "rejected" })
        expect(telegram.sendMessage).not.toHaveBeenCalled()
    })

    it("answers Telegram's explicit refusal as a definite rejection and any other failure as an unknown outcome, logging both and sending no pictures", async () => {
        const { service, telegram, pictures, logger } = build()

        telegram.sendMessage.mockRejectedValueOnce(new TelegramError({ code: TelegramErrorCode.Rejected }))
        await expect(service.send(ACCOUNT, TARGET, "555", REQUEST)).resolves.toEqual({ delivered: false, failure: null, outcome: "rejected" })
        telegram.sendMessage.mockRejectedValueOnce(new Error("network"))
        await expect(service.send(ACCOUNT, TARGET, "555", REQUEST)).resolves.toEqual({ delivered: false, failure: null, outcome: "ambiguous" })

        expect(logger.error).toHaveBeenCalledTimes(2)
        expect(pictures.send).not.toHaveBeenCalled()
    })

    it("sends a staff text through the workspace's bot on the connection, and throws when the bot is gone", async () => {
        const { service, secrets, telegram } = build()
        const message = { workspaceId: "ws-1", connectionId: "c-1", provider: "telegram", recipientId: "777", text: "Shift" } as const

        await expect(service.sendToPerson(ACCOUNT, message)).resolves.toBeUndefined()
        expect(telegram.sendMessage).toHaveBeenCalledWith("123:token", "777", "Shift")

        secrets.botToken.mockResolvedValue(refusedToken)
        await expect(service.sendToPerson(ACCOUNT, message)).rejects.toMatchObject({ code: ChannelsErrorCode.ConnectionNotFound })
    })

    it("shows typing in the chat with the bot, and nothing when the bot is gone", async () => {
        const { service, secrets, telegram } = build()

        await service.showTyping(ACCOUNT, "555")
        expect(telegram.sendTyping).toHaveBeenCalledWith("123:token", "555")

        secrets.botToken.mockResolvedValue(refusedToken)
        await service.showTyping(ACCOUNT, "555")
        expect(telegram.sendTyping).toHaveBeenCalledTimes(1)
    })

    it("names nobody: Telegram has no name read", () => {
        const port: CustomerSendPort = build().service

        expect(port.nameOf).toBeUndefined()
    })
})
