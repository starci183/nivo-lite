import { Secret } from "@modules/platform/config"
import type { Logger } from "@modules/platform/logging"
import { ROW, connectionsCase, siteUrlCases } from "@tests/fixtures/builders/connections.builder"
import type { Urls } from "@tests/fixtures/builders/connections.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedCalls, evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { FindOperator, Not } from "typeorm"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectorInterestService } from "@modules/domain/connector-interest"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import { CONNECTIONS_OPTIONS } from "./connections.decorators"
import { ConnectionsUpkeepService } from "./connections-upkeep.service"
import { ConnectionsService } from "./connections.service"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import { ConnectionEntity } from "./persistence/entities"
import { WorkspaceMemberEntity } from "@modules/domain/workspace-members"
import { AgentConnectionEntity } from "@modules/domain/agent-connections"

const buildWith = async (entityManager: MockEntityManager, urls: Urls = {}) => {
    const secrets = mock<ConnectionSecretsService>()
    const interest = mock<ConnectorInterestService>()
    const upkeep = mock<ConnectionsUpkeepService>()
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
            { provide: ConnectionsUpkeepService, useValue: upkeep },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionsService), secrets, interest, upkeep }
}
const build = async (entityManager: MockEntityManager, urls: Urls = {}) =>
    (await buildWith(entityManager, urls)).service
const { actor, forbidden, invalidName, missing } = connectionsCase
const INTAKE_ROW = { id: "c-1", workspaceId: "ws-1", status: "connected" }
const AT = "2026-10-12T01:00:00.000Z"

/** An entity manager whose query builders answer these terminals, in the order the subject opens them. */
const withBuilders = (
    answers: Parameters<typeof queueQueryBuilders>[1],
    em: MockEntityManager = mockEntityManager(),
) => ({
    em,
    fakes: queueQueryBuilders(em, answers),
})
const memberOf = (role: string) => ({ getRawOne: { role, displayName: "Lan" } })
const whereOf = (fake: FakeQueryBuilder | undefined) => fake?.callsOf("where")
const setOf = (fake: FakeQueryBuilder | undefined) => evaluatedValues(fake?.callsOf("set")[0]?.[0])

describe("ConnectionsService > addresses", () => {
    it.each(siteUrlCases)("trims trailing slashes and keeps the site path: %s", async (siteUrl, expected) => {
        const service = await build(mockEntityManager(), { siteUrl })
        expect(service.siteBase()).toBe(expected)
        expect(service.webhookUrl("telegram", "c1")).toBe(`${siteUrl.replace(/\/$/, "")}/api/telegram/c1`)
        expect(service.publicOrigin()).toBeNull()
    })

    it.each<Urls>([{}, { publicApiUrl: "https://api.nivo.vn/app" }])("uses public URL precedence: %p", async (api) => {
        const service = await build(mockEntityManager(), { publicSiteUrl: "https://nivo.vn/app", ...api })
        const provider = api.publicApiUrl ?? "https://nivo.vn/app"
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
        const { em, fakes } = withBuilders([memberOf("owner")])
        await expect((await build(em)).authorize(actor, ["owner"])).resolves.toEqual({
            role: "owner",
            displayName: "Lan",
        })
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceMemberEntity, "m")
        expect(whereOf(fakes[0])?.[0]?.[1]).toEqual({ workspaceId: "ws-1", userId: "user-1" })
    })

    it.each([
        { name: "refuses a caller who is not an active member", answer: {}, roles: ["owner"] },
        { name: "refuses a member whose role is not listed", answer: memberOf("staff"), roles: ["owner", "manager"] },
    ] as const)("$name", async ({ answer, roles }) => {
        const { em } = withBuilders([answer])
        await expect((await build(em)).authorize(actor, roles)).rejects.toMatchObject(forbidden)
    })
})

