import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { AgentConversationsErrorCode } from "@modules/domain/agent-conversations"
import { AgentMessagesErrorCode } from "@modules/domain/agent-messages"
import { ConnectionSecretsErrorCode } from "@modules/domain/connection-secrets"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { TELEGRAM } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { ZALO, ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelDeliveryService } from "./channel-delivery.service"
import type { ChannelSenderRegistry } from "./channels.contracts"
import { CHANNEL_SENDER_REGISTRY } from "./channels.decorators"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"

const NOW = Date.parse("2026-10-12T10:00:00.000Z")
const HOUR = 3_600_000

const target = (patch: Partial<ConversationTarget> = {}): ConversationTarget => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "555:1730000000",
    connectionId: "c-1",
    ...patch,
})

const refusedToken = { kind: "refused" as const, code: ConnectionSecretsErrorCode.NotFound }

const build = async (found: ConversationTarget | null = target(), lastCustomerAt: number | null = null) => {
    const conversations = mock<AgentConversationsService>()
    conversations.targetOf.mockResolvedValue(
        found === null ? { kind: "refused", code: AgentConversationsErrorCode.NotFound } : { kind: "ok", value: found },
    )
    const messages = mock<AgentMessagesService>()
    messages.markDelivery.mockResolvedValue(undefined)
    messages.lastCustomerAt.mockResolvedValue(
        lastCustomerAt === null
            ? { kind: "refused", code: AgentMessagesErrorCode.NotFound }
            : { kind: "ok", value: new Date(lastCustomerAt) },
    )
    const telegram = mock<TelegramClient>()
    telegram.sendMessage.mockResolvedValue(undefined)
    telegram.sendTyping.mockResolvedValue(true)
    const zalo = mock<ZaloClient>()
    zalo.sendCsText.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const secrets = mock<ConnectionSecretsService>()
    const credentials = mock<ZaloCredentialsService>()
    const senders = mock<ChannelSenderRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelDeliveryService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: TELEGRAM, useValue: telegram },
            { provide: ZALO, useValue: zalo },
            { provide: CHANNEL_SENDER_REGISTRY, useValue: senders },
            { provide: LOGGER, useValue: logger },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: ZaloCredentialsService, useValue: credentials },
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
    }
}

const request = { conversationId: "conv-1", messageId: "msg-1", text: "Hello" }
const zaloTarget = (patch: Partial<ConversationTarget> = {}) =>
    target({ channel: "zalo", externalId: "user-1", ...patch })

describe("ChannelDeliveryService", () => {
    it("reports no delivery for a conversation that does not exist, and marks nothing", async () => {
        const { service, messages } = await build(null)

        await expect(service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })
        expect(messages.markDelivery).not.toHaveBeenCalled()
    })

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

        it("sends nothing for a website conversation or a Telegram one without an external id", async () => {
            const website = await build(target({ channel: "website" }))
            const anonymous = await build(target({ externalId: null }))

            await expect(website.service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })
            await expect(anonymous.service.deliver(request)).resolves.toEqual({ delivered: false, failure: null })
            expect(website.telegram.sendMessage).not.toHaveBeenCalled()
            expect(anonymous.telegram.sendMessage).not.toHaveBeenCalled()
        })
    })

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

    describe("zalo", () => {
        const inside = NOW - 2 * HOUR

        it("sends a consultation text inside the free window and marks the message sent", async () => {
            const { service, zalo, credentials, messages } = await build(zaloTarget(), inside)
            credentials.accessToken.mockResolvedValue("access-1")

            await expect(service.deliver(request)).resolves.toEqual({ delivered: true, failure: null })

            expect(zalo.sendCsText).toHaveBeenCalledWith("access-1", "user-1", "Hello")
            expect(messages.markDelivery).toHaveBeenCalledWith("msg-1", true, undefined)
        })

        it("sends when the customer has not written yet", async () => {
            const { service, credentials } = await build(zaloTarget(), null)
            credentials.accessToken.mockResolvedValue("access-1")

            await expect(service.deliver(request)).resolves.toEqual({ delivered: true, failure: null })
        })

        it("refuses outside the 48-hour window without calling Zalo, and writes the reason on the message", async () => {
            const { service, zalo, messages } = await build(zaloTarget(), NOW - 49 * HOUR)

            await expect(service.deliver(request)).resolves.toEqual({
                delivered: false,
                failure: "zalo_window_expired",
            })

            expect(zalo.sendCsText).not.toHaveBeenCalled()
            expect(messages.markDelivery).toHaveBeenCalledWith("msg-1", false, "zalo_window_expired")
        })

        it("says not connected when the conversation has no connection or no customer id", async () => {
            const none = await build(zaloTarget({ connectionId: null }))
            const anonymous = await build(zaloTarget({ externalId: null }))

            await expect(none.service.deliver(request)).resolves.toEqual({
                delivered: false,
                failure: "zalo_not_connected",
            })
            await expect(anonymous.service.deliver(request)).resolves.toEqual({
                delivered: false,
                failure: "zalo_not_connected",
            })
        })

        it("renews the token once when Zalo rejects it and sends again with the new one", async () => {
            const { service, zalo, credentials } = await build(zaloTarget(), inside)
            credentials.accessToken.mockResolvedValueOnce("access-1")
            credentials.accessToken.mockResolvedValueOnce("access-2")
            zalo.sendCsText.mockRejectedValueOnce(
                new ZaloError({
                    code: ZaloErrorCode.Rejected,
                    params: { path: "/v3.0/oa/message/cs", reason: "x", zaloCode: -216 },
                }),
            )

            await expect(service.deliver(request)).resolves.toEqual({ delivered: true, failure: null })

            expect(credentials.accessToken).toHaveBeenNthCalledWith(2, "c-1", { stale: "access-1" })
            expect(zalo.sendCsText).toHaveBeenLastCalledWith("access-2", "user-1", "Hello")
        })

        it("classifies any other refusal for the workbench and logs it", async () => {
            const { service, zalo, credentials, logger } = await build(zaloTarget(), inside)
            credentials.accessToken.mockResolvedValue("access-1")
            zalo.sendCsText.mockRejectedValue(
                new ZaloError({
                    code: ZaloErrorCode.Rejected,
                    params: { path: "/v3.0/oa/message/cs", reason: "x", zaloCode: -213 },
                }),
            )

            await expect(service.deliver(request)).resolves.toEqual({ delivered: false, failure: "zalo_unfollowed" })
            expect(logger.error).toHaveBeenCalledWith("channels.delivery.failed", expect.anything(), {
                conversationId: "conv-1",
                channel: "zalo",
            })
        })

        it("lets the caller retry when another worker is renewing the token", async () => {
            const { service, credentials } = await build(zaloTarget(), inside)
            const busy = new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy })
            credentials.accessToken.mockRejectedValue(busy)

            await expect(service.deliver(request)).rejects.toBe(busy)
        })

        it("treats a connection that is gone as a failure of the generic kind", async () => {
            const { service, credentials } = await build(zaloTarget(), inside)
            credentials.accessToken.mockRejectedValue(new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound }))

            await expect(service.deliver(request)).resolves.toEqual({ delivered: false, failure: "zalo_error" })
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
