import { Test } from "@nestjs/testing"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ApiKeysService } from "./api-keys.service"
import { hashKey, RATE_LIMIT_PER_MINUTE } from "./api-keys.policy"
import {
    agentBoundKey,
    defaultKeyOfWorkspaceWs1,
    keyOf,
    keyView,
    keyWithoutId,
    keyWithoutWorkspace,
    loyaltyTillKey,
    revokedKey,
} from "@tests/fixtures/builders/api-keys.builder"
import { isSeatAnswer, memberOf } from "@tests/fixtures/builders/api-keys-seats.builder"
import type { SeatAnswer } from "@tests/fixtures/builders/api-keys-seats.builder"
import { ApiKeysErrorCode } from "./errors/api-keys.error"
import { ApiKeyEntity } from "./persistence/entities"

const API_KEY_AUTH = 'SELECT * FROM "public"."api_key_auth"($1)'

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const build = async (entityManager: MockEntityManager, agentStatus: string | null = "active") => {
    const agents = mock<AgentDirectoryService>()
    agents.statusOf.mockResolvedValue(agentStatus)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApiKeysService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:20.000Z") },
            { provide: EventsService, useValue: mock<EventsService>() },
            { provide: WorkspaceMemberSeatsService, useValue: mock<WorkspaceMemberSeatsService>() },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return moduleRef.get(ApiKeysService)
}

/** The rows the key lookup answers for this verdict of the database function. */
const verdictRows = (verdict: object | null) => [{ api_key_auth: verdict }]

const WORKING = { id: "key-1", workspace_id: "workspace-1", scopes: ["leads:read"] }

describe("ApiKeysService authenticate", () => {
    it("admits a working key with the hash of the bearer key as the only thing sent to the database", async () => {
        const em = mockEntityManager({ query: [API_KEY_AUTH, verdictRows({ ...WORKING, name: "n8n", hits: 3 })] })
        const keys = await build(em)

        await expect(keys.authenticate("leads:read", "Bearer nvk_secret")).resolves.toEqual({
            keyId: "key-1",
            workspaceId: "workspace-1",
            name: "n8n",
            scopes: ["leads:read"],
        })

        expect(em.query).toHaveBeenCalledWith(API_KEY_AUTH, [hashKey("nvk_secret")])
    })

    it("refuses a request with no bearer key without touching the database", async () => {
        const em = mockEntityManager()
        const keys = await build(em)

        await expect(keys.authenticate("leads:read")).rejects.toMatchObject({ code: ApiKeysErrorCode.Unauthorized })

        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a key no workspace issued and an answer with no row at all", async () => {
        const unknown = await build(mockEntityManager({ query: [API_KEY_AUTH, verdictRows(null)] }))
        const empty = await build(mockEntityManager({ query: [API_KEY_AUTH, []] }))

        await expect(unknown.authenticate("leads:read", "Bearer nvk_unknown")).rejects.toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        await expect(empty.authenticate("leads:read", "Bearer nvk_unknown")).rejects.toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
    })

    it("refuses a revoked key and a key over its budget with the parameters of the refusal", async () => {
        const revoked = await build(mockEntityManager({ query: [API_KEY_AUTH, verdictRows({ revoked: true })] }))
        const busy = await build(mockEntityManager({ query: [API_KEY_AUTH, verdictRows({ ...WORKING, hits: 61 })] }))

        await expect(revoked.authenticate("leads:read", "Bearer nvk_old")).rejects.toMatchObject({
            code: ApiKeysErrorCode.Revoked,
        })
        await expect(busy.authenticate("leads:read", "Bearer nvk_busy")).rejects.toMatchObject({
            code: ApiKeysErrorCode.RateLimited,
            params: { limit: 60, retryAfter: 40 },
        })
    })
})

/** Whatever FindOperator the active-key filter builds. */
const ANYTHING: unknown = expect.anything()

/** The answer of a write that returns `rows`. */
const wrote = (...rows: Array<ApiKeyEntity>): QueryBuilderAnswers => ({ execute: { raw: rows } })