describe("ConnectionsService > find, get, findMany, list, listByProvider", () => {
    it("finds a connection of the workspace or null", async () => {
        const { em, fakes } = withBuilders([{ getRawOne: ROW }, { getRawOne: undefined }])
        const service = await build(em)
        await expect(service.find("ws-1", "c1")).resolves.toMatchObject({ id: "c1", workspaceId: "ws-1" })
        await expect(service.find("ws-1", "c9")).resolves.toBeNull()
        expect(whereOf(fakes[1])).toEqual([
            ["c.workspaceId = :workspaceId AND c.id = :id", { workspaceId: "ws-1", id: "c9" }],
        ])
    })

    it("finds through the manager it is handed", async () => {
        const { em: manager } = withBuilders([{ getRawOne: ROW }])
        const root = mockEntityManager()
        await expect((await build(root)).find("ws-1", "c1", manager)).resolves.toMatchObject({ id: "c1" })
        expect(root.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("gets a connection, and answers not found for a missing one", async () => {
        const { em } = withBuilders([{ getRawOne: ROW }, { getRawOne: undefined }])
        const service = await build(em)
        await expect(service.get("ws-1", "c1")).resolves.toMatchObject({ id: "c1" })
        await expect(service.get("ws-1", "c9")).rejects.toMatchObject({
            code: ConnectionsErrorCode.NotFound,
            params: { id: "c9" },
        })
    })

    it("finds several by id, oldest first and bounded", async () => {
        const { em, fakes } = withBuilders([{ getRawMany: [ROW] }])
        await expect((await build(em)).findMany("ws-1", ["c1", "c2"])).resolves.toHaveLength(1)
        expect(whereOf(fakes[0])?.[0]?.[1]).toEqual({ workspaceId: "ws-1", ids: ["c1", "c2"] })
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["c.createdAt"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[500]])
    })

    it("lists the workspace connections without the Drive grant", async () => {
        const { em, fakes } = withBuilders([{ getRawMany: [ROW, ROW] }])
        await expect((await build(em)).list("ws-1")).resolves.toHaveLength(2)
        expect(whereOf(fakes[0])?.[0]?.[0]).toContain("c.provider <> 'google_drive'")
    })

    it.each([
        { includeDisconnected: true, clause: "true" },
        { includeDisconnected: false, clause: "c.status <> 'disconnected'" },
    ])("lists one provider with the disconnected %j", async ({ includeDisconnected, clause }) => {
        const { em, fakes } = withBuilders([{ getRawMany: [ROW] }])
        const service = await build(em)
        await expect(service.listByProvider("ws-1", "sepay", { includeDisconnected })).resolves.toHaveLength(1)
        expect(whereOf(fakes[0])?.[0]?.[1]).toEqual({ workspaceId: "ws-1", provider: "sepay" })
        expect(fakes[0]?.callsOf("andWhere")).toEqual([[clause]])
    })
})

describe("ConnectionsService > findLiveByMeta", () => {
    it("answers the live owner of a public fact, or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [ConnectionEntity, Object.assign(new ConnectionEntity(), { id: "c9", workspaceId: "ws-9" })],
                [ConnectionEntity, null],
            ],
        })
        const service = await build(em)
        await expect(service.findLiveByMeta("telegram", "bot_id", "42")).resolves.toEqual({
            id: "c9",
            workspaceId: "ws-9",
        })
        await expect(service.findLiveByMeta("meta", "page_id", "1")).resolves.toBeNull()
        const [entity, options] = em.findOne.mock.calls[0] ?? []
        expect(entity).toBe(ConnectionEntity)
        expect(options).toMatchObject({
            where: { provider: "telegram", status: Not("disconnected") },
            select: { id: true, workspaceId: true },
            order: { createdAt: "ASC" },
        })
        const fact: unknown = Reflect.get(Object(Reflect.get(Object(options), "where")), "publicMeta")
        expect(fact).toBeInstanceOf(FindOperator)
        if (!(fact instanceof FindOperator)) return
        expect(fact.getSql?.("co.public_meta")).toBe("co.public_meta ->> :key = :value")
        expect(fact.objectLiteralParameters).toEqual({ key: "bot_id", value: "42" })
    })
})

