import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectorInterestService } from "@modules/domain/connector-interest"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { Secret } from "@modules/platform/config"
import type { ConnectionActor } from "./connections.contracts"
import { CONNECTIONS_OPTIONS } from "./connections.decorators"
import type { ConnectionsOptions } from "./connections.options"
import { ConnectionsService } from "./connections.service"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import type { ConnectionSelectRow } from "./persistence/connections.rows"
import {
    APPLY_ZALO_AUTHORIZATION,
    DELETE_CONNECTION,
    FIND_ACTIVE_MEMBER,
    FIND_CONNECTION,
    FIND_CONNECTION_AGENT_IDS,
    FIND_CONNECTIONS_BY_IDS,
    FIND_INTAKE_CONNECTION,
    FIND_LIVE_BY_META,
    INSERT_CONNECTION,
    LIST_CONNECTIONS,
    LIST_CONNECTIONS_BY_PROVIDER,
    LIST_HEALTH_BATCH,
    MARK_CONNECTION_ERROR,
    MARK_CONNECTION_HEALTH,
    MARK_CONNECTION_RECEIVED,
    PATCH_CONNECTION,
    RECORD_EVENT,
    SETTLE_WIZARD,
} from "./persistence/connections.sql"

const actor: ConnectionActor = { principalId: "user-1", workspaceId: "ws-1" }
const ROW: ConnectionSelectRow = {
    id: "c1",
    workspace_id: "ws-1",
    provider: "sepay",
    name: "Bank",
    public_meta: {},
    status: "pending",
    last_error: null,
    environment: "live",
    is_default: false,
    last_event_at: null,
    first_event: null,
    created_by: "user-1",
    created_at: "2026-10-01T00:00:00.000Z",
}
const OWNER = [FIND_ACTIVE_MEMBER, [{ role: "owner", display_name: "Lan" }]] as const

type Urls = Partial<Pick<ConnectionsOptions, "siteUrl" | "publicSiteUrl" | "publicApiUrl">>
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

