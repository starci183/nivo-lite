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
import { CONNECTIONS_OPTIONS, CONNECTION_AGENTS } from "./connections.decorators"
import { ConnectionsUpkeepService } from "./connections-upkeep.service"
import { ConnectionsService } from "./connections.service"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import { ConnectionEntity } from "./persistence/entities"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { MemberSeatRecord, WorkspaceRole } from "@modules/domain/workspace-members"
import type { ConnectionAgentsDirectory } from "./connections.port"

/** The seat each manager's member read answers, as `memberOf` declared it while the builders were queued. */
const seatsOf = new WeakMap<MockEntityManager, MemberSeatRecord>()

/** The member read: an active seat of this role named Lan. */
interface SeatAnswer {
    readonly seat: MemberSeatRecord
}

const buildWith = async (entityManager: MockEntityManager, urls: Urls = {}, composed = true) => {
    const agents = mock<ConnectionAgentsDirectory>()
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeSeatOfUser.mockResolvedValue(seatsOf.get(entityManager) ?? null)
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
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: CONNECTION_AGENTS, useValue: composed ? agents : null },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionsService), secrets, interest, upkeep, seats, agents }
}
const build = async (entityManager: MockEntityManager, urls: Urls = {}) =>
    (await buildWith(entityManager, urls)).service
const { actor, forbidden, invalidName, missing } = connectionsCase
const INTAKE_ROW = { id: "c-1", workspaceId: "ws-1", status: "connected" }
const AT = "2026-10-12T01:00:00.000Z"

/** An entity manager whose query builders answer these terminals, in the order the subject opens them. */
const withBuilders = (
    answers: ReadonlyArray<Parameters<typeof queueQueryBuilders>[1][number] | SeatAnswer>,
    em: MockEntityManager = mockEntityManager(),
) => {
    const seated = answers.find((answer): answer is SeatAnswer => "seat" in answer)
    if (seated !== undefined) seatsOf.set(em, seated.seat)
    return {
        em,
        fakes: queueQueryBuilders(
            em,
            answers.filter((answer): answer is Exclude<typeof answer, SeatAnswer> => !("seat" in answer)),
        ),
    }
}
const memberOf = (role: WorkspaceRole): SeatAnswer => ({
    seat: { memberId: "m-1", userId: "user-1", role, displayName: "Lan", status: "active" },
})
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
        const { em } = withBuilders([memberOf("owner")])
        const { service, seats } = await buildWith(em)
        await expect(service.authorize(actor, ["owner"])).resolves.toEqual({
            role: "owner",
            displayName: "Lan",
        })
        expect(seats.activeSeatOfUser).toHaveBeenCalledWith("ws-1", "user-1")
    })

    it.each([
        { name: "refuses a caller who is not an active member", answer: undefined, roles: ["owner"] },
        { name: "refuses a member whose role is not listed", answer: memberOf("staff"), roles: ["owner", "manager"] },
    ] as const)("$name", async ({ answer, roles }) => {
        const { em } = withBuilders(answer === undefined ? [] : [answer])
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

describe("ConnectionsService > connectedProviders", () => {
    it("lists each provider the workspace is connected to, bounded", async () => {
        const { em, fakes } = withBuilders([{ getRawMany: [{ provider: "sepay" }, { provider: "telegram" }] }])
        await expect((await build(em)).connectedProviders("ws-1", 200)).resolves.toEqual(["sepay", "telegram"])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ConnectionEntity, "c")
        expect(fakes[0]?.callsOf("select")).toEqual([["c.provider", "provider"]])
        expect(fakes[0]?.callsOf("distinct")).toEqual([[true]])
        expect(whereOf(fakes[0])).toEqual([
            ["c.workspaceId = :workspaceId AND c.status <> 'disconnected'", { workspaceId: "ws-1" }],
        ])
        expect(fakes[0]?.callsOf("limit")).toEqual([[200]])
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
    it("asks the agents port for the attached agent ids, bounded", async () => {
        const { service, agents } = await buildWith(mockEntityManager())
        agents.agentIdsOf.mockResolvedValue(["agent-2", "agent-1"])

        await expect(service.agentIds("ws-1", "c1")).resolves.toEqual(["agent-2", "agent-1"])
        expect(agents.agentIdsOf).toHaveBeenCalledWith("ws-1", "c1", 500)
    })

    it("answers none when no agents are composed", async () => {
        const { service } = await buildWith(mockEntityManager(), {}, false)

        await expect(service.agentIds("ws-1", "c1")).resolves.toEqual([])
    })
})