describe("ConnectionsService > agentIds", () => {
    it("returns the attached agent ids in row order, or an empty list", async () => {
        const { em, fakes } = withBuilders([
            { getRawMany: [{ agentId: "agent-2" }, { agentId: "agent-1" }] },
            { getRawMany: [] },
        ])
        const service = await build(em)
        await expect(service.agentIds("ws-1", "c1")).resolves.toEqual(["agent-2", "agent-1"])
        await expect(service.agentIds("ws-1", "c9")).resolves.toEqual([])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AgentConnectionEntity, "a")
        expect(whereOf(fakes[1])?.[0]?.[1]).toEqual({ workspaceId: "ws-1", connectionId: "c9" })
    })
})

describe("ConnectionsService > create", () => {
    const input = connectionsCase.createInput
    it("writes the row and the sealed secret in one transaction", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { fakes } = withBuilders([{ execute: { raw: [{ id: "c1" }] } }], tx.em)
        const { service, secrets } = await buildWith(tx.em)
        await expect(service.create(input)).resolves.toBe("c1")
        expect(tx.em.createQueryBuilder).toHaveBeenCalledWith(ConnectionEntity, "co")
        expect(evaluatedValues(fakes[0]?.callsOf("values")[0]?.[0])).toEqual({
            workspaceId: "ws-1",
            provider: "telegram",
            name: "Shop bot",
            status: "connected",
            environment: "live",
            createdBy: "user-1",
            publicMeta: ":meta::jsonb",
        })
        expect(fakes[0]?.callsOf("setParameter")).toEqual([["meta", '{"bot_id":"7"}']])
        expect(fakes[0]?.callsOf("returning")).toEqual([["id"]])
        expect(secrets.create).toHaveBeenCalledWith("c1", "token", "hook", expect.anything())
        expect(tx.commits).toBe(1)
    })

    it("rolls the row back when the secret cannot be stored", async () => {
        const tx = fakeTransaction(mockEntityManager())
        withBuilders([{ execute: { raw: [{ id: "c1" }] } }], tx.em)
        const { service, secrets } = await buildWith(tx.em)
        const failed = new ConnectionsError({ code: ConnectionsErrorCode.NotFound })
        secrets.create.mockRejectedValue(failed)
        await expect(service.create(input)).rejects.toBe(failed)
        expect(tx.rollbacks).toBe(1)
    })

    it("joins the transaction of the caller when one is handed in", async () => {
        const { em: manager } = withBuilders([{ execute: { raw: [{ id: "c2" }] } }])
        const em = mockEntityManager()
        await expect((await build(em)).create(input, manager)).resolves.toBe("c2")
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a name that is too short and writes nothing", async () => {
        const em = mockEntityManager()
        const service = await build(em)
        expect(() => service.create({ ...input, name: " a " })).toThrow(ConnectionsErrorCode.NameInvalid)
    })

    it("fails when the insert answers no row", async () => {
        const tx = fakeTransaction(mockEntityManager())
        withBuilders([{ execute: { raw: [] } }], tx.em)
        await expect((await build(tx.em)).create(input)).rejects.toMatchObject(missing)
    })
})