const buildManagement = async (
    entityManager: MockEntityManager,
    answers: ReadonlyArray<QueryBuilderAnswers | SeatAnswer>,
    holdsAgent = true,
) => {
    const agents = mock<AgentDirectoryService>()
    agents.holds.mockResolvedValue(holdsAgent)
    const transaction = fakeTransaction(entityManager)
    const [first, ...rest] = answers
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeSeatOfUser.mockResolvedValue(
        isSeatAnswer(first) && first.seat.role !== undefined
            ? {
                  memberId: "member-1",
                  userId: "principal-1",
                  status: "active",
                  role: first.seat.role,
                  displayName: first.seat.displayName,
              }
            : null,
    )
    const fakes = queueQueryBuilders(
        entityManager,
        rest.filter((answer): answer is QueryBuilderAnswers => !isSeatAnswer(answer)),
    )
    const execute = entityManager.transaction.getMockImplementation()
    const managers: Array<EntityManager> = []
    entityManager.transaction.mockImplementation(
        (
            first: Parameters<EntityManager["transaction"]>[0] | Parameters<EntityManager["transaction"]>[1],
            second?: Parameters<EntityManager["transaction"]>[1],
        ) =>
            Promise.resolve(
                execute?.("READ COMMITTED", (manager) => {
                    managers.push(manager)
                    return Promise.resolve((typeof first === "function" ? first : second)?.(manager))
                }),
            ),
    )
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApiKeysService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:20.000Z") },
            { provide: EventsService, useValue: events },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(ApiKeysService), events, transaction, managers, fakes, seats, agents }
}

const REVOKE_WHERE = "id = :keyId AND workspace_id = :workspaceId AND revoked_at IS NULL"

describe("ApiKeysService management", () => {
    it("lists the workspace keys as public views for an owner", async () => {
        const em = mockEntityManager({ find: [ApiKeyEntity, [keyOf()]] })
        const { service, seats } = await buildManagement(em, [memberOf("owner")])

        await expect(service.listKeys("principal-1", "workspace-1")).resolves.toEqual([keyView])
        expect(seats.activeSeatOfUser).toHaveBeenCalledWith("workspace-1", "principal-1", em)
        expect(em.find).toHaveBeenCalledWith(ApiKeyEntity, {
            where: { workspaceId: "workspace-1" },
            order: { createdAt: "DESC" },
            take: 100,
        })
    })

    it.each([
        { member: undefined, reason: "a non-member" },
        { member: "staff", reason: "a staff member" },
    ] as const)("refuses $reason before reading the keys", async ({ member }) => {
        const em = mockEntityManager()
        const { service, events } = await buildManagement(em, [memberOf(member, "Staff")])

        await expect(service.listKeys("principal-1", "workspace-1")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotManager,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.find).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("rejects a short name before starting a transaction", async () => {
        const em = mockEntityManager()
        const { service, events } = await buildManagement(em, [])

        expect(thrownBy(() => service.createKey("principal-1", "workspace-1", " x "))).toEqual(
            objectLike({ code: ApiKeysErrorCode.NameTooShort }),
        )
        expect(em.transaction).not.toHaveBeenCalled()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })
})

describe("ApiKeysService management", () => {
    it.each([
        { active: 0, scenario: "the count query answers no key" },
        { active: 19, scenario: "one active slot remains" },
    ])("creates a key when $scenario", async ({ active }) => {
        const em = mockEntityManager({ count: [ApiKeyEntity, active] })
        const { service, events, transaction, managers, fakes } = await buildManagement(em, [
            memberOf("manager", "Manager"),
            wrote(keyOf()),
        ])

        const created = await service.createKey("principal-1", "workspace-1", "  Daily\n sync  ")

        expect(created.item).toEqual(keyView)
        expect(created.key).toMatch(/^nvk_[A-Za-z0-9_-]{43}$/u)
        expect(em.count).toHaveBeenCalledWith(ApiKeyEntity, {
            where: { workspaceId: "workspace-1", revokedAt: ANYTHING },
        })
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ApiKeyEntity, "ak")
        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "workspace-1",
                    name: "Daily sync",
                    keyPrefix: created.key.slice(0, 12),
                    keyHash: hashKey(created.key),
                    createdBy: "principal-1",
                },
            ],
        ])
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "workspace-1",
                kind: "api.key_created",
                actor: "Manager",
                summary: "API key created: Daily sync",
                evidence: created.key.slice(0, 12),
            },
            expect.anything(),
        )
        expect(managers).toHaveLength(1)
        expect(events.record.mock.calls[0]?.[1]).toBe(managers[0])
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("refuses creation at the active limit without inserting or recording an event", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 20] })
        const { service, events, transaction } = await buildManagement(em, [memberOf("owner")])

        await expect(service.createKey("principal-1", "workspace-1", "Daily sync")).rejects.toMatchObject({
            code: ApiKeysErrorCode.LimitReached,
            params: { limit: 20 },
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })
})

