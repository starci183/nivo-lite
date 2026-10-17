import { Secret } from "@modules/platform/config"
import type { Logger } from "@modules/platform/logging"
import { ROW, connectionsCase, connectionsScenarios } from "@tests/fixtures/builders/connections.builder"
import type { Urls } from "@tests/fixtures/builders/connections.builder"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectorInterestService } from "@modules/domain/connector-interest"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import { CONNECTIONS_OPTIONS } from "./connections.decorators"
import { ConnectionsService } from "./connections.service"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import {
    APPLY_ZALO_AUTHORIZATION,
    CLAIM_DUE_SYNCS,
    DELETE_CONNECTION,
    FIND_ACTIVE_MEMBER,
    FIND_CONNECTION,
    FIND_DEFAULT_SMTP,
    FIND_CONNECTION_AGENT_IDS,
    FIND_CONNECTIONS_BY_IDS,
    FIND_INTAKE_CONNECTION,
    FIND_LIVE_BY_META,
    FIND_SYNC_SCHEDULE,
    INSERT_CONNECTION,
    LIST_CONNECTIONS,
    LIST_CONNECTIONS_BY_PROVIDER,
    LIST_HEALTH_BATCH,
    MARK_CONNECTION_ERROR,
    MARK_CONNECTION_HEALTH,
    MARK_CONNECTION_RECEIVED,
    MARK_SYNCED,
    MARK_SYNC_FAILED,
    PATCH_CONNECTION,
    RECORD_EVENT,
    SET_DEFAULT_SMTP,
    SET_SYNC_SCHEDULE,
    SETTLE_WIZARD,
} from "./persistence/connections.sql"
const buildWith = async (entityManager: MockEntityManager, urls: Urls = {}) => {
    const secrets = mock<ConnectionSecretsService>()
    const interest = mock<ConnectorInterestService>()
    const logger = mock<Logger>()
    const options = { channelTokenKey: new Secret("k"), siteUrl: "https://site.example.com", ...urls }
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CONNECTIONS_OPTIONS, useValue: options },
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: ConnectorInterestService, useValue: interest },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionsService), secrets, interest }
}
const build = async (entityManager: MockEntityManager, urls: Urls = {}) =>
    (await buildWith(entityManager, urls)).service
type QueryStubs = ReadonlyArray<readonly [string, unknown]>
const intakeQueries = (
    found: ReadonlyArray<unknown> = [{ id: "c-1", workspace_id: "ws-1", status: "connected" }],
    batch: ReadonlyArray<unknown> = [],
): QueryStubs => [
    [FIND_INTAKE_CONNECTION, found],
    [MARK_CONNECTION_ERROR, []],
    [MARK_CONNECTION_RECEIVED, []],
    [APPLY_ZALO_AUTHORIZATION, []],
    [LIST_HEALTH_BATCH, batch],
    [MARK_CONNECTION_HEALTH, []],
]
const buildIntake = async (found?: ReadonlyArray<unknown>, batch?: ReadonlyArray<unknown>) => {
    const em = mockEntityManager({ query: intakeQueries(found, batch) })
    return { service: await build(em), em }
}
const OWNER = [FIND_ACTIVE_MEMBER, [{ role: "owner", display_name: "Lan" }]] as const
const { actor, forbidden, invalidName, missing } = connectionsCase