describe("ConnectionsService > patch", () => {
    it("changes the given fields", async () => {
        const { em, fakes } = withBuilders([{ execute: { raw: [{ id: "c1" }] } }])
        await (
            await build(em)
        ).patch("ws-1", "c1", {
            name: " New ",
            status: "error",
            environment: "test",
            meta: { a: "b" },
            lastError: null,
        })
        expect(setOf(fakes[0])).toEqual({
            name: "New",
            status: "error",
            environment: "test",
            publicMeta: ":meta::jsonb",
            lastError: null,
            updatedAt: "now()",
        })
        expect(whereOf(fakes[0])).toEqual([[{ workspaceId: "ws-1", id: "c1" }]])
        expect(fakes[0]?.callsOf("setParameter")).toEqual([["meta", '{"a":"b"}']])
    })

    it("leaves every absent field alone", async () => {
        const { em, fakes } = withBuilders([{ execute: { raw: [{ id: "c1" }] } }])
        await (await build(em)).patch("ws-1", "c1", {})
        expect(setOf(fakes[0])).toEqual({ updatedAt: "now()" })
        expect(fakes[0]?.callsOf("setParameter")).toEqual([["meta", null]])
    })

    it("refuses a name that is too short", async () => {
        await expect((await build(mockEntityManager())).patch("ws-1", "c1", { name: "x" })).rejects.toMatchObject(
            invalidName,
        )
    })

    it("answers not found for a connection of another workspace", async () => {
        const { em } = withBuilders([{ execute: { raw: [] } }])
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
        const { em, fakes } = withBuilders([{ execute: { raw: [{ id: "c1" }] } }])
        await expect((await build(em)).remove("ws-1", "c1")).resolves.toBeUndefined()
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ConnectionEntity, "co")
        expect(whereOf(fakes[0])).toEqual([[{ workspaceId: "ws-1", id: "c1" }]])
    })

    it("answers not found for a connection that is not there", async () => {
        const { em } = withBuilders([{ execute: { raw: [] } }])
        await expect((await build(em)).remove("ws-1", "c9")).rejects.toMatchObject(missing)
    })
})

describe("ConnectionsService > recordEvent", () => {
    it("writes the connection event on the supplied consumer transaction", async () => {
        const root = mockEntityManager()
        const tx = fakeTransaction(mockEntityManager())
        const { fakes } = withBuilders([{ execute: { raw: [{ name: "Bank", environment: "live" }] } }], tx.em)
        const service = await build(root)
        const event = { amount: 5, content: "hi", at: AT }

        await expect(tx.em.transaction((manager) => service.recordEvent("c1", event, manager))).resolves.toEqual({
            name: "Bank",
            environment: "live",
        })

        expect(root.createQueryBuilder).not.toHaveBeenCalled()
        expect(fakes[0]?.callsOf("setParameters")).toEqual([[{ at: AT, first: JSON.stringify(event) }]])
        expect(tx.commits).toBe(1)
    })

    const rounded = '{"amount":100,"content":"hi","at":"2026-10-12T01:00:00.000Z","text":"t"}'
    const withoutText = '{"amount":5,"content":"hi","at":"2026-10-12T01:00:00.000Z"}'
    it.each([
        {
            name: "records the event with the amount rounded and answers the name and environment",
            environment: "test",
            event: { amount: 100.4, content: "hi", at: AT, text: "t" },
            serialized: rounded,
        },
        {
            name: "answers a live connection and leaves the text out when there is none",
            environment: "live",
            event: { amount: 5, content: "hi", at: AT },
            serialized: withoutText,
        },
    ] as const)("$name", async ({ environment, event, serialized }) => {
        const { em, fakes } = withBuilders([{ execute: { raw: [{ name: "Bank", environment }] } }])
        await expect((await build(em)).recordEvent("c1", event)).resolves.toEqual({ name: "Bank", environment })
        expect(fakes[0]?.callsOf("setParameters")).toEqual([[{ at: AT, first: serialized }]])
        expect(setOf(fakes[0])).toMatchObject({
            lastError: null,
            status: "CASE WHEN status IN ('pending', 'error') THEN 'connected' ELSE status END",
            firstEvent: "COALESCE(first_event, :first::jsonb)",
        })
        expect(fakes[0]?.callsOf("returning")).toEqual([["name, environment"]])
    })

    it("names a connection whose row carries no text name as an empty name", async () => {
        const { em } = withBuilders([{ execute: { raw: [{ environment: "live" }] } }])
        await expect((await build(em)).recordEvent("c1", { amount: 5, content: "hi", at: AT })).resolves.toEqual({
            name: "",
            environment: "live",
        })
    })

    it("answers null for a connection that does not exist", async () => {
        const { em } = withBuilders([{ execute: { raw: [] } }])
        await expect((await build(em)).recordEvent("c9", { amount: 5, content: "hi", at: AT })).resolves.toBeNull()
    })
})

