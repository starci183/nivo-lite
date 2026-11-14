import { Test } from "@nestjs/testing"
import { apiKeySecretSha256, issueApiKey, parseApiKey } from "@modules/integrations/passport"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ApiKeysService } from "./api-keys.service"
import { API_KEYS_OPTIONS } from "./api-keys.port"
import { RATE_LIMIT_PER_MINUTE } from "./api-keys.policy"
import {
    agentScopedMcpKey,
    keyOf,
    keyView,
} from "@tests/fixtures/builders/api-keys.builder"
import { isSeatAnswer, memberOf } from "@tests/fixtures/builders/api-keys-seats.builder"
import type { SeatAnswer } from "@tests/fixtures/builders/api-keys-seats.builder"
import { ApiKeysError, ApiKeysErrorCode } from "./errors/api-keys.error"
import { ApiKeyEntity } from "./persistence/entities"

const API_KEY_AUTH = 'SELECT * FROM "public"."api_key_auth"($1)'
/** A well-formed key id no key row has. */
const UNKNOWN_KEY_ID = "3f6c1d52-8b4a-4c0e-9d57-2a1e7b9c4f08"

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

const build = async (entityManager: MockEntityManager, agentStatus: string | null = "active", holderRole: WorkspaceRole | null = "owner") => {
    const agents = mock<AgentDirectoryService>()
    agents.statusOf.mockResolvedValue(agentStatus)
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeSeatOfUser.mockResolvedValue(
        holderRole === null
            ? null
            : { memberId: "member-1", userId: "user-1", role: holderRole, displayName: "Lan", status: "active" },
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApiKeysService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:20.000Z") },
            { provide: EventsService, useValue: mock<EventsService>() },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: API_KEYS_OPTIONS, useValue: {} },
        ],
    }).compile()
    return moduleRef.get(ApiKeysService)
}

/** The rows the key lookup answers for this verdict of the database function. */
const verdictRows = (verdict: object | null) => [{ api_key_auth: verdict }]

/** A key issued the way the keys page issues one: the text shown once, its id and the secret hash its row stores. */
const issueKey = (id?: string) => {
    const issued = issueApiKey({ prefix: "nvk_", ...(id === undefined ? {} : { id }) })
    return { id: issued.id, text: issued.key.reveal(), hash: issued.secretSha256 }
}
type Issued = ReturnType<typeof issueKey>

const bearerOf = (issued: Issued): string => `Bearer ${issued.text}`

/** The stored row of an issued key: found by its id, the hash of its SECRET kept. */
const storedAs = (issued: Issued, changes: Partial<ApiKeyEntity> = {}): ApiKeyEntity =>
    keyOf({ id: issued.id, keyHash: issued.hash, ...changes })

/** The key text a pre-`@starci/auth` build issued: the prefix and 43 characters, no id part and no dot. */
const OLD_FORMAT_KEY = `nvk_${"a".repeat(43)}`

const REVOKED_AT = new Date("2026-10-12T10:00:00.000Z")

