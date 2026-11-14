import { refusedToken, target, zaloTarget } from "@tests/fixtures/builders/channel-delivery.builder"
import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { TELEGRAM } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { ZALO } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelDeliveryService } from "./channel-delivery.service"
import type { ChannelSenderRegistry } from "./channels.contracts"
import { CHANNEL_SENDER_REGISTRY } from "./channels.decorators"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ChannelPlanNoticeService } from "./channel-plan-notice.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"
import { TelegramPicturesService } from "./telegram-pictures.service"

const ACKNOWLEDGED = { delivered: true, outcome: "acknowledged", failure: null }
const AMBIGUOUS = { delivered: false, outcome: "ambiguous", failure: null }
const REJECTED = { delivered: false, outcome: "rejected", failure: null }

const build = async () => {
    const telegram = mock<TelegramClient>()
    telegram.sendMessage.mockResolvedValue(undefined)
    telegram.sendTyping.mockResolvedValue(true)
    const zalo = mock<ZaloClient>()
    const logger = mock<Logger>()
    const secrets = mock<ConnectionSecretReadsService>()
    const credentials = mock<ZaloCredentialsService>()
    const senders = mock<ChannelSenderRegistry>()
    const zaloDelivery = mock<ZaloDeliveryService>()
    const planNotice = mock<ChannelPlanNoticeService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelDeliveryService,
            { provide: TELEGRAM, useValue: telegram },
            { provide: ZALO, useValue: zalo },
            { provide: CHANNEL_SENDER_REGISTRY, useValue: senders },
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionSecretReadsService, useValue: secrets },
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ZaloDeliveryService, useValue: zaloDelivery },
            { provide: ChannelPlanNoticeService, useValue: planNotice },
            { provide: TelegramPicturesService, useValue: mock<TelegramPicturesService>() },
        ],
    }).compile()
    return {
        service: moduleRef.get(ChannelDeliveryService),
        telegram,
        zalo,
        logger,
        secrets,
        credentials,
        senders,
        zaloDelivery,
        planNotice,
        pictures: moduleRef.get(TelegramPicturesService),
    }
}

describe("ChannelDeliveryService sendToPerson", () => {
    const person = {
        workspaceId: "ws-1",
        connectionId: "c-1",
        recipientId: "555",
        text: "Shift starts",
    }

    it("sends a Telegram chat through the workspace bot", async () => {
        const { service, telegram, secrets } = await build()
        secrets.botToken.mockResolvedValue({ kind: "ok", value: "123:token" })

        await service.sendToPerson({ ...person, provider: "telegram" })

        expect(secrets.botToken).toHaveBeenCalledWith("ws-1", "c-1")
        expect(telegram.sendMessage).toHaveBeenCalledWith("123:token", "555", "Shift starts")
    })

    it("throws when the Telegram bot is gone", async () => {
        const { service, secrets } = await build()
        secrets.botToken.mockResolvedValue(refusedToken)

        await expect(service.sendToPerson({ ...person, provider: "telegram" })).rejects.toMatchObject({
            code: ChannelsErrorCode.ConnectionNotFound,
        })
    })

    it("sends a Zalo user through the OA without a conversation window", async () => {
        const { service, zaloDelivery } = await build()
        zaloDelivery.sendText.mockResolvedValue(undefined)

        await expect(
            service.sendToPerson({ ...person, provider: "zalo_oa", recipientId: "user-1" }),
        ).resolves.toBeUndefined()

        expect(zaloDelivery.sendText).toHaveBeenCalledWith("c-1", "user-1", "Shift starts")
    })
})

describe("ChannelDeliveryService showTyping", () => {
    it("shows typing in the Telegram chat of the conversation", async () => {
        const { service, telegram, secrets } = await build()
        secrets.botToken.mockResolvedValue({ kind: "ok", value: "123:token" })

        await service.showTyping(target())

        expect(telegram.sendTyping).toHaveBeenCalledWith("123:token", "555")
    })

    it("does nothing for another channel, a missing customer id or connection, or a bot that is gone", async () => {
        const { service, telegram, secrets } = await build()
        secrets.botToken.mockResolvedValue(refusedToken)

        await service.showTyping(target({ channel: "zalo" }))
        await service.showTyping(target({ externalId: null }))
        await service.showTyping(target({ connectionId: null }))
        await service.showTyping(target())

        expect(telegram.sendTyping).not.toHaveBeenCalled()
    })
})

describe("ChannelDeliveryService customerName", () => {
    it("asks Zalo for the display name of the customer", async () => {
        const { service, zalo, credentials } = await build()
        credentials.accessToken.mockResolvedValue("access-1")
        zalo.userDisplayName.mockResolvedValue("Minh")

        await expect(service.customerName(zaloTarget())).resolves.toBe("Minh")
        expect(zalo.userDisplayName).toHaveBeenCalledWith("access-1", "user-1")
    })

    it("is empty for another channel or a missing customer id or connection, and when the token cannot be had", async () => {
        const { service, credentials, logger } = await build()
        credentials.accessToken.mockRejectedValue(new Error("no tokens"))

        await expect(service.customerName(zaloTarget({ channel: "telegram" }))).resolves.toBe("")
        await expect(service.customerName(zaloTarget({ externalId: null }))).resolves.toBe("")
        await expect(service.customerName(zaloTarget({ connectionId: null }))).resolves.toBe("")
        await expect(service.customerName(zaloTarget())).resolves.toBe("")
        expect(logger.error).toHaveBeenCalledTimes(1)
    })
})