describe("ConnectionsService > addresses", () => {
    it("uses the required site URL and trims every trailing slash", async () => {
        const service = await build(mockEntityManager())
        expect(service.siteBase()).toBe("https://site.example.com")
        expect(service.webhookUrl("telegram", "c1")).toBe("https://site.example.com/api/telegram/c1")
        expect(service.publicOrigin()).toBeNull()
        const trimmed = await build(mockEntityManager(), { siteUrl: "https://nivo.vn/app///" })
        expect(trimmed.siteBase()).toBe("https://nivo.vn/app")
    })

    it.each([undefined, "https://api.nivo.vn/app"])("uses public URL precedence: %s", async (publicApiUrl) => {
        const service = await build(mockEntityManager(), { publicSiteUrl: "https://nivo.vn/app", publicApiUrl })
        const provider = publicApiUrl ?? "https://nivo.vn/app"
        expect(service.siteBase()).toBe("https://nivo.vn/app")
        expect(service.webhookUrl("telegram", "c1")).toBe(`${provider}/api/telegram/c1`)
        expect(service.webhookUrl("sepay", "c1", "https://other.test")).toBe(
            "https://other.test/api/connections/sepay/c1",
        )
        expect(service.publicOrigin()).toBe(new URL(provider).origin)
    })
})

describe("ConnectionsService > authorize", () => {
    it("answers the member holding one of the roles", async () => {
        const em = mockEntityManager({ query: [OWNER] })
        await expect((await build(em)).authorize(actor, ["owner"])).resolves.toEqual({
            role: "owner",
            displayName: "Lan",
        })
        expect(em.query).toHaveBeenCalledWith(FIND_ACTIVE_MEMBER, ["ws-1", "user-1"])
    })

    it.each([
        { name: "refuses a caller who is not an active member", rows: [], roles: ["owner"] },
        {
            name: "refuses a member whose role is not listed",
            rows: [{ role: "staff", display_name: "Minh" }],
            roles: ["owner", "manager"],
        },
    ] as const)("$name", async ({ rows, roles }) => {
        const em = mockEntityManager({ query: [FIND_ACTIVE_MEMBER, rows] })
        await expect((await build(em)).authorize(actor, roles)).rejects.toMatchObject(forbidden)
    })
})

describe("ConnectionsService > find, get, findMany, list, listByProvider", () => {
    it("finds a connection of the workspace or null", async () => {
        const em = mockEntityManager({ query: connectionsScenarios.findThenMissing(FIND_CONNECTION) })
        const service = await build(em)
        await expect(service.find("ws-1", "c1")).resolves.toMatchObject({ id: "c1", workspaceId: "ws-1" })
        await expect(service.find("ws-1", "c9")).resolves.toBeNull()
        expect(em.query).toHaveBeenCalledWith(FIND_CONNECTION, ["ws-1", "c9"])
    })

    it("finds through the manager it is handed", async () => {
        const manager = mockEntityManager({ query: [FIND_CONNECTION, [ROW]] })
        await expect((await build(mockEntityManager())).find("ws-1", "c1", manager)).resolves.toMatchObject({
            id: "c1",
        })
    })

    it("gets a connection, and answers not found for a missing one", async () => {
        const em = mockEntityManager({ query: connectionsScenarios.findThenMissing(FIND_CONNECTION) })
        const service = await build(em)
        await expect(service.get("ws-1", "c1")).resolves.toMatchObject({ id: "c1" })
        await expect(service.get("ws-1", "c9")).rejects.toMatchObject({
            code: ConnectionsErrorCode.NotFound,
            params: { id: "c9" },
        })
    })

    it("finds several by id", async () => {
        const em = mockEntityManager({ query: [FIND_CONNECTIONS_BY_IDS, [ROW]] })
        await expect((await build(em)).findMany("ws-1", ["c1", "c2"])).resolves.toHaveLength(1)
        expect(em.query).toHaveBeenCalledWith(FIND_CONNECTIONS_BY_IDS, ["ws-1", ["c1", "c2"]])
    })

    it("lists the workspace connections", async () => {
        const em = mockEntityManager({ query: [LIST_CONNECTIONS, [ROW, ROW]] })
        await expect((await build(em)).list("ws-1")).resolves.toHaveLength(2)
    })

    it("lists one provider with or without the disconnected", async () => {
        const em = mockEntityManager({ query: [LIST_CONNECTIONS_BY_PROVIDER, [ROW]] })
        const service = await build(em)
        await expect(service.listByProvider("ws-1", "sepay", { includeDisconnected: true })).resolves.toHaveLength(1)
        expect(em.query).toHaveBeenCalledWith(LIST_CONNECTIONS_BY_PROVIDER, ["ws-1", "sepay", true])
    })
})

