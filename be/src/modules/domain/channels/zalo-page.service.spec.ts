import { FakeClock, builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import { ChatConversationsService } from "@modules/domain/chat-records"
import type { ChatFollower } from "@modules/domain/chat-records"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { ChannelDeliveryService } from "./channel-delivery.service"
import { ZALO_INBOX_READS } from "./channels.decorators"
import type { ZaloInboxFactsRow, ZaloInboxReads } from "./channels.port"
import type { ZaloSecret } from "./channels.contracts"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"

import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloPageService } from "./zalo-page.service"

const NOW = new Date("2026-10-28T10:00:00.000Z")
const HOUR = 3_600_000
const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }

const secret: ZaloSecret = {
    appId: "123456",
    appSecret: "app-secret-1234",
    oaSecret: "oa-key-9876",
    accessToken: "access-token",
    renewalToken: "refresh-token",
    refreshExpiresAt: "2027-01-01T00:00:00.000Z",
}

const connection = builder<ConnectionRecord>({
    id: "c-1",
    workspaceId: "ws-1",
    provider: "zalo_oa",
    name: "Shop OA",
    meta: { app_id: "123456", oa_id: "oa-77" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    createdBy: "owner-1",
    firstEvent: null,
})

const follower: ChatFollower = {
    conversationId: "k-1",
    externalId: "u-1:99",
    name: "An",
    lastAt: "2026-10-28T09:00:00.000Z",
}

const FACTS: ZaloInboxFactsRow = { last_at: "2026-10-28T09:30:00.000Z", has_text: true, has_follow: false }

const build = async (
    followers: ReadonlyArray<ChatFollower> = [follower],
    record: Partial<ConnectionRecord> = {},
    facts: ZaloInboxFactsRow | null = FACTS,
) => {
    const logger = mock<Logger>()
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.get.mockImplementation((workspaceId, id) => Promise.resolve(connection({ id, workspaceId, ...record })))
    connections.webhookUrl.mockImplementation((provider, id) => `https://hooks.test/${provider}/${id}`)
    connections.agentIds.mockResolvedValue(["agent-1"])
    const credentials = mock<ZaloCredentialsService>()
    credentials.callbackUrl.mockReturnValue("https://nivo.test/connections/zalo/callback")
    credentials.load.mockResolvedValue(ok({ secret, expiresAt: NOW.getTime() + HOUR, workspaceId: "ws-1" }))
    credentials.accessToken.mockResolvedValue("access-token")
    const delivery = mock<ChannelDeliveryService>()
    delivery.sendToPerson.mockResolvedValue(undefined)
    const inboxReads = mock<ZaloInboxReads>()
    inboxReads.factsOf.mockResolvedValue(facts)
    const conversations = mock<ChatConversationsService>()
    conversations.followersOn.mockResolvedValue(followers)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloPageService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionsService, useValue: connections },
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ZALO_INBOX_READS, useValue: inboxReads },
            { provide: ChannelDeliveryService, useValue: delivery },
            { provide: ChatConversationsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloPageService), logger, connections, credentials, delivery, conversations }
}

describe("ZaloPageService view", () => {
    it("answers a healthy connection with masked secrets, the paste addresses, the check list and the 48-hour followers", async () => {
        const { service, conversations } = await build()

        const page = await service.view(actor, "c-1")

        expect(page).toMatchObject({
            id: "c-1",
            name: "Shop OA",
            healthy: true,
            oaId: "oa-77",
            appId: "123456",
            appSecretMask: "\u2022\u2022\u2022\u20221234",
            oaSecretMask: "\u2022\u2022\u2022\u20229876",
            callbackUrl: "https://nivo.test/connections/zalo/callback",
            webhookUrl: "https://hooks.test/zalo_oa/c-1",
            access: { state: "valid", canRefresh: true },
            sendBlock: null,
            agentIds: ["agent-1"],
            znsRenewal: null,
            recipients: [{ userId: "u-1", name: "An", lastMessageAt: "2026-10-28T09:00:00.000Z" }],
        })
        expect(page.checks.map((row) => [row.key, row.state])).toEqual([
            ["app", "ok"],
            ["token", "ok"],
            ["webhook", "ok"],
        ])
        expect(JSON.stringify(page)).not.toContain("app-secret-1234")
        expect(JSON.stringify(page)).not.toContain("access-token")
        expect(conversations.followersOn).toHaveBeenCalledWith("ws-1", {
            channel: "zalo",
            connectionId: "c-1",
            since: new Date("2026-10-26T10:00:00.000Z"),
            limit: 40,
        })
    })

    it("closes the send and asks for attention when the token ended and nothing can renew it", async () => {
        const { service, credentials } = await build([])
        credentials.load.mockResolvedValue(
            ok({
                secret: { ...secret, renewalToken: undefined },
                expiresAt: NOW.getTime() - 3 * HOUR,
                workspaceId: "ws-1",
            }),
        )

        const page = await service.view(actor, "c-1")

        expect(page).toMatchObject({
            healthy: false,
            access: { state: "expired", expiredMinutesAgo: 180 },
            sendBlock: "token_expired",
        })
    })
})

