import { refusedToken, target, zaloTarget } from "@tests/fixtures/builders/channel-delivery.builder"
import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { ConnectionSecretReadsService, ConnectionsService, type ConnectionRecord, type Provider } from "@modules/domain/connections"
import { ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { TelegramClient } from "@modules/integrations/telegram"
import type { ZaloClient } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelDeliveryService } from "./channel-delivery.service"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { CustomerSendRegistryService } from "./customer-send-registry.service"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloCustomerSendService } from "./zalo-customer-send.service"
import { TelegramCustomerSendService } from "./telegram-customer-send.service"
import { ChannelPlanNoticeService } from "./channel-plan-notice.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"
import { TelegramPicturesService } from "./telegram-pictures.service"

const ACKNOWLEDGED = { delivered: true, outcome: "acknowledged", failure: null }
const AMBIGUOUS = { delivered: false, outcome: "ambiguous", failure: null }
const REJECTED = { delivered: false, outcome: "rejected", failure: null }

const NOW = new Date("2026-11-14T10:00:00.000Z")

/** The provider of each account id the specs use: the Zalo OA `z1`, the Meta Page `m1`, every other id a Telegram bot. */
const PROVIDER_OF: Readonly<Record<string, Provider>> = { z1: "zalo_oa", m1: "meta" }

/** An account of the specs: its provider follows its id, live unless `sandbox`. */
const accountOf = (id: string, sandbox = false): ConnectionRecord => connectionRecord({ id, provider: PROVIDER_OF[id] ?? "telegram", sandbox })

/** A port double of one provider: every member a bare `jest.fn`, so a spec can prove which implementation was reached. */
const portDouble = (provider: string) => ({
    provider,
    send: jest.fn(),
    sendToPerson: jest.fn().mockResolvedValue(undefined),
    nameOf: jest.fn().mockResolvedValue(""),
    showTyping: jest.fn().mockResolvedValue(undefined),
})