describe("ApiKeysService authenticate", () => {
    it("admits a new key: found by its id, its secret proved against the stored hash, the rate counted on that hash only after", async () => {
        const issued = issueKey()
        const em = mockEntityManager({
            findOne: [ApiKeyEntity, storedAs(issued, { workspaceId: "workspace-1", name: "n8n", scopes: ["leads:read"] })],
            query: [API_KEY_AUTH, verdictRows({ hits: 3 })],
        })
        const keys = await build(em)

        await expect(keys.authenticate("leads:read", bearerOf(issued))).resolves.toEqual({
            keyId: issued.id,
            workspaceId: "workspace-1",
            name: "n8n",
            scopes: ["leads:read"],
        })

        expect(em.findOne).toHaveBeenCalledWith(ApiKeyEntity, expect.objectContaining({ where: { id: issued.id } }))
        expect(em.query).toHaveBeenCalledWith(API_KEY_AUTH, [issued.hash])
    })

    it("refuses a request with no bearer key without touching the database", async () => {
        const em = mockEntityManager()
        const keys = await build(em)

        await expect(keys.authenticate("leads:read")).rejects.toMatchObject({ code: ApiKeysErrorCode.Unauthorized })

        expect(em.findOne).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([
        ["an old-format key (no id part: there is no legacy whole-key lookup)", `Bearer ${OLD_FORMAT_KEY}`],
        ["a key whose id part is no uuid", `Bearer nvk_not-a-uuid.${"s".repeat(43)}`],
        ["a key without the prefix", `Bearer ${UNKNOWN_KEY_ID}.${"s".repeat(43)}`],
        ["another scheme", `Basic nvk_${UNKNOWN_KEY_ID}.${"s".repeat(43)}`],
    ])("refuses %s before any database call", async (_label, header) => {
        const em = mockEntityManager()
        const keys = await build(em)

        await expect(keys.authenticate("leads:read", header)).rejects.toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })

        expect(em.findOne).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses an unknown id and a wrong secret as unauthorized, without counting the rate", async () => {
        const issued = issueKey()
        const unknown = mockEntityManager({ findOne: [ApiKeyEntity, null] })
        const wrong = mockEntityManager({ findOne: [ApiKeyEntity, storedAs(issued)] })

        await expect((await build(unknown)).authenticate("leads:read", bearerOf(issued))).rejects.toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        await expect(
            (await build(wrong)).authenticate("leads:read", bearerOf(issueKey(issued.id))),
        ).rejects.toMatchObject({ code: ApiKeysErrorCode.Unauthorized })

        expect(unknown.query).not.toHaveBeenCalled()
        expect(wrong.query).not.toHaveBeenCalled()
    })

    it("refuses a revoked key as revoked, and a scope the key lacks, both without counting the rate", async () => {
        const issued = issueKey()
        const revoked = mockEntityManager({ findOne: [ApiKeyEntity, storedAs(issued, { revokedAt: REVOKED_AT })] })
        const lacking = mockEntityManager({ findOne: [ApiKeyEntity, storedAs(issued, { scopes: ["leads:read"] })] })

        await expect((await build(revoked)).authenticate("leads:read", bearerOf(issued))).rejects.toMatchObject({
            code: ApiKeysErrorCode.Revoked,
        })
        await expect((await build(lacking)).authenticate("events:read", bearerOf(issued))).rejects.toMatchObject({
            code: ApiKeysErrorCode.ScopeMissing,
            params: { scope: "events:read" },
        })

        expect(revoked.query).not.toHaveBeenCalled()
        expect(lacking.query).not.toHaveBeenCalled()
    })

    it("refuses a key over its minute budget with the parameters of the refusal, and admits one at it", async () => {
        const issued = issueKey()
        const row = storedAs(issued, { scopes: ["leads:read"] })
        const busy = await build(
            mockEntityManager({ findOne: [ApiKeyEntity, row], query: [API_KEY_AUTH, verdictRows({ hits: 61 })] }),
        )
        const edge = await build(
            mockEntityManager({ findOne: [ApiKeyEntity, row], query: [API_KEY_AUTH, verdictRows({ hits: 60 })] }),
        )

        await expect(busy.authenticate("leads:read", bearerOf(issued))).rejects.toMatchObject({
            code: ApiKeysErrorCode.RateLimited,
            params: { limit: 60, retryAfter: 40 },
        })
        await expect(edge.authenticate("leads:read", bearerOf(issued))).resolves.toMatchObject({ keyId: issued.id })
    })
})

/** What a key text shown at creation holds: its id and its secret. */
interface ShownKey {
    readonly id: string
    readonly secret: string
}

/** The id and the secret of a key text shown at creation. */
const shownKey = (key: string): ShownKey => {
    const parsed = parseApiKey(key, "nvk_")
    if (parsed === null) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
    return { id: parsed.keyId, secret: parsed.secret }
}