describe("ApiKeysService management", () => {
    it("refuses an insert that returns no key and leaves no creation event", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service, events, transaction } = await buildManagement(em, [memberOf("owner"), wrote()])

        await expect(service.createKey("principal-1", "workspace-1", "Daily sync")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotCreated,
        })
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it("revokes the requested workspace key and records the actor in the same transaction", async () => {
        const revokedAt = new Date("2026-10-12T10:00:20.000Z")
        const lastUsedAt = new Date("2026-10-12T09:00:00.000Z")
        const em = mockEntityManager()
        const { service, events, transaction, managers, fakes } = await buildManagement(em, [
            memberOf("manager", "Manager"),
            wrote(keyOf({ revokedAt, lastUsedAt })),
        ])

        await expect(service.revokeKey("principal-1", "workspace-1", "key-2")).resolves.toEqual({
            ...keyView,
            revokedAt: revokedAt.toISOString(),
            lastUsedAt: lastUsedAt.toISOString(),
        })
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ApiKeyEntity, "ak")
        expect(fakes[0]?.callsOf("where")).toEqual([[REVOKE_WHERE, { keyId: "key-2", workspaceId: "workspace-1" }]])
        expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0]).revokedAt).toBe("now()")
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "workspace-1",
                kind: "api.key_revoked",
                actor: "Manager",
                summary: "API key revoked: Daily sync",
                evidence: "nvk_stored12",
            },
            expect.anything(),
        )
        expect(managers).toHaveLength(1)
        expect(events.record.mock.calls[0]?.[1]).toBe(managers[0])
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("refuses revocation when the update answers no row list", async () => {
        const em = mockEntityManager()
        const { service, events } = await buildManagement(em, [memberOf("owner"), { execute: { raw: undefined } }])

        await expect(service.revokeKey("principal-1", "workspace-1", "missing")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotFound,
        })
        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses revocation of a missing active key without recording an event", async () => {
        const em = mockEntityManager()
        const { service, events, transaction, fakes } = await buildManagement(em, [memberOf("owner"), wrote()])

        await expect(service.revokeKey("principal-1", "workspace-1", "missing")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotFound,
        })
        expect(fakes[0]?.callsOf("where")).toEqual([[REVOKE_WHERE, { keyId: "missing", workspaceId: "workspace-1" }]])
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })
})

describe("ApiKeysService credential admission", () => {
    it("proves the stored credential without calling the rate-accounting function", async () => {
        const em = mockEntityManager({
            findOne: [ApiKeyEntity, loyaltyTillKey()],
        })
        const keys = await build(em)

        await expect(keys.verifyCredential("Bearer nvk_secret")).resolves.toEqual({
            keyId: "key-1",
            workspaceId: "ws-1",
            name: "Till",
            scopes: ["loyalty:read"],
        })
        expect(em.query).not.toHaveBeenCalled()
        expect(em.findOne).toHaveBeenCalledWith(ApiKeyEntity, {
            select: { id: true, workspaceId: true, name: true, scopes: true, revokedAt: true },
            where: { keyHash: hashKey("nvk_secret") },
        })
    })

    it("defaults optional descriptive fields without inventing scopes", async () => {
        const incomplete = Object.assign(defaultKeyOfWorkspaceWs1(), { name: undefined, scopes: undefined })
        const keys = await build(mockEntityManager({ findOne: [ApiKeyEntity, incomplete] }))

        await expect(keys.verifyCredential("Bearer nvk_secret")).resolves.toEqual({
            keyId: "key-1",
            workspaceId: "ws-1",
            name: "",
            scopes: [],
        })
    })

    it("rejects malformed credentials before any database call", async () => {
        const em = mockEntityManager()
        const keys = await build(em)

        await expect(keys.verifyCredential("Basic nvk_secret")).rejects.toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        expect(em.findOne).not.toHaveBeenCalled()
    })

    it.each([{ found: null }, { found: keyWithoutId() }, { found: keyWithoutWorkspace() }])(
        "rejects an unknown or incomplete key (%p)",
        async ({ found }) => {
            const keys = await build(mockEntityManager({ findOne: [ApiKeyEntity, found] }))

            await expect(keys.verifyCredential("Bearer nvk_secret")).rejects.toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })
        },
    )

    it("preserves the revoked-key refusal", async () => {
        const revoked = revokedKey()
        const keys = await build(mockEntityManager({ findOne: [ApiKeyEntity, revoked] }))

        await expect(keys.verifyCredential("Bearer nvk_secret")).rejects.toMatchObject({
            code: ApiKeysErrorCode.Revoked,
        })
    })
})

