import { randomBytes } from "node:crypto"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { Secret } from "@modules/platform/config"
import { decryptSecret, encryptSecret } from "./connection-cipher.policy"
import type { ConnectionActor } from "./connections.contracts"
import { MODULE_OPTIONS_TOKEN } from "./connections.module-definition"
import { ConnectionsService } from "./connections.service"
import { ConnectionsErrorCode } from "./errors/connections.error"
import type { ConnectionSelectRow } from "./persistence/connections.rows"
import {
    DELETE_CONNECTION,
    DELETE_SECRET,
    FIND_ACTIVE_MEMBER,
    FIND_CONNECTION,
    FIND_CONNECTION_AGENT_IDS,
    FIND_CONNECTIONS_BY_IDS,
    FIND_LIVE_BY_META,
    FIND_SECRET,
    INSERT_CONNECTION,
    INSERT_CONNECTOR_INTEREST,
    INSERT_SECRET,
    LIST_CONNECTIONS,
    LIST_CONNECTIONS_BY_PROVIDER,
    PATCH_CONNECTION,
    RECORD_EVENT,
    UPSERT_SECRET,
} from "./persistence/connections.sql"

const KEY = randomBytes(32)
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

const build = async (entityManager: MockEntityManager, key: Buffer = KEY) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            {
                provide: MODULE_OPTIONS_TOKEN,
                useValue: { channelTokenKey: new Secret(key.toString("base64")), publicSiteUrl: undefined },
            },
        ],
    }).compile()
    return moduleRef.get(ConnectionsService)
}