describe("ChannelDeliveryService.deliverToPerson", () => {
    const person = {
        workspaceId: "ws-1",
        routeId: "route-1",
        channel: "telegram",
        accountId: "c-1",
        userId: "555",
        sendKey: "run:1",
        text: "Hello",
    }

    it("sends to the person's identity and answers the receipt", async () => {
        const { service, telegram, secrets, planNotice } = await build()
        secrets.botToken.mockResolvedValue({ kind: "ok", value: "token-1" })

        await expect(service.deliverToPerson(person)).resolves.toEqual(ACKNOWLEDGED)

        expect(telegram.sendMessage).toHaveBeenCalledWith("token-1", "555", "Hello")
        expect(planNotice.recovered).toHaveBeenCalledWith(expect.objectContaining({ id: "route-1", connectionId: "c-1" }))
    })

    it("hands Zalo the route as the target, the person's id, and the caller's word that the window was judged", async () => {
        const { service, zaloDelivery } = await build()
        zaloDelivery.send.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged", via: "consultation" })

        await expect(service.deliverToPerson({ ...person, channel: "zalo", accountId: "z1", userId: "123", windowChecked: true })).resolves.toEqual({
            delivered: true,
            failure: null,
            outcome: "acknowledged",
            via: "consultation",
        })

        expect(zaloDelivery.send).toHaveBeenCalledWith(
            { id: "route-1", workspaceId: "ws-1", channel: "zalo", externalId: "123", connectionId: "z1" },
            "123",
            expect.objectContaining({ conversationId: "route-1", messageId: "run:1", windowChecked: true }),
        )
    })

    it("answers a plan refusal with the owner's notice, and a thrown channel as an unknown outcome, with no line written", async () => {
        const { service, zaloDelivery, planNotice, senders } = await build()
        zaloDelivery.send.mockResolvedValue({ delivered: false, failure: "channel_plan", outcome: "rejected" })
        await expect(service.deliverToPerson({ ...person, channel: "zalo", accountId: "z1" })).resolves.toMatchObject({ outcome: "rejected" })
        expect(planNotice.planBlocked).toHaveBeenCalled()

        senders.get.mockReturnValue({ channels: ["facebook"], send: jest.fn().mockRejectedValue(new Error("lost")) })
        await expect(service.deliverToPerson({ ...person, channel: "facebook" })).resolves.toEqual(AMBIGUOUS)
    })

    it("rethrows a busy Zalo token refresh for the caller to settle, marking nothing", async () => {
        const { service, zaloDelivery } = await build()
        zaloDelivery.send.mockRejectedValue(new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy }))

        await expect(service.deliverToPerson({ ...person, channel: "zalo", accountId: "z1" })).rejects.toMatchObject({
            code: ChannelsErrorCode.ZaloRefreshBusy,
        })
    })

    it("reads the website chat in the page: delivered with no push and no outage notice", async () => {
        const { service, planNotice, telegram } = await build()

        await expect(service.deliverToPerson({ ...person, channel: "website", accountId: "site-1" })).resolves.toEqual(ACKNOWLEDGED)
        expect(telegram.sendMessage).not.toHaveBeenCalled()
        expect(planNotice.recovered).not.toHaveBeenCalled()
    })
})

describe("ChannelDeliveryService.deliverToPerson channels", () => {
    const person = {
        workspaceId: "ws-1",
        routeId: "route-1",
        channel: "telegram",
        accountId: "c-1",
        userId: "555",
        sendKey: "line-1",
        text: "Hello",
    }

    it("hands the pictures to the picture sender once the text went out", async () => {
        const { service, secrets, pictures } = await build()
        secrets.botToken.mockResolvedValue({ kind: "ok", value: "token-1" })
        const images = [{ url: "https://example.test/a.png", caption: "A" }]

        await expect(service.deliverToPerson({ ...person, images })).resolves.toEqual(ACKNOWLEDGED)

        expect(pictures.send).toHaveBeenCalledWith(expect.objectContaining({ id: "route-1" }), "token-1", "555", images)
    })

    it("answers a rejection when no bot is connected, and an unknown outcome when Telegram fails without a verdict", async () => {
        const { service, secrets, telegram } = await build()
        secrets.botToken.mockResolvedValue(refusedToken)
        await expect(service.deliverToPerson(person)).resolves.toEqual(REJECTED)

        secrets.botToken.mockResolvedValue({ kind: "ok", value: "token-1" })
        telegram.sendMessage.mockRejectedValue(new Error("network"))
        await expect(service.deliverToPerson(person)).resolves.toEqual(AMBIGUOUS)
    })

    it("hands the text to the sender registered for another channel, and answers its refusal as unknown", async () => {
        const { service, senders } = await build()
        const send = jest.fn().mockResolvedValue(true)
        senders.get.mockReturnValue({ channels: ["facebook"], send })
        await expect(service.deliverToPerson({ ...person, channel: "facebook" })).resolves.toEqual(ACKNOWLEDGED)
        expect(send).toHaveBeenCalledWith(expect.objectContaining({ channel: "facebook", externalId: "555" }), "Hello")

        send.mockResolvedValue(false)
        await expect(service.deliverToPerson({ ...person, channel: "facebook" })).resolves.toEqual(AMBIGUOUS)
    })

    it("sends nothing for a channel that has no sender", async () => {
        const { service, telegram, senders } = await build()
        senders.get.mockReturnValue(undefined)
        await expect(service.deliverToPerson({ ...person, channel: "instagram" })).resolves.toEqual(REJECTED)
        expect(telegram.sendMessage).not.toHaveBeenCalled()
    })
})