describe("ConnectionsService > findLiveByMeta", () => {
    it("answers the live owner of a public fact, or null", async () => {
        const em = mockEntityManager({
            query: [[FIND_LIVE_BY_META, [{ id: "c9", workspace_id: "ws-9" }]]],
        })
        const none = mockEntityManager({ query: [FIND_LIVE_BY_META, []] })
        await expect((await build(em)).findLiveByMeta("telegram", "bot_id", "42")).resolves.toEqual({
            id: "c9",
            workspaceId: "ws-9",
        })
        expect(em.query).toHaveBeenCalledWith(FIND_LIVE_BY_META, ["telegram", "bot_id", "42"])
        await expect((await build(none)).findLiveByMeta("meta", "page_id", "1")).resolves.toBeNull()
    })
})

describe("ConnectionsService > agentIds", () => {
    it("returns the attached agent ids in row order, or an empty list", async () => {
        const em = mockEntityManager({
            query: connectionsScenarios.attachedAgentsThenMissing(FIND_CONNECTION_AGENT_IDS),
        })
        const service = await build(em)
        await expect(service.agentIds("ws-1", "c1")).resolves.toEqual(["agent-2", "agent-1"])
        await expect(service.agentIds("ws-1", "c9")).resolves.toEqual([])
        expect(em.query.mock.calls).toEqual([
            [FIND_CONNECTION_AGENT_IDS, ["ws-1", "c1"]],
            [FIND_CONNECTION_AGENT_IDS, ["ws-1", "c9"]],
        ])
    })
})

describe("ConnectionsService > create", () => {
    const input = connectionsCase.createInput
    it("writes the row and the sealed secret in one transaction", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [INSERT_CONNECTION, [{ id: "c1" }]] }))
        const { service, secrets } = await buildWith(tx.em)
        await expect(service.create(input)).resolves.toBe("c1")
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_CONNECTION, [
            "ws-1",
            "telegram",
            "Shop bot",
            "connected",
            "live",
            "user-1",
            '{"bot_id":"7"}',
        ])
        expect(secrets.create).toHaveBeenCalledWith("c1", "token", "hook", expect.anything())
        expect(tx.commits).toBe(1)
    })

    it("rolls the row back when the secret cannot be stored", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [INSERT_CONNECTION, [{ id: "c1" }]] }))
        const { service, secrets } = await buildWith(tx.em)
        const failed = new ConnectionsError({ code: ConnectionsErrorCode.NotFound })
        secrets.create.mockRejectedValue(failed)
        await expect(service.create(input)).rejects.toBe(failed)
        expect(tx.rollbacks).toBe(1)
    })

    it("joins the transaction of the caller when one is handed in", async () => {
        const manager = mockEntityManager({ query: [INSERT_CONNECTION, [{ id: "c2" }]] })
        const em = mockEntityManager()
        await expect((await build(em)).create(input, manager)).resolves.toBe("c2")
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a name that is too short and writes nothing", async () => {
        const em = mockEntityManager()
        const service = await build(em)
        expect(() => service.create({ ...input, name: " a " })).toThrow(
            expect.objectContaining({ code: ConnectionsErrorCode.NameInvalid }),
        )
    })

    it("fails when the insert answers no row", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [INSERT_CONNECTION, []] }))
        await expect((await build(tx.em)).create(input)).rejects.toMatchObject(missing)
    })
})

