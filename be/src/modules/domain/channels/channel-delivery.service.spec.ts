import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { AgentConversationsErrorCode } from "@modules/domain/agent-conversations"
import { ConnectionSecretsErrorCode } from "@modules/domain/connection-secrets"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { TELEGRAM } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { ZALO } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelDeliveryService } from "./channel-delivery.service"
import type { ChannelSenderRegistry, DeliveryRequest } from "./channels.contracts"
import { CHANNEL_SENDER_REGISTRY } from "./channels.decorators"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"

const target = (patch: Partial<ConversationTarget> = {}): ConversationTarget => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "555:1730000000",
    connectionId: "c-1",
    ...patch,
})

const refusedToken = { kind: "refused" as const, code: ConnectionSecretsErrorCode.NotFound }

const build = async (found: ConversationTarget | null = target()) => {
    const conversations = mock<AgentConversationsService>()
    conversations.targetOf.mockResolvedValue(
        found === null ? { kind: "refused", code: AgentConversationsErrorCode.NotFound } : { kind: "ok", value: found },
    )
    const messages = mock<AgentMessagesService>()
    messages.markDelivery.mockResolvedValue(undefined)
    const telegram = mock<TelegramClient>()
    telegram.sendMessage.mockResolvedValue(undefined)
    telegram.sendTyping.mockResolvedValue(true)
    const zalo = mock<ZaloClient>()
    const logger = mock<Logger>()
    const secrets = mock<ConnectionSecretReadsService>()
    const credentials = mock<ZaloCredentialsService>()
    const senders = mock<ChannelSenderRegistry>()
    const zaloDelivery = mock<ZaloDeliveryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelDeliveryService,
            { provide: TELEGRAM, useValue: telegram },
            { provide: ZALO, useValue: zalo },
            { provide: CHANNEL_SENDER_REGISTRY, useValue: senders },
            { provide: LOGGER, useValue: logger },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ConnectionSecretReadsService, useValue: secrets },
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ZaloDeliveryService, useValue: zaloDelivery },
        ],
    }).compile()
    return {
        service: moduleRef.get(ChannelDeliveryService),
        messages,
        telegram,
        zalo,
        logger,
        secrets,
        credentials,
        senders,
        zaloDelivery,
    }
}

const request: DeliveryRequest = { conversationId: "conv-1", messageId: "msg-1", text: "Hello" }
const zaloTarget = (patch: Partial<ConversationTarget> = {}) =>
    target({ channel: "zalo", externalId: "user-1", ...patch })

describe("ChannelDeliveryService", () => {
    it("reports no delivery for a conversation that does not exist, and marks nothing", async () => {
        const { service, messages } = await build(null)

        await expect(service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })
        expect(messages.markDelivery).not.toHaveBeenCalled()
    })

    describe("telegram", () => {
        it.each([
            { label: "plain", externalId: "555", recipient: "555" },
            { label: "archive with extra separator", externalId: "555:archive:extra", recipient: "555" },
            {
                label: "long incomplete final line",
                externalId: "555:" + ":".repeat(20_000) + "\n",
                recipient: "555:" + ":".repeat(20_000) + "\n",
            },
            { label: "archived final line", externalId: "prefix\n555:archive", recipient: "prefix\n555" },
        ])("preserves the channel recipient for $label", async ({ externalId, recipient }) => {
            const { service, telegram, secrets } = await build(target({ externalId }))
            secrets.botToken.mockResolvedValue({ kind: "ok", value: "123:token" })
            await service.deliver(request)
            expect(telegram.sendMessage).toHaveBeenCalledWith("123:token", recipient, "Hello")
        })
    })
})