const build = async () => {
    const telegram = mock<TelegramClient>()
    telegram.sendMessage.mockResolvedValue(undefined)
    telegram.sendTyping.mockResolvedValue(true)
    const zalo = mock<ZaloClient>()
    const logger = mock<Logger>()
    const secrets = mock<ConnectionSecretReadsService>()
    const credentials = mock<ZaloCredentialsService>()
    const zaloDelivery = mock<ZaloDeliveryService>()
    const planNotice = mock<ChannelPlanNoticeService>()
    const pictures = mock<TelegramPicturesService>()
    const connections = mock<ConnectionsService>()
    connections.find.mockImplementation((_workspaceId, id) => Promise.resolve(accountOf(id)))
    const sandboxSend = portDouble("zalo_oa")
    const sandboxTelegram = portDouble("telegram")
    const liveMeta = portDouble("meta")
    const sandboxMeta = portDouble("meta")
    const customerSends = new CustomerSendRegistryService()
    customerSends.register({ live: new ZaloCustomerSendService(zaloDelivery, credentials, zalo), sandbox: sandboxSend })
    customerSends.register({ live: new TelegramCustomerSendService(secrets, pictures, telegram, logger), sandbox: sandboxTelegram })
    customerSends.register({ live: liveMeta, sandbox: sandboxMeta })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelDeliveryService,
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(NOW.getTime()) },
            { provide: ConnectionsService, useValue: connections },
            { provide: CustomerSendRegistryService, useValue: customerSends },
            { provide: ChannelPlanNoticeService, useValue: planNotice },
        ],
    }).compile()
    return {
        service: moduleRef.get(ChannelDeliveryService),
        telegram,
        zalo,
        logger,
        secrets,
        credentials,
        zaloDelivery,
        planNotice,
        connections,
        sandboxSend,
        sandboxTelegram,
        liveMeta,
        sandboxMeta,
        pictures,
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
            service.sendToPerson({ ...person, connectionId: "z1", provider: "zalo_oa", recipientId: "user-1" }),
        ).resolves.toBeUndefined()

        expect(zaloDelivery.sendText).toHaveBeenCalledWith("z1", "user-1", "Shift starts")
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

        await expect(service.customerName(zaloTarget({ connectionId: "z1" }))).resolves.toBe("Minh")
        expect(zalo.userDisplayName).toHaveBeenCalledWith("access-1", "user-1")
    })

    it("is empty for another channel or a missing customer id or connection, and when the token cannot be had", async () => {
        const { service, credentials, logger } = await build()
        credentials.accessToken.mockRejectedValue(new Error("no tokens"))

        await expect(service.customerName(zaloTarget({ channel: "telegram" }))).resolves.toBe("")
        await expect(service.customerName(zaloTarget({ externalId: null, connectionId: "z1" }))).resolves.toBe("")
        await expect(service.customerName(zaloTarget({ connectionId: null }))).resolves.toBe("")
        await expect(service.customerName(zaloTarget({ connectionId: "z1" }))).resolves.toBe("")
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

    it("sends a live Zalo account through the live route, never the sandbox port", async () => {
        const { service, zaloDelivery, sandboxSend, connections } = await build()
        zaloDelivery.send.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged", via: "consultation" })

        await service.deliverToPerson({ ...person, channel: "zalo", accountId: "z1", userId: "123" })

        expect(connections.find).toHaveBeenCalledWith("ws-1", "z1")
        expect(zaloDelivery.send).toHaveBeenCalledTimes(1)
        expect(sandboxSend.send).not.toHaveBeenCalled()
    })

    it("sends a sandbox Zalo account through the sandbox port with the caller's moment, and never touches the Zalo route or client", async () => {
        const { service, zaloDelivery, sandboxSend, connections, zalo, credentials } = await build()
        const account = connectionRecord({ id: "z1", provider: "zalo_oa", sandbox: true })
        connections.find.mockResolvedValue(account)
        sandboxSend.send.mockResolvedValue({ delivered: false, failure: "zalo_window_expired", outcome: "rejected" })

        await expect(
            service.deliverToPerson({ ...person, channel: "zalo", accountId: "z1", userId: "123" }),
        ).resolves.toEqual({ delivered: false, failure: "zalo_window_expired", outcome: "rejected" })

        expect(sandboxSend.send).toHaveBeenCalledWith(
            account,
            { id: "route-1", workspaceId: "ws-1", channel: "zalo", externalId: "123", connectionId: "z1" },
            "123",
            expect.objectContaining({ conversationId: "route-1", messageId: "run:1", at: NOW }),
        )
        expect(zaloDelivery.send).not.toHaveBeenCalled()
        expect(credentials.accessToken).not.toHaveBeenCalled()
        expect(zalo.sendCsText).not.toHaveBeenCalled()
    })

    it("never falls back to the live route when a sandbox Zalo account has no sandbox port", async () => {
        const { service, zaloDelivery, connections, logger } = await build()
        const bare = new CustomerSendRegistryService()
        bare.register(new ZaloCustomerSendService(zaloDelivery, mock<ZaloCredentialsService>(), mock<ZaloClient>()))
        Reflect.set(service, "customerSends", bare)
        connections.find.mockResolvedValue(connectionRecord({ id: "z1", provider: "zalo_oa", sandbox: true }))

        await expect(service.deliverToPerson({ ...person, channel: "zalo", accountId: "z1" })).resolves.toEqual({
            delivered: false,
            failure: null,
            outcome: "ambiguous",
        })
        expect(zaloDelivery.send).not.toHaveBeenCalled()
        expect(logger.error).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ code: ProviderRegistryErrorCode.SandboxMissing }),
            expect.anything(),
        )
    })

    it("answers not connected for a Zalo send whose connection is gone or that has no connection", async () => {
        const { service, zaloDelivery, connections } = await build()
        connections.find.mockResolvedValue(null)

        await expect(service.deliverToPerson({ ...person, channel: "zalo", accountId: "z1" })).resolves.toMatchObject({
            delivered: false,
            failure: "zalo_not_connected",
            outcome: "rejected",
        })
        await expect(service.deliverToPerson({ ...person, channel: "zalo", accountId: null })).resolves.toMatchObject({
            failure: "zalo_not_connected",
        })
        expect(zaloDelivery.send).not.toHaveBeenCalled()
    })

    it("answers a plan refusal with the owner's notice, and a thrown channel as an unknown outcome, with no line written", async () => {
        const { service, zaloDelivery, planNotice, liveMeta } = await build()
        zaloDelivery.send.mockResolvedValue({ delivered: false, failure: "channel_plan", outcome: "rejected" })
        await expect(service.deliverToPerson({ ...person, channel: "zalo", accountId: "z1" })).resolves.toMatchObject({ outcome: "rejected" })
        expect(planNotice.planBlocked).toHaveBeenCalled()

        liveMeta.send.mockRejectedValue(new Error("lost"))
        await expect(service.deliverToPerson({ ...person, channel: "facebook", accountId: "m1" })).resolves.toEqual(AMBIGUOUS)
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

    it("hands the text to the port of the account's provider for another channel (Meta), and answers its receipt as it gave it", async () => {
        const { service, liveMeta, connections } = await build()
        liveMeta.send.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged" })
        await expect(service.deliverToPerson({ ...person, channel: "facebook", accountId: "m1" })).resolves.toEqual(ACKNOWLEDGED)
        expect(connections.find).toHaveBeenCalledWith("ws-1", "m1")
        expect(liveMeta.send).toHaveBeenCalledWith(
            expect.objectContaining({ id: "m1", provider: "meta" }),
            expect.objectContaining({ channel: "facebook", externalId: "555", connectionId: "m1" }),
            "555",
            expect.objectContaining({ text: "Hello", at: NOW }),
        )

        liveMeta.send.mockResolvedValue({ delivered: false, failure: null, outcome: "ambiguous" })
        await expect(service.deliverToPerson({ ...person, channel: "facebook", accountId: "m1" })).resolves.toEqual(AMBIGUOUS)
    })

    it("sends nothing for a channel whose account has no send port, and for a person with no connection", async () => {
        const { service, telegram, connections } = await build()
        connections.find.mockResolvedValue(connectionRecord({ id: "c-1", provider: "sepay" }))
        await expect(service.deliverToPerson({ ...person, channel: "instagram" })).resolves.toEqual(REJECTED)
        connections.find.mockResolvedValue(null)
        await expect(service.deliverToPerson({ ...person, channel: "instagram" })).resolves.toEqual(REJECTED)
        await expect(service.deliverToPerson({ ...person, channel: "telegram", accountId: null })).resolves.toEqual(REJECTED)
        expect(telegram.sendMessage).not.toHaveBeenCalled()
    })
})