describe("ConnectionsService > patch", () => {
    it("changes the given fields", async () => {
        const em = mockEntityManager({ query: [PATCH_CONNECTION, [{ id: "c1" }]] })
        await (
            await build(em)
        ).patch("ws-1", "c1", {
            name: " New ",
            status: "error",
            environment: "test",
            meta: { a: "b" },
            lastError: null,
        })
        expect(em.query).toHaveBeenCalledWith(PATCH_CONNECTION, [
            "ws-1",
            "c1",
            "New",
            "error",
            "test",
            '{"a":"b"}',
            true,
            null,
        ])
    })

    it("leaves every absent field alone", async () => {
        const em = mockEntityManager({ query: [PATCH_CONNECTION, [{ id: "c1" }]] })
        await (await build(em)).patch("ws-1", "c1", {})
        expect(em.query).toHaveBeenCalledWith(PATCH_CONNECTION, ["ws-1", "c1", null, null, null, null, false, null])
    })

    it("refuses a name that is too short", async () => {
        await expect((await build(mockEntityManager())).patch("ws-1", "c1", { name: "x" })).rejects.toMatchObject(
            invalidName,
        )
    })

    it("answers not found for a connection of another workspace", async () => {
        const em = mockEntityManager({ query: [PATCH_CONNECTION, []] })
        await expect((await build(em)).patch("ws-1", "c9", { status: "connected" })).rejects.toMatchObject(missing)
    })
})

describe("ConnectionsService > secrets", () => {
    it("opens, stores and wipes the secret through the secrets owner", async () => {
        const { service, secrets } = await buildWith(mockEntityManager())
        secrets.read.mockResolvedValue({ plain: "token", webhookSecret: "hook" })
        await expect(service.readSecret("c1")).resolves.toEqual({ plain: "token", webhookSecret: "hook" })
        await service.writeSecret("c1", "token", "hook")
        await service.wipeSecret("c1")
        expect(secrets.write).toHaveBeenCalledWith("c1", "token", "hook")
        expect(secrets.wipe).toHaveBeenCalledWith("c1")
    })

    it("answers null when the secret cannot be opened with the current key", async () => {
        const { service, secrets } = await buildWith(mockEntityManager())
        secrets.read.mockRejectedValue(new Error("unsupported state or unable to authenticate data"))
        await expect(service.readSecret("c1")).resolves.toBeNull()
    })
})