describe("ConnectionsService", () => {
    it("refuses to start with a key that is not 32 bytes", async () => {
        await expect(build(mockEntityManager(), randomBytes(8))).rejects.toMatchObject({
            code: ConnectionsErrorCode.KeyInvalid,
        })
    })

    describe("addresses", () => {
        it("uses the local site origin by default and trims every trailing slash", async () => {
            expect((await build(mockEntityManager())).siteBase()).toBe("http://localhost:3100")

            const moduleRef = await Test.createTestingModule({
                providers: [
                    ConnectionsService,
                    { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
                    {
                        provide: MODULE_OPTIONS_TOKEN,
                        useValue: {
                            channelTokenKey: new Secret(KEY.toString("base64")),
                            publicSiteUrl: "https://nivo.vn/app///",
                        },
                    },
                ],
            }).compile()

            expect(moduleRef.get(ConnectionsService).siteBase()).toBe("https://nivo.vn/app")
        })

        it("builds the webhook address of a connection and the public origin from the site url", async () => {
            const moduleRef = await Test.createTestingModule({
                providers: [
                    ConnectionsService,
                    { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
                    {
                        provide: MODULE_OPTIONS_TOKEN,
                        useValue: {
                            channelTokenKey: new Secret(KEY.toString("base64")),
                            publicSiteUrl: "https://nivo.vn/app",
                        },
                    },
                ],
            }).compile()
            const service = moduleRef.get(ConnectionsService)

            expect(service.webhookUrl("telegram", "c1")).toBe("https://nivo.vn/app/api/telegram/c1")
            expect(service.webhookUrl("sepay", "c1", "https://other.test")).toBe(
                "https://other.test/api/connections/sepay/c1",
            )
            expect(service.publicOrigin()).toBe("https://nivo.vn")
            expect((await build(mockEntityManager())).publicOrigin()).toBeNull()
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
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [INSERT_CONNECTION, [{ id: "c1" }]],
                        [INSERT_SECRET, []],
                    ],
                }),
            )

            await expect((await build(tx.em)).create(input)).resolves.toBe("c1")

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_CONNECTION, [
                "ws-1",
                "telegram",
                "Shop bot",
                "connected",
                "live",
                "user-1",
                '{"bot_id":"7"}',
            ])
            const sealed = tx.em.query.mock.calls.find(([text]) => text === INSERT_SECRET)?.[1] as Array<string>
            expect(sealed[0]).toBe("c1")
            expect(decryptSecret(KEY, sealed[1] ?? "")).toBe("token")
            expect(sealed[2]).toBe("hook")
            expect(tx.commits).toBe(1)
        })

        it("rolls the row back when the secret cannot be stored", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [INSERT_CONNECTION, [{ id: "c1" }]],
                        [INSERT_SECRET, []],
                    ],
                }),
            )
            tx.em.query.mockImplementation(async (text: string) => {
                if (text === INSERT_SECRET) throw new Error("secret failed")
                return [{ id: "c1" }]
            })

            await expect((await build(tx.em)).create(input)).rejects.toThrow("secret failed")
            expect(tx.rollbacks).toBe(1)
        })

        it("joins the transaction of the caller when one is handed in", async () => {
            const manager = mockEntityManager({
                query: [
                    [INSERT_CONNECTION, [{ id: "c2" }]],
                    [INSERT_SECRET, []],
                ],
            })
            const em = mockEntityManager()

            await expect((await build(em)).create(input, manager)).resolves.toBe("c2")
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a name that is too short and writes nothing", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).create({ ...input, name: " a " })).rejects.toMatchObject({
                code: ConnectionsErrorCode.NameInvalid,
            })
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
        it("opens the stored secret", async () => {
            const em = mockEntityManager({
                query: [FIND_SECRET, [{ ciphertext: encryptSecret(KEY, "token"), webhook_secret: "hook" }]],
            })

            await expect((await build(em)).readSecret("c1")).resolves.toEqual({ plain: "token", webhookSecret: "hook" })
        })

        it("answers null when there is no secret", async () => {
            const em = mockEntityManager({ query: [FIND_SECRET, []] })

            await expect((await build(em)).readSecret("c1")).resolves.toBeNull()
        })

        it("answers null when the secret cannot be opened with the current key", async () => {
            const em = mockEntityManager({
                query: [FIND_SECRET, [{ ciphertext: encryptSecret(randomBytes(32), "token"), webhook_secret: "hook" }]],
            })

            await expect((await build(em)).readSecret("c1")).resolves.toBeNull()
        })

        it("stores a sealed credential and replaces the webhook secret when one is given", async () => {
            const em = mockEntityManager({ query: [UPSERT_SECRET, []] })

            await (await build(em)).writeSecret("c1", "token", "hook")

            const args = em.query.mock.calls[0]?.[1] as Array<unknown>
            expect(decryptSecret(KEY, String(args[1]))).toBe("token")
            expect([args[0], args[2], args[3]]).toEqual(["c1", "hook", true])
        })

        it("keeps the webhook secret when none is given", async () => {
            const em = mockEntityManager({ query: [UPSERT_SECRET, []] })

            await (await build(em)).writeSecret("c1", "token")

            const args = em.query.mock.calls[0]?.[1] as Array<unknown>
            expect(String(args[2])).toMatch(/^[0-9a-f]{64}$/)
            expect(args[3]).toBe(false)
        })

        it("wipes the secret", async () => {
            const em = mockEntityManager({ query: [DELETE_SECRET, []] })

            await (await build(em)).wipeSecret("c1")

            expect(em.query).toHaveBeenCalledWith(DELETE_SECRET, ["c1"])
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
            const em = mockEntityManager({ query: [OWNER, [INSERT_CONNECTOR_INTEREST, []]] })

            await expect((await build(em)).wantConnector(actor, "shopee")).resolves.toBeUndefined()
            expect(em.query).toHaveBeenCalledWith(INSERT_CONNECTOR_INTEREST, ["ws-1", "shopee", "user-1"])
        })

        it("refuses a connector that is not planned", async () => {
            const em = mockEntityManager({ query: [OWNER] })

            await expect((await build(em)).wantConnector(actor, "sepay")).rejects.toMatchObject({
                code: ConnectionsErrorCode.ConnectorNotFound,
                params: { id: "sepay" },
            })
        })
    })
})