describe("ConnectionsService", () => {
    describe("addresses", () => {
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

    describe("authorize", () => {
        it("answers the member holding one of the roles", async () => {
            const em = mockEntityManager({ query: [OWNER] })

            await expect((await build(em)).authorize(actor, ["owner"])).resolves.toEqual({
                role: "owner",
                displayName: "Lan",
            })
            expect(em.query).toHaveBeenCalledWith(FIND_ACTIVE_MEMBER, ["ws-1", "user-1"])
        })

        it("refuses a caller who is not an active member", async () => {
            const em = mockEntityManager({ query: [FIND_ACTIVE_MEMBER, []] })

            await expect((await build(em)).authorize(actor, ["owner"])).rejects.toMatchObject({
                code: ConnectionsErrorCode.Forbidden,
            })
        })

        it("refuses a member whose role is not listed", async () => {
            const em = mockEntityManager({ query: [FIND_ACTIVE_MEMBER, [{ role: "staff", display_name: "Minh" }]] })

            await expect((await build(em)).authorize(actor, ["owner", "manager"])).rejects.toMatchObject({
                code: ConnectionsErrorCode.Forbidden,
            })
        })
    })

    describe("find, get, findMany, list, listByProvider", () => {
        it("finds a connection of the workspace or null", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_CONNECTION, [ROW]],
                    [FIND_CONNECTION, []],
                ],
            })
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
            const em = mockEntityManager({
                query: [
                    [FIND_CONNECTION, [ROW]],
                    [FIND_CONNECTION, []],
                ],
            })
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

            await expect(service.listByProvider("ws-1", "sepay", { includeDisconnected: true })).resolves.toHaveLength(
                1,
            )
            expect(em.query).toHaveBeenCalledWith(LIST_CONNECTIONS_BY_PROVIDER, ["ws-1", "sepay", true])
        })
    })

    describe("findLiveByMeta", () => {
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

    describe("agentIds", () => {
        it("returns the attached agent ids in row order, or an empty list", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_CONNECTION_AGENT_IDS, [{ agent_id: "agent-2" }, { agent_id: "agent-1" }]],
                    [FIND_CONNECTION_AGENT_IDS, []],
                ],
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

    describe("create", () => {
        const input = {
            workspaceId: "ws-1",
            createdBy: "user-1",
            provider: "telegram" as const,
            name: "  Shop bot ",
            status: "connected" as const,
            environment: "live" as const,
            meta: { bot_id: "7" },
            secret: { plain: "token", webhookSecret: "hook" },
        }

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

            await expect((await build(tx.em)).create(input)).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
            })
        })
    })

    describe("patch", () => {
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
            await expect((await build(mockEntityManager())).patch("ws-1", "c1", { name: "x" })).rejects.toMatchObject({
                code: ConnectionsErrorCode.NameInvalid,
            })
        })

        it("answers not found for a connection of another workspace", async () => {
            const em = mockEntityManager({ query: [PATCH_CONNECTION, []] })

            await expect((await build(em)).patch("ws-1", "c9", { status: "connected" })).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
            })
        })
    })

    describe("secrets", () => {
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

    describe("remove", () => {
        it("deletes a connection of the workspace", async () => {
            const em = mockEntityManager({ query: [DELETE_CONNECTION, [{ id: "c1" }]] })

            await expect((await build(em)).remove("ws-1", "c1")).resolves.toBeUndefined()
            expect(em.query).toHaveBeenCalledWith(DELETE_CONNECTION, ["ws-1", "c1"])
        })

        it("answers not found for a connection that is not there", async () => {
            const em = mockEntityManager({ query: [DELETE_CONNECTION, []] })

            await expect((await build(em)).remove("ws-1", "c9")).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
            })
        })
    })

    describe("recordEvent", () => {
        it("records the event with the amount rounded and answers the name and environment", async () => {
            const em = mockEntityManager({ query: [RECORD_EVENT, [{ name: "Bank", environment: "test" }]] })

            await expect(
                (await build(em)).recordEvent("c1", {
                    amount: 100.4,
                    content: "hi",
                    at: "2026-10-12T01:00:00.000Z",
                    text: "t",
                }),
            ).resolves.toEqual({ name: "Bank", environment: "test" })

            expect(em.query).toHaveBeenCalledWith(RECORD_EVENT, [
                "c1",
                "2026-10-12T01:00:00.000Z",
                '{"amount":100,"content":"hi","at":"2026-10-12T01:00:00.000Z","text":"t"}',
            ])
        })

        it("answers a live connection and leaves the text out when there is none", async () => {
            const em = mockEntityManager({ query: [RECORD_EVENT, [{ name: "Bank", environment: "live" }]] })

            await expect(
                (await build(em)).recordEvent("c1", { amount: 5, content: "hi", at: "2026-10-12T01:00:00.000Z" }),
            ).resolves.toEqual({ name: "Bank", environment: "live" })
            expect(em.query.mock.calls[0]?.[1]).toEqual([
                "c1",
                "2026-10-12T01:00:00.000Z",
                '{"amount":5,"content":"hi","at":"2026-10-12T01:00:00.000Z"}',
            ])
        })

        it("answers null for a connection that does not exist", async () => {
            const em = mockEntityManager({ query: [RECORD_EVENT, []] })

            await expect(
                (await build(em)).recordEvent("c9", { amount: 5, content: "hi", at: "2026-10-12T01:00:00.000Z" }),
            ).resolves.toBeNull()
        })
    })

    describe("firstEvent", () => {
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

            await expect((await build(em)).firstEvent(actor, "c1")).rejects.toMatchObject({
                code: ConnectionsErrorCode.Forbidden,
            })
        })
    })

    describe("wantConnector", () => {
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

    describe("intake", () => {
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

    describe("health", () => {
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

    describe("settleWizard", () => {
        it.each([
            {
                settlement: {
                    command: "begin",
                    state: "done",
                    url: "https://z.test/a",
                    code: "",
                    oaSecretSaved: false,
                },
                facts: '{"wizard":{"ticket":"t","command":"begin","state":"done","url":"https://z.test/a","code":""}}',
            },
            {
                settlement: { command: "oa", state: "done", url: "", code: "", oaSecretSaved: true },
                facts: '{"oa_secret_saved":true,"wizard":{"ticket":"t","command":"oa","state":"done","url":"","code":""}}',
            },
            {
                settlement: { command: "app", state: "failed", url: "", code: "CODE_X", oaSecretSaved: false },
                facts: '{"wizard":{"ticket":"t","command":"app","state":"failed","url":"","code":"CODE_X"}}',
            },
        ] as const)("settles the $settlement.command command under its ticket", async ({ settlement, facts }) => {
            const em = mockEntityManager({ query: [SETTLE_WIZARD, []] })
            const service = await build(em)

            await expect(service.settleWizard("c-1", "t", settlement)).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(SETTLE_WIZARD, ["c-1", "t", facts])
        })
    })
})
