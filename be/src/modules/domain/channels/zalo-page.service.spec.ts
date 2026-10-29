import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { ChannelDeliveryService } from "./channel-delivery.service"
import type { ZaloSecret } from "./channels.contracts"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { answerByTable } from "@tests/fixtures/builders/table-query-builder.builder"
import type { TableAnswers, TableQuery } from "@tests/fixtures/builders/table-query-builder.builder"

/** The name of each read of the capability, so a spec answers the read it means. */
const LIST_ZALO_RECIPIENTS = "recipients"
const FIND_ZALO_INBOX_FACTS = "facts"
const FIND_LAST_ZALO_REPLY = "lastReply"
const LIST_ZALO_MESSAGE_EVENTS = "messages"
const LIST_ZALO_FOLLOW_EVENTS = "follows"

const limitOf = (query: TableQuery): unknown => query.callsOf("limit")[0]?.[0]

/** A manager whose tables answer the named reads; the reads of one table are told apart by their limit. */
const tablesEm = (answers: Record<string, ReadonlyArray<unknown>>) => {
    const em = mockEntityManager()
    const seen = answerByTable(em, {
        "public.agent_conversations": answers[LIST_ZALO_RECIPIENTS] ?? [],
        "public.agent_messages": (query) =>
            (limitOf(query) === 1 ? answers[FIND_LAST_ZALO_REPLY] : answers[LIST_ZALO_MESSAGE_EVENTS]) ?? [],
        "public.zalo_inbox": (query) =>
            (limitOf(query) === 20 ? answers[LIST_ZALO_FOLLOW_EVENTS] : answers[FIND_ZALO_INBOX_FACTS]) ?? [],
    })
    SEEN.set(em, seen)
    return em
}

const SEEN = new WeakMap<object, TableAnswers>()

/** The named parameters of every condition the subject put on its read of a table. */
const parametersOf = (em: object, table: string): unknown =>
    Object.assign(
        {},
        ...(SEEN.get(em)?.queriesOf(table)[0]?.calls ?? [])
            .filter((call) => call.method === "where" || call.method === "andWhere")
            .map((call) => call.args[1]),
    )
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
    refreshToken: "refresh-token",
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

const recipientRow = { external_id: "u-1:99", visitor_name: "An", last_at: "2026-10-28T09:00:00.000Z" }

const messageRow = {
    id: "m-1",
    role: "user",
    body: "Hello",
    created_at: "2026-10-28T09:00:00.000Z",
    delivery_status: null,
    delivery_error: null,
    visitor_name: "An",
}

const DEFAULT_ANSWERS: Record<string, ReadonlyArray<unknown>> = {
    [LIST_ZALO_RECIPIENTS]: [recipientRow],
    [FIND_ZALO_INBOX_FACTS]: [{ last_at: "2026-10-28T09:30:00.000Z", has_text: true, has_follow: false }],
    [FIND_LAST_ZALO_REPLY]: [{ delivery_status: "sent", delivery_error: null }],
    [LIST_ZALO_MESSAGE_EVENTS]: [messageRow],
    [LIST_ZALO_FOLLOW_EVENTS]: [{ id: "f-1", received_at: "2026-10-28T08:00:00.000Z" }],
}

type Answers = Record<string, ReadonlyArray<unknown>>

const build = async (answers: Answers = {}, record: Partial<ConnectionRecord> = {}) => {
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
    const em = tablesEm({ ...DEFAULT_ANSWERS, ...answers })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloPageService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionsService, useValue: connections },
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ChannelDeliveryService, useValue: delivery },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloPageService), logger, connections, credentials, delivery, em }
}

describe("ZaloPageService view", () => {
    it("answers a healthy connection with masked secrets, the paste addresses, the check list and the 48-hour followers", async () => {
        const { service, em } = await build()

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
            ["permissions", "ok"],
        ])
        expect(JSON.stringify(page)).not.toContain("app-secret-1234")
        expect(JSON.stringify(page)).not.toContain("access-token")
        expect(parametersOf(em, "public.agent_conversations")).toEqual({
            workspaceId: "ws-1",
            connectionId: "c-1",
            since: "2026-10-26T10:00:00.000Z",
        })
    })

    it("closes the send and asks for attention when the token ended and nothing can renew it", async () => {
        const { service, credentials } = await build({ [LIST_ZALO_RECIPIENTS]: [], [FIND_LAST_ZALO_REPLY]: [] })
        credentials.load.mockResolvedValue(
            ok({
                secret: { ...secret, refreshToken: undefined },
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
        expect(page.checks[3]?.code).toBe("permissions_unknown")
    })
})

describe("ZaloPageService view fallbacks", () => {
    it("falls back to the stored facts when the credential cannot be read", async () => {
        const { service, credentials } = await build({ [FIND_ZALO_INBOX_FACTS]: [] }, { meta: { app_id: "999999" } })
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
        const { service, credentials } = await build({}, { meta: {} })
        credentials.load.mockResolvedValue(refused(ChannelsErrorCode.ConnectionNotFound))

        await expect(service.view(actor, "c-1")).resolves.toMatchObject({ appId: "", oaId: "" })
    })
})

describe("ZaloPageService provider guard", () => {
    it("refuses a connection of another provider", async () => {
        const { service } = await build({}, { provider: "telegram" })

        await expect(service.view(actor, "c-1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
    })
})

describe("ZaloPageService events", () => {
    it("lists customer texts and follows newest first, and words a failed reply by the token that cannot work", async () => {
        const { service, credentials, em } = await build({
            [LIST_ZALO_MESSAGE_EVENTS]: [
                {
                    id: "m-2",
                    role: "agent",
                    body: "Hi",
                    created_at: "2026-10-28T09:30:00.000Z",
                    delivery_status: "failed",
                    delivery_error: "zalo_error",
                    visitor_name: null,
                },
            ],
        })
        credentials.load.mockResolvedValue(
            ok({
                secret: { ...secret, refreshToken: undefined },
                expiresAt: NOW.getTime() - HOUR,
                workspaceId: "ws-1",
            }),
        )

        const events = await service.events(actor, "c-1")

        expect(events.map((event) => [event.id, event.kind, event.outcome, event.reason])).toEqual([
            ["m-2", "agent_reply", "not_sent", "token_expired"],
            ["f-1", "follow", "received", null],
        ])
        expect(parametersOf(em, "public.agent_messages")).toEqual({ workspaceId: "ws-1", connectionId: "c-1" })
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
        const { service } = await build(
            {},
            {
                meta: {
                    app_id: "123456",
                    zns_renewal_template_id: "345678",
                    zns_renewal_param_customer_name: "customer_name",
                },
            },
        )

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