describe("ApiKeysService agent keys", () => {
    it("creates a key bound to an agent of the workspace with only the tools:call scope", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service, events, transaction, fakes, agents } = await buildManagement(em, [
            memberOf("owner"),
            wrote(agentBoundKey()),
        ])

        const created = await service.createKey("principal-1", "workspace-1", "Desk agent", "agent-1")

        expect(created.item).toEqual({ ...keyView, agentId: "agent-1" })
        expect(agents.holds).toHaveBeenCalledWith("workspace-1", "agent-1", expect.anything())
        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "workspace-1",
                    name: "Desk agent",
                    keyPrefix: created.key.slice(0, 12),
                    keyHash: hashKey(created.key),
                    createdBy: "principal-1",
                    agentId: "agent-1",
                    scopes: ["tools:call"],
                },
            ],
        ])
        expect(events.record).toHaveBeenCalledTimes(1)
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("refuses an agent that is not of the workspace and records nothing", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service, events, transaction } = await buildManagement(em, [memberOf("owner")], false)

        await expect(service.createKey("principal-1", "workspace-1", "Desk agent", "agent-9")).rejects.toMatchObject({
            code: ApiKeysErrorCode.AgentNotFound,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })
})

/** The row the agent key lookup answers. */
const agentRow = (changes: object = {}) => ({
    getRawOne: {
        id: "key-1",
        workspace_id: "ws-1",
        agent_id: "agent-1",
        scopes: ["tools:call"],
        revoked: false,
        ...changes,
    },
})

describe("ApiKeysService agent keys", () => {
    it.each([
        ["over", [{ api_key_auth: { hits: RATE_LIMIT_PER_MINUTE + 1 } }], ApiKeysErrorCode.RateLimited],
        ["at", [{ api_key_auth: { hits: RATE_LIMIT_PER_MINUTE } }], undefined],
        ["unanswered by", [], undefined],
    ])(
        "verifies an agent key by its hash and counts the call against its minute budget: a key %s it",
        async (_label, rows, code) => {
            const em = mockEntityManager({ query: [API_KEY_AUTH, rows] })
            const [fake] = queueQueryBuilders(em, [agentRow()])
            const keys = await build(em)

            const verified = keys.verifyAgentKey("Bearer nvk_secret")

            if (code === undefined) {
                await expect(verified).resolves.toEqual({ keyId: "key-1", workspaceId: "ws-1", agentId: "agent-1" })
            } else await expect(verified).rejects.toMatchObject({ code, params: { limit: RATE_LIMIT_PER_MINUTE } })
            expect(fake?.callsOf("where")).toEqual([["k.keyHash = :keyHash", { keyHash: hashKey("nvk_secret") }]])
            expect(em.query).toHaveBeenCalledWith(API_KEY_AUTH, [hashKey("nvk_secret")])
        },
    )

    it("refuses a malformed header before the database, and a revoked or unknown key without spending its budget", async () => {
        const em = mockEntityManager()
        const keys = await build(em)

        await expect(keys.verifyAgentKey("Bearer other")).rejects.toMatchObject({ code: ApiKeysErrorCode.Unauthorized })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()

        queueQueryBuilders(em, [{ getRawOne: undefined }, agentRow({ scopes: [], revoked: true })])
        await expect(keys.verifyAgentKey("Bearer nvk_secret")).rejects.toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        await expect(keys.verifyAgentKey("Bearer nvk_secret")).rejects.toMatchObject({ code: ApiKeysErrorCode.Revoked })
        expect(em.query).not.toHaveBeenCalled()
    })
})