/** Whatever FindOperator the active-key filter builds. */
const ANYTHING: unknown = expect.anything()

/** The answer of a write that returns `rows`. */
const wrote = (...rows: Array<ApiKeyEntity>): QueryBuilderAnswers => ({ execute: { raw: rows } })

const buildManagement = async (
    entityManager: MockEntityManager,
    answers: ReadonlyArray<QueryBuilderAnswers | SeatAnswer>,
    holdsAgent = true,
    mcpPublicUrl?: string,
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
    seats.activeSeats.mockResolvedValue([])
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
            { provide: API_KEYS_OPTIONS, useValue: { mcpPublicUrl } },
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

    it("refuses a staff member the listing: staff see nothing of the keys block", async () => {
        const em = mockEntityManager()
        const { service } = await buildManagement(em, [memberOf("staff", "Lan")])

        await expect(service.listKeys("principal-1", "workspace-1")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotManager,
        })
        expect(em.find).not.toHaveBeenCalled()
    })

    it("lists a manager every key of the workspace, holders named", async () => {
        const em = mockEntityManager({ find: [ApiKeyEntity, [keyOf({ scopes: ["mcp"] })]] })
        const { service, seats } = await buildManagement(em, [memberOf("manager", "Lan")], true, "https://mcp.nivo.test/")
        seats.activeSeats.mockResolvedValue([{ userId: "principal-1", displayName: "Lan", role: "manager" }])

        await expect(service.listKeys("principal-1", "workspace-1")).resolves.toEqual([
            { ...keyView, kind: "mcp", holderName: "Lan", endpointUrl: "https://mcp.nivo.test/mcp" },
        ])
        expect(em.find).toHaveBeenCalledWith(ApiKeyEntity, {
            where: { workspaceId: "workspace-1" },
            order: { createdAt: "DESC" },
            take: 100,
        })
    })

    it("lists an MCP key as suspended with the reason while its holder is staff or gone, and active again once re-promoted", async () => {
        const rows = [
            keyOf({ id: "k-staff", scopes: ["mcp"], createdBy: "u-staff" }),
            keyOf({ id: "k-gone", scopes: ["mcp"], createdBy: "u-gone" }),
            keyOf({ id: "k-manager", scopes: ["mcp"], createdBy: "u-manager" }),
            keyOf({
                id: "k-revoked",
                scopes: ["mcp"],
                createdBy: "u-staff",
                revokedAt: new Date("2026-10-12T10:00:00.000Z"),
            }),
            keyOf({ id: "k-public", scopes: ["leads:read"], createdBy: "u-staff" }),
        ]
        const em = mockEntityManager({ find: [ApiKeyEntity, rows] })
        const { service, seats } = await buildManagement(em, [memberOf("owner")])
        seats.activeSeats.mockResolvedValue([
            { userId: "u-staff", displayName: "Sam", role: "staff" },
            { userId: "u-manager", displayName: "Mai", role: "manager" },
        ])

        const listed = await service.listKeys("principal-1", "workspace-1")
        expect(listed.map((key) => [key.id, key.inactiveReason])).toEqual([
            ["k-staff", "holder_not_manager"],
            ["k-gone", "holder_gone"],
            ["k-manager", null],
            ["k-revoked", null],
            ["k-public", null],
        ])

        seats.activeSeats.mockResolvedValue([{ userId: "u-staff", displayName: "Sam", role: "manager" }])
        const again = await service.listKeys("principal-1", "workspace-1")
        expect(again[0]?.inactiveReason).toBeNull()
    })

    it("refuses a non-member before reading the keys", async () => {
        const em = mockEntityManager()
        const { service, events } = await buildManagement(em, [memberOf(undefined, "Staff")])

        await expect(service.listKeys("principal-1", "workspace-1")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotMember,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.find).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("rejects a short name before starting a transaction", async () => {
        const em = mockEntityManager()
        const { service, events } = await buildManagement(em, [])

        expect(thrownBy(() => service.createKey("principal-1", "workspace-1", " x ", "public_api"))).toEqual(
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

        const created = await service.createKey("principal-1", "workspace-1", "  Daily\n sync  ", "public_api")

        expect(created.item).toEqual({ ...keyView, holderName: "Manager" })
        expect(created.key).toMatch(/^nvk_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/u)
        expect(em.count).toHaveBeenCalledWith(ApiKeyEntity, {
            where: { workspaceId: "workspace-1", revokedAt: ANYTHING },
        })
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ApiKeyEntity, "ak")
        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    id: shownKey(created.key).id,
                    workspaceId: "workspace-1",
                    name: "Daily sync",
                    keyPrefix: created.key.slice(0, 12),
                    keyHash: apiKeySecretSha256(shownKey(created.key).secret),
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

    it("creates a public API key (no MCP scope, no agent) when the caller names no kind", async () => {
        const { service, fakes } = await buildManagement(mockEntityManager({ count: [ApiKeyEntity, 0] }), [
            memberOf("manager", "Manager"),
            wrote(keyOf()),
        ])

        await service.createKey("principal-1", "workspace-1", "Daily sync", undefined)

        expect(fakes[0]?.callsOf("values")).toEqual([[expect.not.objectContaining({ scopes: ANYTHING })]])
        expect(fakes[0]?.callsOf("values")).toEqual([[expect.not.objectContaining({ agentId: ANYTHING })]])
    })

    it("refuses creation at the active limit without inserting or recording an event", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 20] })
        const { service, events, transaction } = await buildManagement(em, [memberOf("owner")])

        await expect(service.createKey("principal-1", "workspace-1", "Daily sync", "public_api")).rejects.toMatchObject(
            {
                code: ApiKeysErrorCode.LimitReached,
                params: { limit: 20 },
            },
        )
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })
})