describe("ZaloPageService view fallbacks", () => {
    it("falls back to the stored facts when the credential cannot be read", async () => {
        const { service, credentials } = await build([follower], { meta: { app_id: "999999" } }, null)
        credentials.load.mockResolvedValue(refused(ChannelsErrorCode.SecretUnreadable))

        const page = await service.view(actor, "c-1")

        expect(page).toMatchObject({
            appId: "999999",
            oaId: "",
            appSecretMask: null,
            oaSecretMask: null,
            healthy: false,
            access: { state: "none" },
            sendBlock: "not_authorized",
        })
        expect(page.checks[0]?.code).toBe("app_missing")
    })

    it("shows an empty app id when neither the credential nor the facts name one", async () => {
        const { service, credentials } = await build([follower], { meta: {} })
        credentials.load.mockResolvedValue(refused(ChannelsErrorCode.ConnectionNotFound))

        await expect(service.view(actor, "c-1")).resolves.toMatchObject({ appId: "", oaId: "" })
    })
})

describe("ZaloPageService provider guard", () => {
    it("refuses a connection of another provider", async () => {
        const { service } = await build([follower], { provider: "telegram" })

        await expect(service.view(actor, "c-1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
    })
})

describe("ZaloPageService recheck", () => {
    it("renews the token on use and answers the page again", async () => {
        const { service, credentials } = await build()

        await expect(service.recheck(actor, "c-1")).resolves.toMatchObject({ id: "c-1", healthy: true })

        expect(credentials.accessToken).toHaveBeenCalledWith("c-1")
    })

    it("still answers the page, and logs, when the renewal is refused", async () => {
        const { service, credentials, logger } = await build()
        credentials.accessToken.mockRejectedValue(new ChannelsError({ code: ChannelsErrorCode.ZaloNotAuthorized }))

        await expect(service.recheck(actor, "c-1")).resolves.toMatchObject({ id: "c-1" })

        expect(logger.warn).toHaveBeenCalled()
    })

    it("throws a busy refresh back so the caller retries", async () => {
        const { service, credentials } = await build()
        credentials.accessToken.mockRejectedValue(new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy }))

        await expect(service.recheck(actor, "c-1")).rejects.toMatchObject({
            code: ChannelsErrorCode.ZaloRefreshBusy,
        })
    })
})

describe("ZaloPageService sendTest", () => {
    it("sends a trimmed text through the delivery path to a follower inside the window", async () => {
        const { service, delivery } = await build()

        await expect(service.sendTest(actor, "c-1", "u-1", " Hello ")).resolves.toEqual({
            sent: true,
            failure: null,
        })

        expect(delivery.sendToPerson).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            connectionId: "c-1",
            provider: "zalo_oa",
            recipientId: "u-1",
            text: "Hello",
        })
    })

    it.each([["   "], ["x".repeat(501)]])("refuses a text that is empty or too long", async (text) => {
        const { service, delivery } = await build()

        await expect(service.sendTest(actor, "c-1", "u-1", text)).rejects.toBeInstanceOf(ConnectionsError)

        expect(delivery.sendToPerson).not.toHaveBeenCalled()
    })

    it("refuses a recipient who did not write inside the free window", async () => {
        const { service, delivery } = await build()

        await expect(service.sendTest(actor, "c-1", "stranger", "Hello")).rejects.toBeInstanceOf(ConnectionsError)

        expect(delivery.sendToPerson).not.toHaveBeenCalled()
    })

    it("answers the reason in the delivery terms when Zalo refuses, and a dead token as an expired token", async () => {
        const { service, delivery } = await build()
        delivery.sendToPerson.mockRejectedValueOnce(
            new ZaloError({ code: ZaloErrorCode.WindowClosed, params: { zaloCode: -230 } }),
        )
        delivery.sendToPerson.mockRejectedValueOnce(new ChannelsError({ code: ChannelsErrorCode.ZaloNotAuthorized }))

        await expect(service.sendTest(actor, "c-1", "u-1", "Hello")).resolves.toEqual({
            sent: false,
            failure: "zalo_window_expired",
        })
        await expect(service.sendTest(actor, "c-1", "u-1", "Hello")).resolves.toEqual({
            sent: false,
            failure: "token_expired",
        })
    })

    it("throws a busy refresh back so the caller retries", async () => {
        const { service, delivery } = await build()
        delivery.sendToPerson.mockRejectedValue(new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy }))

        await expect(service.sendTest(actor, "c-1", "u-1", "Hello")).rejects.toMatchObject({
            code: ChannelsErrorCode.ZaloRefreshBusy,
        })
    })
})

describe("ZaloPageService view of the ZNS renewal template", () => {
    it("carries the ZNS renewal template stored on the connection so the owner can edit it", async () => {
        const { service } = await build([follower], {
            meta: {
                app_id: "123456",
                zns_renewal_template_id: "345678",
                zns_renewal_param_customer_name: "customer_name",
            },
        })

        const page = await service.view(actor, "c-1")

        expect(page.znsRenewal).toEqual({
            templateId: "345678",
            params: {
                customerName: "customer_name",
                plan: "",
                endDate: "",
                amount: "",
                transferContent: "",
                invoiceNumber: "",
            },
        })
    })
})