describe("ConnectionsService > firstEvent", () => {
    it("answers the status and first event to a manager", async () => {
        const first = { amount: 5, content: "hi", at: AT }
        const { em } = withBuilders([
            memberOf("manager"),
            { getRawOne: { ...ROW, firstEvent: first, status: "connected" } },
        ])
        await expect((await build(em)).firstEvent(actor, "c1")).resolves.toEqual({
            status: "connected",
            firstEvent: first,
        })
    })

    it("refuses a member who is neither owner nor manager", async () => {
        const { em } = withBuilders([memberOf("staff")])
        await expect((await build(em)).firstEvent(actor, "c1")).rejects.toMatchObject(forbidden)
    })
})

describe("ConnectionsService > wantConnector", () => {
    it("records interest in a planned connector once", async () => {
        const { em } = withBuilders([memberOf("owner")])
        const { service, interest } = await buildWith(em)
        await expect(service.wantConnector(actor, "shopee")).resolves.toBeUndefined()
        expect(interest.note).toHaveBeenCalledWith("ws-1", "shopee", "user-1")
    })

    it("refuses a connector that is not planned", async () => {
        const { em } = withBuilders([memberOf("owner")])
        await expect((await build(em)).wantConnector(actor, "sepay")).rejects.toMatchObject({
            code: ConnectionsErrorCode.ConnectorNotFound,
            params: { id: "sepay" },
        })
    })
})

describe("ConnectionsService > intake", () => {
    it("answers the connection of the provider through the manager it is given, or refuses", async () => {
        const em = mockEntityManager({
            findOne: [
                [ConnectionEntity, Object.assign(new ConnectionEntity(), INTAKE_ROW)],
                [ConnectionEntity, null],
            ],
        })
        const inside = mockEntityManager({
            findOne: [
                ConnectionEntity,
                Object.assign(new ConnectionEntity(), { id: "c-2", workspaceId: "ws-1", status: "pending" }),
            ],
        })
        const service = await build(em)
        await expect(service.intakeOf("c-1", "telegram")).resolves.toEqual({ kind: "ok", value: INTAKE_ROW })
        await expect(service.intakeOf("c-2", "zalo_oa", inside)).resolves.toMatchObject({
            value: { id: "c-2", status: "pending" },
        })
        await expect(service.intakeOf("c-1", "telegram")).resolves.toEqual({
            kind: "refused",
            code: ConnectionsErrorCode.NotFound,
            params: undefined,
        })
        expect(evaluatedCalls(em.findOne.mock.calls.slice(0, 1))).toEqual([
            [
                "ConnectionEntity",
                {
                    where: { id: "c-1", provider: "telegram", status: Not("disconnected") },
                    select: { id: true, workspaceId: true, status: true },
                },
            ],
        ])
    })

    it("marks failing, received and Zalo-authorized connections", async () => {
        const em = mockEntityManager({ update: [ConnectionEntity, { affected: 1 }] })
        const { em: inside, fakes: received } = withBuilders([{ execute: {} }])
        const { fakes: zalo } = withBuilders([{ execute: {} }, { execute: {} }], em)
        const first = { amount: 0, content: "Minh", at: AT, text: "Hi" }
        const service = await build(em)
        await service.markFailing("c-1", "Reconnect")
        await service.markReceived("c-1", first, inside)
        await service.applyZaloAuthorization("c-1", "oa-9")
        await service.applyZaloAuthorization("c-1")
        expect(evaluatedCalls(em.update.mock.calls, 2)).toEqual([
            ["ConnectionEntity", { id: "c-1" }, { status: "error", lastError: "Reconnect", updatedAt: "now()" }],
        ])
        expect(received[0]?.callsOf("setParameter")).toEqual([["first", JSON.stringify(first)]])
        expect(setOf(received[0])).toEqual({
            lastEventAt: "now()",
            updatedAt: "now()",
            status: "CASE WHEN status IN ('pending', 'error') THEN 'connected' ELSE status END",
            lastError: "CASE WHEN status IN ('pending', 'error') THEN NULL ELSE last_error END",
            firstEvent: "COALESCE(first_event, :first::jsonb)",
        })
        expect(setOf(zalo[0])).toEqual({
            publicMeta: "jsonb_concat(public_meta, CAST(:meta AS jsonb))",
            status: "CASE WHEN status = 'error' THEN 'connected' ELSE status END",
            lastError: null,
            updatedAt: "now()",
        })
        expect(zalo.map((fake) => fake.callsOf("setParameter")[0])).toEqual([
            ["meta", '{"authorized":true,"oa_id":"oa-9"}'],
            ["meta", '{"authorized":true}'],
        ])
    })
})