describe("ApiKeysService management", () => {
    it("refuses an insert that returns no key and leaves no creation event", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service, events, transaction } = await buildManagement(em, [memberOf("owner"), wrote()])

        await expect(service.createKey("principal-1", "workspace-1", "Daily sync", "public_api")).rejects.toMatchObject(
            {
                code: ApiKeysErrorCode.NotCreated,
            },
        )
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it("revokes the requested workspace key and records the actor in the same transaction", async () => {
        const revokedAt = new Date("2026-10-12T10:00:20.000Z")
        const lastUsedAt = new Date("2026-10-12T09:00:00.000Z")
        const em = mockEntityManager({ findOne: [ApiKeyEntity, keyOf()] })
        const { service, events, transaction, managers, fakes } = await buildManagement(em, [
            memberOf("manager", "Manager"),
            wrote(keyOf({ revokedAt, lastUsedAt })),
        ])

        await expect(service.revokeKey("principal-1", "workspace-1", "key-2")).resolves.toEqual({
            ...keyView,
            holderName: "Manager",
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
        const em = mockEntityManager({ findOne: [ApiKeyEntity, keyOf()] })
        const { service, events } = await buildManagement(em, [memberOf("owner"), { execute: { raw: undefined } }])

        await expect(service.revokeKey("principal-1", "workspace-1", "missing")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotFound,
        })
        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses revocation of a missing active key without recording an event", async () => {
        const em = mockEntityManager({ findOne: [ApiKeyEntity, keyOf()] })
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
        const issued = issueKey()
        const em = mockEntityManager({
            findOne: [ApiKeyEntity, storedAs(issued, { workspaceId: "ws-1", name: "Reader", scopes: ["leads:read"] })],
        })
        const keys = await build(em)

        await expect(keys.verifyCredential(bearerOf(issued))).resolves.toEqual({
            keyId: issued.id,
            workspaceId: "ws-1",
            name: "Reader",
            scopes: ["leads:read"],
        })
        expect(em.query).not.toHaveBeenCalled()
        expect(em.findOne).toHaveBeenCalledWith(ApiKeyEntity, expect.objectContaining({ where: { id: issued.id } }))
    })

    it("defaults optional descriptive fields without inventing scopes", async () => {
        const issued = issueKey()
        const incomplete = Object.assign(storedAs(issued, { workspaceId: "ws-1" }), {
            name: undefined,
            scopes: undefined,
        })
        const keys = await build(mockEntityManager({ findOne: [ApiKeyEntity, incomplete] }))

        await expect(keys.verifyCredential(bearerOf(issued))).resolves.toEqual({
            keyId: issued.id,
            workspaceId: "ws-1",
            name: "",
            scopes: [],
        })
    })

    it.each([
        ["another scheme", (issued: Issued) => `Basic ${issued.text}`],
        ["an old-format key", () => `Bearer ${OLD_FORMAT_KEY}`],
        ["a key of another prefix", (issued: Issued) => `Bearer sk_${issued.text.slice(4)}`],
    ])("rejects %s before any database call", async (_label, header) => {
        const em = mockEntityManager()
        const keys = await build(em)

        await expect(keys.verifyCredential(header(issueKey()))).rejects.toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        expect(em.findOne).not.toHaveBeenCalled()
    })

    it("rejects an unknown id and a wrong secret", async () => {
        const issued = issueKey()

        await expect(
            (await build(mockEntityManager({ findOne: [ApiKeyEntity, null] }))).verifyCredential(bearerOf(issued)),
        ).rejects.toMatchObject({ code: ApiKeysErrorCode.Unauthorized })
        await expect(
            (await build(mockEntityManager({ findOne: [ApiKeyEntity, storedAs(issued)] }))).verifyCredential(
                bearerOf(issueKey(issued.id)),
            ),
        ).rejects.toMatchObject({ code: ApiKeysErrorCode.Unauthorized })
    })

    it("preserves the revoked-key refusal", async () => {
        const issued = issueKey()
        const keys = await build(mockEntityManager({ findOne: [ApiKeyEntity, storedAs(issued, { revokedAt: REVOKED_AT })] }))

        await expect(keys.verifyCredential(bearerOf(issued))).rejects.toMatchObject({
            code: ApiKeysErrorCode.Revoked,
        })
    })
})

describe("ApiKeysService MCP keys", () => {
    it("lets an owner or manager create an MCP key that runs as it, scoped to an agent of the workspace, with only the MCP scope", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service, events, transaction, fakes, agents } = await buildManagement(
            em,
            [memberOf("manager", "Lan"), wrote(agentScopedMcpKey())],
            true,
            "https://mcp.nivo.test",
        )

        const created = await service.createKey("principal-1", "workspace-1", "Claude Code", "mcp", "agent-1")

        expect(created.item).toEqual({
            ...keyView,
            kind: "mcp",
            holderName: "Lan",
            agentId: "agent-1",
            endpointUrl: "https://mcp.nivo.test/mcp",
        })
        expect(agents.holds).toHaveBeenCalledWith("workspace-1", "agent-1", expect.anything())
        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    id: shownKey(created.key).id,
                    workspaceId: "workspace-1",
                    name: "Claude Code",
                    keyPrefix: created.key.slice(0, 12),
                    keyHash: apiKeySecretSha256(shownKey(created.key).secret),
                    createdBy: "principal-1",
                    agentId: "agent-1",
                    scopes: ["mcp"],
                },
            ],
        ])
        expect(events.record).toHaveBeenCalledTimes(1)
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it.each(["mcp", "public_api"] as const)("refuses a staff member a %s key", async (kind) => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service, events } = await buildManagement(em, [memberOf("staff", "Lan")])

        await expect(service.createKey("principal-1", "workspace-1", "n8n", kind)).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotManager,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("lets an owner create an MCP key", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service } = await buildManagement(em, [memberOf("owner", "Lan"), wrote(agentScopedMcpKey())])

        await expect(service.createKey("principal-1", "workspace-1", "Claude Code", "mcp")).resolves.toMatchObject({
            item: { kind: "mcp" },
        })
    })

    it("scopes a public API key to an agent of the workspace, with the public scopes kept", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service, fakes, agents } = await buildManagement(em, [
            memberOf("owner", "Lan"),
            wrote(keyOf({ agentId: "agent-1" })),
        ])

        const created = await service.createKey("principal-1", "workspace-1", "n8n", "public_api", "agent-1")

        expect(created.item).toEqual(objectLike({ kind: "public_api", agentId: "agent-1" }))
        expect(agents.holds).toHaveBeenCalledWith("workspace-1", "agent-1", expect.anything())
        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    id: shownKey(created.key).id,
                    workspaceId: "workspace-1",
                    name: "n8n",
                    keyPrefix: created.key.slice(0, 12),
                    keyHash: apiKeySecretSha256(shownKey(created.key).secret),
                    createdBy: "principal-1",
                    agentId: "agent-1",
                },
            ],
        ])
    })

    it("answers the key value in its creation answer only: never in the item, the creation event, a later listing or a log line", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service, events } = await buildManagement(em, [memberOf("manager", "Lan"), wrote(agentScopedMcpKey())])

        const created = await service.createKey("principal-1", "workspace-1", "Claude Code", "mcp")
        const shown = shownKey(created.key)
        const stored = { ...keyOf({ scopes: ["mcp"], createdBy: "principal-1" }), keyHash: apiKeySecretSha256(shown.secret) }
        em.find.mockResolvedValue([stored])
        const listed = await service.listKeys("principal-1", "workspace-1")

        const secret = created.key
        const everywhere = [created.item, events.record.mock.calls, listed].map((part) => JSON.stringify(part))
        for (const text of everywhere) {
            expect(text).not.toContain(secret)
            expect(text).not.toContain(shown.secret)
            expect(text).not.toContain(apiKeySecretSha256(shown.secret))
        }
        expect(JSON.stringify(events.record.mock.calls)).toContain(secret.slice(0, 12))
        // The service is built with no logger at all: nothing it does can write the value to a log.
        expect(Object.values(service).some((member: unknown) => typeof member === "object" && member !== null && "info" in member)).toBe(false)
    })

    it("refuses an agent that is not of the workspace and records nothing", async () => {
        const em = mockEntityManager({ count: [ApiKeyEntity, 0] })
        const { service, events, transaction } = await buildManagement(em, [memberOf("owner")], false)

        await expect(
            service.createKey("principal-1", "workspace-1", "Desk agent", "mcp", "agent-9"),
        ).rejects.toMatchObject({
            code: ApiKeysErrorCode.AgentNotFound,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it("renames any key of the workspace for a manager, holder of another member included", async () => {
        const em = mockEntityManager({ findOne: [ApiKeyEntity, keyOf({ scopes: ["mcp"] })] })
        const { service, events, fakes } = await buildManagement(em, [
            memberOf("manager", "Lan"),
            wrote(keyOf({ name: "Laptop", scopes: ["mcp"] })),
        ])

        await expect(service.renameKey("principal-1", "workspace-1", "key-2", "  Laptop ")).resolves.toEqual({
            ...keyView,
            name: "Laptop",
            kind: "mcp",
            holderName: "Lan",
        })
        expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0]).name).toBe("Laptop")
        expect(events.record).toHaveBeenCalledWith(objectLike({ kind: "api.key_renamed" }), expect.anything())
    })

    it("refuses a staff member to rename or revoke a key, even the one it holds", async () => {
        const em = mockEntityManager({ findOne: [ApiKeyEntity, keyOf({ scopes: ["mcp"] })] })
        const refused = await buildManagement(em, [memberOf("staff", "Lan")])

        await expect(refused.service.renameKey("principal-1", "workspace-1", "key-1", "Laptop")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotManager,
        })
        const again = await buildManagement(em, [memberOf("staff", "Lan")])
        await expect(again.service.revokeKey("principal-1", "workspace-1", "key-1")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotManager,
        })
        expect(refused.events.record).not.toHaveBeenCalled()
        expect(again.events.record).not.toHaveBeenCalled()
    })
})