describe("ChannelDeliveryService: nothing of a sandbox account reaches a live client", () => {
    /** Every LIVE implementation and client double of the world: not one of them may be called for a sandbox account. */
    const liveCalls = (world: Awaited<ReturnType<typeof build>>): number =>
        [
            world.telegram.sendMessage,
            world.telegram.sendTyping,
            world.telegram.sendPhoto,
            world.telegram.sendMediaGroup,
            world.zalo.sendCsText,
            world.zalo.sendCsImage,
            world.zalo.userDisplayName,
            world.zaloDelivery.send,
            world.zaloDelivery.sendText,
            world.credentials.accessToken,
            world.secrets.botToken,
            world.pictures.send,
            world.liveMeta.send,
        ].reduce((total, one) => total + one.mock.calls.length, 0)

    const person = { workspaceId: "ws-1", routeId: "route-1", userId: "555", sendKey: "line-1", text: "Hello" }

    it.each([
        ["telegram", "c-1", "sandboxTelegram"],
        ["zalo", "z1", "sandboxSend"],
        ["facebook", "m1", "sandboxMeta"],
    ] as const)("the customer send of a sandbox %s account goes to its sandbox port, with the caller's moment, and to no live client", async (channel, id, port) => {
        const world = await build()
        const account = accountOf(id, true)
        world.connections.find.mockResolvedValue(account)
        world[port].send.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged" })

        await expect(world.service.deliverToPerson({ ...person, channel, accountId: id, images: [{ url: "https://example.test/a.png", caption: "A" }] })).resolves.toEqual(
            ACKNOWLEDGED,
        )

        expect(world[port].send).toHaveBeenCalledTimes(1)
        expect(world[port].send).toHaveBeenCalledWith(account, expect.objectContaining({ channel, connectionId: id }), "555", expect.objectContaining({ at: NOW }))
        expect(liveCalls(world)).toBe(0)
    })

    it.each([
        ["zalo", "z1", "sandboxSend", "Nguyen Van An"],
    ] as const)("the customer's name of a sandbox %s account is answered by its sandbox port and never read with a token or from the live client", async (_channel, id, port, name) => {
        const world = await build()
        const account = accountOf(id, true)
        world.connections.find.mockResolvedValue(account)
        world[port].nameOf.mockResolvedValue(name)

        await expect(world.service.customerName(zaloTarget({ connectionId: id }))).resolves.toBe(name)

        expect(world[port].nameOf).toHaveBeenCalledWith(account, "user-1")
        expect(liveCalls(world)).toBe(0)
    })

    it.each([
        ["telegram", "c-1", "sandboxTelegram"],
        ["zalo_oa", "z1", "sandboxSend"],
    ] as const)("the staff text to a person of a sandbox %s account is answered by its sandbox port and goes to no live client", async (provider, id, port) => {
        const world = await build()
        const account = accountOf(id, true)
        world.connections.find.mockResolvedValue(account)
        const message = { workspaceId: "ws-1", connectionId: id, provider, recipientId: "staff-1", text: "Shift" } as const

        await expect(world.service.sendToPerson(message)).resolves.toBeUndefined()

        expect(world[port].sendToPerson).toHaveBeenCalledWith(account, message)
        expect(liveCalls(world)).toBe(0)
    })

    it("a refusal of the sandbox staff send is thrown as the sandbox port threw it, and still reaches no live client", async () => {
        const world = await build()
        world.connections.find.mockResolvedValue(accountOf("c-1", true))
        const refusal = new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound })
        world.sandboxTelegram.sendToPerson.mockRejectedValue(refusal)

        await expect(world.service.sendToPerson({ workspaceId: "ws-1", connectionId: "c-1", provider: "telegram", recipientId: "staff-1", text: "Shift" })).rejects.toBe(refusal)
        expect(liveCalls(world)).toBe(0)
    })

    it("typing in the chat of a sandbox Telegram account is answered by its sandbox port and never reaches Telegram", async () => {
        const world = await build()
        const account = accountOf("c-1", true)
        world.connections.find.mockResolvedValue(account)

        await world.service.showTyping(target())

        expect(world.sandboxTelegram.showTyping).toHaveBeenCalledWith(account, "555")
        expect(liveCalls(world)).toBe(0)
    })

    it("a sandbox account of a provider that registered no sandbox port is refused, never answered by the live port (send, name, staff text, typing)", async () => {
        const world = await build()
        const bare = new CustomerSendRegistryService()
        bare.register(new ZaloCustomerSendService(world.zaloDelivery, world.credentials, world.zalo))
        bare.register(new TelegramCustomerSendService(world.secrets, world.pictures, world.telegram, world.logger))
        Reflect.set(world.service, "customerSends", bare)
        world.connections.find.mockResolvedValue(accountOf("c-1", true))

        await expect(world.service.deliverToPerson({ ...person, channel: "telegram", accountId: "c-1" })).resolves.toEqual(AMBIGUOUS)
        await expect(world.service.customerName(zaloTarget())).resolves.toBe("")
        await expect(world.service.sendToPerson({ workspaceId: "ws-1", connectionId: "c-1", provider: "telegram", recipientId: "s", text: "t" })).rejects.toMatchObject({
            code: ProviderRegistryErrorCode.SandboxMissing,
        })
        await expect(world.service.showTyping(target())).rejects.toMatchObject({ code: ProviderRegistryErrorCode.SandboxMissing })
        expect(liveCalls(world)).toBe(0)
    })
})