describe("ConnectionsService > upkeep", () => {
    it("hands the health check, the sync schedule and the default SMTP to the upkeep owner", async () => {
        const { service, upkeep } = await buildWith(mockEntityManager())
        const mark = { state: "silent" as const, reason: "no event for 80h", checkedAt: AT }
        upkeep.healthBatch.mockResolvedValue([])
        upkeep.scheduleOf.mockResolvedValue({ everyMinutes: 15, lastSyncAt: null })
        upkeep.claimDueSyncs.mockResolvedValue([{ id: "c1", workspaceId: "ws-1" }])
        upkeep.defaultSmtpId.mockResolvedValue("c3")
        await expect(service.healthBatch("", 100)).resolves.toEqual([])
        await expect(service.scheduleOf("ws-1", "c1")).resolves.toEqual({ everyMinutes: 15, lastSyncAt: null })
        await expect(service.claimDueSyncs(["smtp"], 2)).resolves.toEqual([{ id: "c1", workspaceId: "ws-1" }])
        await expect(service.defaultSmtpId("ws-1")).resolves.toBe("c3")
        await service.markHealth("c1", mark)
        await service.setSchedule("ws-1", "c1", null)
        await service.markSynced("c1", { items: "3" })
        await service.markSyncFailed("c1", "Expired token")
        await service.setDefaultSmtp("ws-1", "c3")
        expect(upkeep.healthBatch.mock.calls).toEqual([["", 100]])
        expect(upkeep.markHealth.mock.calls).toEqual([["c1", mark]])
        expect(upkeep.setSchedule.mock.calls).toEqual([["ws-1", "c1", null]])
        expect(upkeep.markSynced.mock.calls).toEqual([["c1", { items: "3" }]])
        expect(upkeep.markSyncFailed.mock.calls).toEqual([["c1", "Expired token"]])
        expect(upkeep.setDefaultSmtp.mock.calls).toEqual([["ws-1", "c3"]])
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
        const { em, fakes } = withBuilders([{ execute: {} }])
        const service = await build(em)
        const settlement = { command, state, url, code, oaSecretSaved }
        await expect(service.settleWizard("c-1", "t", settlement)).resolves.toBeUndefined()
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            ["public_meta -> 'wizard' ->> 'ticket' = :ticket", { ticket: "t" }],
        ])
        expect(fakes[0]?.callsOf("setParameter")).toEqual([["facts", facts]])
        expect(setOf(fakes[0])).toEqual({
            publicMeta: "jsonb_concat(public_meta, CAST(:facts AS jsonb))",
            updatedAt: "now()",
        })
        expect(whereOf(fakes[0])).toEqual([[{ id: "c-1" }]])
    })
})