/** An MCP key and the row its lookup answers. */
const mcpKey = (changes: Partial<ApiKeyEntity> = {}) => {
    const issued = issueKey()
    return {
        issued,
        row: storedAs(issued, { workspaceId: "ws-1", createdBy: "user-1", agentId: null, scopes: ["mcp"], ...changes }),
    }
}

describe("ApiKeysService MCP key admission", () => {
    it.each([
        ["over", [{ api_key_auth: { hits: RATE_LIMIT_PER_MINUTE + 1 } }], ApiKeysErrorCode.RateLimited],
        ["at", [{ api_key_auth: { hits: RATE_LIMIT_PER_MINUTE } }], undefined],
        ["unanswered by", [], undefined],
    ])(
        "verifies an MCP key by its id and secret as its seated holder and counts the call against its minute budget: a key %s it",
        async (_label, rows, code) => {
            const { issued, row } = mcpKey()
            const em = mockEntityManager({ findOne: [ApiKeyEntity, row], query: [API_KEY_AUTH, rows] })
            const keys = await build(em)

            const verified = keys.verifyMcpKey(bearerOf(issued))

            if (code === undefined) {
                await expect(verified).resolves.toEqual({
                    keyId: issued.id,
                    workspaceId: "ws-1",
                    holderId: "user-1",
                    agentId: null,
                })
            } else await expect(verified).rejects.toMatchObject({ code, params: { limit: RATE_LIMIT_PER_MINUTE } })
            expect(em.findOne).toHaveBeenCalledWith(ApiKeyEntity, expect.objectContaining({ where: { id: issued.id } }))
            expect(em.query).toHaveBeenCalledWith(API_KEY_AUTH, [issued.hash])
        },
    )

    it.each<[WorkspaceRole | null, ApiKeysErrorCode | undefined]>([
        ["owner", undefined],
        ["manager", undefined],
        ["staff", ApiKeysErrorCode.HolderNotManager],
        [null, ApiKeysErrorCode.HolderGone],
    ])("judges the CURRENT role of the holder at every call: a holder who is %s", async (role, code) => {
        const { issued, row } = mcpKey()
        const em = mockEntityManager({
            findOne: [ApiKeyEntity, row],
            query: [API_KEY_AUTH, [{ api_key_auth: { hits: 1 } }]],
        })
        const keys = await build(em, "active", role)

        if (code === undefined) {
            await expect(keys.verifyMcpKey(bearerOf(issued))).resolves.toMatchObject({ holderId: "user-1" })
        } else {
            await expect(keys.verifyMcpKey(bearerOf(issued))).rejects.toMatchObject({ code })
            expect(em.query).not.toHaveBeenCalled()
        }
    })

    it("refuses an agent-scoped key of a demoted holder, and admits it again once the holder is re-promoted", async () => {
        const { issued, row } = mcpKey({ agentId: "agent-1" })
        const demoted = mockEntityManager({ findOne: [ApiKeyEntity, row] })
        await expect((await build(demoted, "active", "staff")).verifyMcpKey(bearerOf(issued))).rejects.toMatchObject({
            code: ApiKeysErrorCode.HolderNotManager,
        })

        const promoted = mockEntityManager({
            findOne: [ApiKeyEntity, row],
            query: [API_KEY_AUTH, [{ api_key_auth: { hits: 1 } }]],
        })
        await expect(
            (await build(promoted, "active", "manager")).verifyMcpKey(bearerOf(issued)),
        ).resolves.toMatchObject({ holderId: "user-1", agentId: "agent-1" })
    })

    it("keeps a revoked key refused as revoked even for an owner holder, before the holder is looked at", async () => {
        const { issued, row } = mcpKey({ revokedAt: REVOKED_AT })
        const em = mockEntityManager({ findOne: [ApiKeyEntity, row] })
        const keys = await build(em, "active", "owner")

        await expect(keys.verifyMcpKey(bearerOf(issued))).rejects.toMatchObject({ code: ApiKeysErrorCode.Revoked })
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each<[string, () => { header: string; row: ApiKeyEntity | null }]>([
        ["a malformed header", () => ({ header: "Bearer other", row: null })],
        ["an old-format key (no legacy lookup)", () => ({ header: `Bearer ${OLD_FORMAT_KEY}`, row: null })],
        ["an unknown id", () => ({ header: bearerOf(issueKey()), row: null })],
        [
            "a wrong secret",
            () => {
                const { issued, row } = mcpKey()
                return { header: bearerOf(issueKey(issued.id)), row }
            },
        ],
    ])("refuses %s as unauthorized without spending a budget", async (_label, scenario) => {
        const { header, row } = scenario()
        const em = mockEntityManager({ findOne: [ApiKeyEntity, row] })

        await expect((await build(em)).verifyMcpKey(header)).rejects.toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a public API key as missing the MCP scope without spending its budget", async () => {
        const { issued, row } = mcpKey({ scopes: ["leads:read"] })
        const em = mockEntityManager({ findOne: [ApiKeyEntity, row] })

        await expect((await build(em)).verifyMcpKey(bearerOf(issued))).rejects.toMatchObject({
            code: ApiKeysErrorCode.ScopeMissing,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a key whose holder left the workspace, and one scoped to a paused agent", async () => {
        const left = mcpKey()
        const gone = mockEntityManager({ findOne: [ApiKeyEntity, left.row] })
        await expect((await build(gone, "active", null)).verifyMcpKey(bearerOf(left.issued))).rejects.toMatchObject({
            code: ApiKeysErrorCode.HolderGone,
        })

        const scoped = mcpKey({ agentId: "agent-1" })
        const paused = mockEntityManager({ findOne: [ApiKeyEntity, scoped.row] })
        await expect((await build(paused, "paused")).verifyMcpKey(bearerOf(scoped.issued))).rejects.toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        expect(gone.query).not.toHaveBeenCalled()
        expect(paused.query).not.toHaveBeenCalled()
    })

    it("answers a working MCP key's holder and scope by its id, and null for a public or revoked key", async () => {
        const em = mockEntityManager({ findOne: [ApiKeyEntity, agentScopedMcpKey()] })
        const keys = await build(em)

        await expect(keys.heldMcpKey("workspace-1", "key-2")).resolves.toEqual({
            keyId: "key-2",
            workspaceId: "workspace-1",
            holderId: "principal-1",
            agentId: "agent-1",
        })
        await expect(
            (await build(mockEntityManager({ findOne: [ApiKeyEntity, keyOf()] }))).heldMcpKey("workspace-1", "key-2"),
        ).resolves.toBeNull()
        await expect(
            (await build(mockEntityManager({ findOne: [ApiKeyEntity, null] }))).heldMcpKey("workspace-1", "key-2"),
        ).resolves.toBeNull()
    })
})

describe("ApiKeysService publicKeysOfAgent", () => {
    it("lists the live public keys scoped to the agent, by name: the customer entrances it answers", async () => {
        const em = mockEntityManager({
            find: [ApiKeyEntity, [keyOf({ id: "key-1", name: "Shop app", scopes: ["leads:read"], agentId: "agent-1" }), keyOf({ id: "key-2", name: "Claude", scopes: ["mcp"], agentId: "agent-1" })]],
        })
        const keys = await build(em)

        await expect(keys.publicKeysOfAgent("ws-1", "agent-1")).resolves.toEqual([{ id: "key-1", name: "Shop app" }])
        expect(em.find).toHaveBeenCalledWith(
            ApiKeyEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", agentId: "agent-1", revokedAt: IsNull() } }),
        )
    })
})