describe("ConnectionsService > remove", () => {
    it("deletes a connection of the workspace", async () => {
        const em = mockEntityManager({ query: [DELETE_CONNECTION, [{ id: "c1" }]] })
        await expect((await build(em)).remove("ws-1", "c1")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(DELETE_CONNECTION, ["ws-1", "c1"])
    })

    it("answers not found for a connection that is not there", async () => {
        const em = mockEntityManager({ query: [DELETE_CONNECTION, []] })
        await expect((await build(em)).remove("ws-1", "c9")).rejects.toMatchObject(missing)
    })
})

describe("ConnectionsService > recordEvent", () => {
    it("writes the connection event on the supplied consumer transaction", async () => {
        const root = mockEntityManager()
        const tx = fakeTransaction(
            mockEntityManager({ query: [RECORD_EVENT, [{ name: "Bank", environment: "live" }]] }),
        )
        const service = await build(root)
        const event = { amount: 5, content: "hi", at: "2026-10-12T01:00:00.000Z" }

        await expect(tx.em.transaction((manager) => service.recordEvent("c1", event, manager))).resolves.toEqual({
            name: "Bank",
            environment: "live",
        })

        expect(root.query).not.toHaveBeenCalled()
        expect(tx.em.query).toHaveBeenCalledWith(RECORD_EVENT, ["c1", event.at, JSON.stringify(event)])
        expect(tx.commits).toBe(1)
    })

    const at = "2026-10-12T01:00:00.000Z"
    const rounded = '{"amount":100,"content":"hi","at":"2026-10-12T01:00:00.000Z","text":"t"}'
    const withoutText = '{"amount":5,"content":"hi","at":"2026-10-12T01:00:00.000Z"}'
    it.each([
        {
            name: "records the event with the amount rounded and answers the name and environment",
            environment: "test",
            event: { amount: 100.4, content: "hi", at, text: "t" },
            serialized: rounded,
        },
        {
            name: "answers a live connection and leaves the text out when there is none",
            environment: "live",
            event: { amount: 5, content: "hi", at },
            serialized: withoutText,
        },
    ] as const)("$name", async ({ environment, event, serialized }) => {
        const em = mockEntityManager({ query: [RECORD_EVENT, [{ name: "Bank", environment }]] })
        await expect((await build(em)).recordEvent("c1", event)).resolves.toEqual({ name: "Bank", environment })
        if (environment === "test") expect(em.query).toHaveBeenCalledWith(RECORD_EVENT, ["c1", at, serialized])
        else expect(em.query.mock.calls[0]?.[1]).toEqual(["c1", at, serialized])
    })

    it("answers null for a connection that does not exist", async () => {
        const em = mockEntityManager({ query: [RECORD_EVENT, []] })
        await expect(
            (await build(em)).recordEvent("c9", { amount: 5, content: "hi", at: "2026-10-12T01:00:00.000Z" }),
        ).resolves.toBeNull()
    })
})

describe("ConnectionsService > firstEvent", () => {
    it("answers the status and first event to a manager", async () => {
        const first = { amount: 5, content: "hi", at: "2026-10-12T01:00:00.000Z" }
        const em = mockEntityManager({
            query: [
                [FIND_ACTIVE_MEMBER, [{ role: "manager", display_name: "Lan" }]],
                [FIND_CONNECTION, [{ ...ROW, first_event: first, status: "connected" }]],
            ],
        })
        await expect((await build(em)).firstEvent(actor, "c1")).resolves.toEqual({
            status: "connected",
            firstEvent: first,
        })
    })

    it("refuses a member who is neither owner nor manager", async () => {
        const em = mockEntityManager({ query: [FIND_ACTIVE_MEMBER, [{ role: "staff", display_name: "Minh" }]] })
        await expect((await build(em)).firstEvent(actor, "c1")).rejects.toMatchObject(forbidden)
    })
})

describe("ConnectionsService > wantConnector", () => {
    it("records interest in a planned connector once", async () => {
        const { service, interest } = await buildWith(mockEntityManager({ query: [OWNER] }))
        await expect(service.wantConnector(actor, "shopee")).resolves.toBeUndefined()
        expect(interest.note).toHaveBeenCalledWith("ws-1", "shopee", "user-1")
    })

    it("refuses a connector that is not planned", async () => {
        const em = mockEntityManager({ query: [OWNER] })
        await expect((await build(em)).wantConnector(actor, "sepay")).rejects.toMatchObject({
            code: ConnectionsErrorCode.ConnectorNotFound,
            params: { id: "sepay" },
        })
    })
})

describe("ConnectionsService > intake", () => {
    it("answers the connection of the provider through the manager it is given, or refuses", async () => {
        const { service, em } = await buildIntake()
        const empty = await buildIntake([])
        const inside = mockEntityManager({
            query: [FIND_INTAKE_CONNECTION, [{ id: "c-2", workspace_id: "ws-1", status: "pending" }]],
        })
        await expect(service.intakeOf("c-1", "telegram")).resolves.toEqual({
            kind: "ok",
            value: { id: "c-1", workspaceId: "ws-1", status: "connected" },
        })
        await expect(empty.service.intakeOf("c-2", "zalo_oa", inside)).resolves.toMatchObject({
            value: { id: "c-2", status: "pending" },
        })
        await expect(empty.service.intakeOf("c-1", "telegram")).resolves.toEqual({
            kind: "refused",
            code: ConnectionsErrorCode.NotFound,
            params: undefined,
        })
        expect(em.query).toHaveBeenCalledWith(FIND_INTAKE_CONNECTION, ["c-1", "telegram"])
        expect(empty.em.query).toHaveBeenCalledTimes(1)
    })

    it("marks failing, received and Zalo-authorized connections", async () => {
        const { service, em } = await buildIntake()
        const inside = mockEntityManager({ query: [MARK_CONNECTION_RECEIVED, []] })
        const first = { amount: 0, content: "Minh", at: "2026-10-12T10:00:00.000Z", text: "Hi" }
        await service.markFailing("c-1", "Reconnect")
        await service.markReceived("c-1", first, inside)
        await service.applyZaloAuthorization("c-1", "oa-9")
        await service.applyZaloAuthorization("c-1")
        expect(em.query.mock.calls).toEqual([
            [MARK_CONNECTION_ERROR, ["c-1", "Reconnect"]],
            [APPLY_ZALO_AUTHORIZATION, ["c-1", '{"authorized":true,"oa_id":"oa-9"}']],
            [APPLY_ZALO_AUTHORIZATION, ["c-1", '{"authorized":true}']],
        ])
        expect(inside.query).toHaveBeenCalledWith(MARK_CONNECTION_RECEIVED, ["c-1", JSON.stringify(first)])
    })
})

describe("ConnectionsService > health", () => {
    it("reads a page after an id (from the start when none is given) and records the verdict", async () => {
        const row = { id: "c-1", workspace_id: "ws-1", provider: "telegram", name: "Bot", status: "connected" }
        const times = { last_error: "", last_event_at: "2026-10-10", created_at: "2026-10-01", health: "ok" }
        const { service, em } = await buildIntake([], [{ ...row, ...times }])
        const mark = { state: "silent" as const, reason: "no event for 80h", checkedAt: "2026-10-12T10:00:00.000Z" }
        await expect(service.healthBatch("", 100)).resolves.toEqual([
            {
                id: "c-1",
                workspaceId: "ws-1",
                provider: "telegram",
                name: "Bot",
                status: "connected",
                lastError: "",
                lastEventAt: "2026-10-10",
                createdAt: "2026-10-01",
                health: "ok",
            },
        ])
        await service.healthBatch("c-1", 100)
        await service.markHealth("c-1", mark)
        expect(em.query.mock.calls).toEqual([
            [LIST_HEALTH_BATCH, ["00000000-0000-0000-0000-000000000000", 100]],
            [LIST_HEALTH_BATCH, ["c-1", 100]],
            [
                MARK_CONNECTION_HEALTH,
                ["c-1", '{"state":"silent","reason":"no event for 80h","checked_at":"2026-10-12T10:00:00.000Z"}'],
            ],
        ])
    })
})

describe("ConnectionsService > sync scheduling and default SMTP", () => {
    it("reads timed and manual schedules and rejects a missing connection", async () => {
        const em = mockEntityManager({ query: connectionsScenarios.syncSchedules(FIND_SYNC_SCHEDULE) })
        const service = await build(em)
        await expect(service.scheduleOf("ws-1", "c1")).resolves.toEqual({
            everyMinutes: 15,
            lastSyncAt: "2026-10-12T10:00:00.000Z",
        })
        await expect(service.scheduleOf("ws-1", "c2")).resolves.toEqual({ everyMinutes: null, lastSyncAt: null })
        await expect(service.scheduleOf("ws-1", "c9")).rejects.toMatchObject({ ...missing, params: { id: "c9" } })
        expect(em.query.mock.calls).toEqual([
            [FIND_SYNC_SCHEDULE, ["ws-1", "c1"]],
            [FIND_SYNC_SCHEDULE, ["ws-1", "c2"]],
            [FIND_SYNC_SCHEDULE, ["ws-1", "c9"]],
        ])
    })

    it.each([15, null] as const)("sets the sync interval to %s", async (everyMinutes) => {
        const em = mockEntityManager({ query: [SET_SYNC_SCHEDULE, [{ id: "c1" }]] })
        await expect((await build(em)).setSchedule("ws-1", "c1", everyMinutes)).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(SET_SYNC_SCHEDULE, ["ws-1", "c1", everyMinutes])
    })

    it("rejects a missing connection when setting its schedule", async () => {
        const em = mockEntityManager({ query: [SET_SYNC_SCHEDULE, []] })
        await expect((await build(em)).setSchedule("ws-1", "c9", 15)).rejects.toMatchObject({
            ...missing,
            params: { id: "c9" },
        })
        expect(em.query).toHaveBeenCalledWith(SET_SYNC_SCHEDULE, ["ws-1", "c9", 15])
    })

    it("writes sync facts, sync errors and the workspace default SMTP", async () => {
        const em = mockEntityManager({
            query: [
                [MARK_SYNCED, []],
                [MARK_SYNC_FAILED, []],
                [SET_DEFAULT_SMTP, []],
            ],
        })
        const service = await build(em)
        await expect(service.markSynced("c1", { items: "3", cursor: "next" })).resolves.toBeUndefined()
        await expect(service.markSyncFailed("c2", "Expired token")).resolves.toBeUndefined()
        await expect(service.setDefaultSmtp("ws-1", "c3")).resolves.toBeUndefined()
        expect(em.query.mock.calls).toEqual([
            [MARK_SYNCED, ["c1", '{"items":"3","cursor":"next"}']],
            [MARK_SYNC_FAILED, ["c2", "Expired token"]],
            [SET_DEFAULT_SMTP, ["ws-1", "c3"]],
        ])
    })
})

describe("ConnectionsService > sync scheduling and default SMTP", () => {
    it("maps due sync owners in row order and handles an empty batch", async () => {
        const em = mockEntityManager({ query: connectionsScenarios.dueSyncOwners(CLAIM_DUE_SYNCS) })
        const service = await build(em)
        await expect(service.claimDueSyncs(["telegram", "smtp"], 2)).resolves.toEqual([
            { id: "c2", workspaceId: "ws-2" },
            { id: "c1", workspaceId: "ws-1" },
        ])
        await expect(service.claimDueSyncs([], 5)).resolves.toEqual([])
        expect(em.query.mock.calls).toEqual([
            [CLAIM_DUE_SYNCS, [["telegram", "smtp"], 2]],
            [CLAIM_DUE_SYNCS, [[], 5]],
        ])
    })

    it("answers the default SMTP id or null", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_DEFAULT_SMTP, [{ id: "c3" }]],
                [FIND_DEFAULT_SMTP, []],
            ],
        })
        const service = await build(em)
        await expect(service.defaultSmtpId("ws-1")).resolves.toBe("c3")
        await expect(service.defaultSmtpId("ws-2")).resolves.toBeNull()
        expect(em.query.mock.calls).toEqual([
            [FIND_DEFAULT_SMTP, ["ws-1"]],
            [FIND_DEFAULT_SMTP, ["ws-2"]],
        ])
    })
})

describe("ConnectionsService > settleWizard", () => {
    const begun = '{"wizard":{"ticket":"t","command":"begin","state":"done","url":"https://z.test/a","code":""}}'
    const oa = '{"oa_secret_saved":true,"wizard":{"ticket":"t","command":"oa","state":"done","url":"","code":""}}'
    const app = '{"wizard":{"ticket":"t","command":"app","state":"failed","url":"","code":"CODE_X"}}'
    it.each([
        ["begin", "done", "https://z.test/a", "", false, begun],
        ["oa", "done", "", "", true, oa],
        ["app", "failed", "", "CODE_X", false, app],
    ] as const)("settles the %s command under its ticket", async (command, state, url, code, oaSecretSaved, facts) => {
        const em = mockEntityManager({ query: [SETTLE_WIZARD, []] })
        const service = await build(em)
        const settlement = { command, state, url, code, oaSecretSaved }
        await expect(service.settleWizard("c-1", "t", settlement)).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(SETTLE_WIZARD, ["c-1", "t", facts])
    })
})