describe("ChannelDeliveryService", () => {
    describe("telegram", () => {
        it("sends to the chat of the conversation, ignoring the archive suffix, and marks the message sent", async () => {
            const { service, messages, telegram, secrets } = await build()
            secrets.botToken.mockResolvedValue({ kind: "ok", value: "123:token" })

            await expect(service.deliver(request)).resolves.toEqual({ delivered: true, failure: null })

            expect(secrets.botToken).toHaveBeenCalledWith("ws-1", "c-1")
            expect(telegram.sendMessage).toHaveBeenCalledWith("123:token", "555", "Hello")
            expect(messages.markDelivery).toHaveBeenCalledWith("msg-1", true, undefined)
        })

        it("fails and records the verdict when no bot is connected or when Telegram refuses", async () => {
            const gone = await build()
            gone.secrets.botToken.mockResolvedValue(refusedToken)
            const refused = await build()
            refused.secrets.botToken.mockResolvedValue({ kind: "ok", value: "123:token" })
            refused.telegram.sendMessage.mockRejectedValue(new Error("chat not found"))

            await expect(gone.service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })
            await expect(refused.service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })

            expect(gone.messages.markDelivery).toHaveBeenCalledWith("msg-1", false, undefined)
            expect(gone.logger.error).toHaveBeenCalledTimes(1)
            expect(refused.logger.error).toHaveBeenCalledTimes(1)
        })

        it("fails without a lookup when the conversation has no connection", async () => {
            const { service, secrets } = await build(target({ connectionId: null }))

            await expect(service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })
            expect(secrets.botToken).not.toHaveBeenCalled()
        })

        it(
            "counts a website conversation as delivered on the page and sends nothing for a Telegram one " +
                "without an external id",
            async () => {
                const website = await build(target({ channel: "website" }))
                const anonymous = await build(target({ externalId: null }))

                await expect(website.service.deliver(request)).resolves.toEqual({ delivered: true, failure: null })
                await expect(anonymous.service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })
                expect(website.telegram.sendMessage).not.toHaveBeenCalled()
                expect(anonymous.telegram.sendMessage).not.toHaveBeenCalled()
                expect(website.messages.markDelivery).toHaveBeenCalledWith("msg-1", true, undefined)
                expect(anonymous.messages.markDelivery).toHaveBeenCalledWith("msg-1", false, undefined)
            },
        )
    })

    it("sends nothing for a channel that has no sender", async () => {
        const { service, telegram, senders } = await build(target({ channel: "sms" }))

        await expect(service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })
        expect(senders.get).toHaveBeenCalledWith("sms")
        expect(telegram.sendMessage).not.toHaveBeenCalled()
    })
})

describe("ChannelDeliveryService", () => {
    describe("other channels", () => {
        it("hands the reply to the sender registered for the channel", async () => {
            const { service, senders } = await build(target({ channel: "facebook" }))
            const send = jest.fn().mockResolvedValue(true)
            senders.get.mockReturnValue({ channels: ["facebook"], send })

            await expect(service.deliver(request)).resolves.toEqual({ delivered: true, failure: null })

            expect(send).toHaveBeenCalledWith(target({ channel: "facebook" }), "Hello")
        })

        it("reports a refusal of the registered sender", async () => {
            const { service, senders, messages } = await build(target({ channel: "facebook" }))
            senders.get.mockReturnValue({ channels: ["facebook"], send: () => Promise.resolve(false) })

            await expect(service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })
            expect(messages.markDelivery).toHaveBeenCalledWith("msg-1", false, undefined)
        })
    })
})

describe("ChannelDeliveryService", () => {
    describe("zalo", () => {
        it("hands the reply to the Zalo route with the customer's id and writes its verdict on the message", async () => {
            const { service, zaloDelivery, messages } = await build(zaloTarget({ externalId: "user-1:1730000000" }))
            zaloDelivery.send.mockResolvedValue({
                delivered: false,
                failure: "zalo_window_expired",
                note: "zns_no_phone",
            })

            await expect(service.deliver(request)).resolves.toEqual({
                delivered: false,
                failure: "zalo_window_expired",
                note: "zns_no_phone",
            })

            expect(zaloDelivery.send).toHaveBeenCalledWith(
                zaloTarget({ externalId: "user-1:1730000000" }),
                "user-1",
                request,
            )
            expect(messages.markDelivery).toHaveBeenCalledWith("msg-1", false, "zalo_window_expired")
        })

        it("hands no customer id when the conversation has none, and marks a delivery sent", async () => {
            const { service, zaloDelivery, messages } = await build(zaloTarget({ externalId: null }))
            zaloDelivery.send.mockResolvedValue({ delivered: true, failure: null, via: "zns" })

            await expect(service.deliver(request)).resolves.toEqual({ delivered: true, failure: null, via: "zns" })

            expect(zaloDelivery.send).toHaveBeenCalledWith(zaloTarget({ externalId: null }), null, request)
            expect(messages.markDelivery).toHaveBeenCalledWith("msg-1", true, undefined)
        })

        it("lets the caller retry when another worker is renewing the token", async () => {
            const { service, zaloDelivery, messages } = await build(zaloTarget())
            const busy = new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy })
            zaloDelivery.send.mockRejectedValue(busy)

            await expect(service.deliver(request)).rejects.toBe(busy)
            expect(messages.markDelivery).not.toHaveBeenCalled()
        })
    })
})

describe("ChannelDeliveryService", () => {
    describe("sendToPerson", () => {
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

    describe("showTyping", () => {
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
})

describe("ChannelDeliveryService", () => {
    describe("customerName", () => {
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
})
