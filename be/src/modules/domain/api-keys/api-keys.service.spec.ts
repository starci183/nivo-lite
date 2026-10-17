import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ApiKeysService } from "./api-keys.service"
import { hashKey } from "./api-keys.policy"
import { ApiKeysErrorCode } from "./errors/api-keys.error"
import {
    API_KEY_AUTH,
    API_KEY_CREDENTIAL,
    COUNT_ACTIVE_KEYS,
    INSERT_KEY,
    LIST_KEYS,
    REVOKE_KEY,
    SELECT_MEMBER,
} from "./persistence/api-keys.sql"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApiKeysService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:20.000Z") },
            { provide: EventsService, useValue: mock<EventsService>() },
        ],
    }).compile()
    return moduleRef.get(ApiKeysService)
}

describe("ApiKeysService", () => {
    describe("authenticate", () => {
        it("admits a working key with the hash of the bearer key as the only thing sent to the database", async () => {
            const em = mockEntityManager({
                query: [
                    API_KEY_AUTH,
                    [
                        {
                            auth: {
                                id: "key-1",
                                workspace_id: "workspace-1",
                                name: "n8n",
                                scopes: ["leads:read"],
                                hits: 3,
                            },
                        },
                    ],
                ],
            })
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

            await expect(keys.authenticate("leads:read")).rejects.toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })

            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a key no workspace issued and an answer with no row at all", async () => {
            const unknown = await build(mockEntityManager({ query: [API_KEY_AUTH, [{ auth: null }]] }))
            await expect(unknown.authenticate("leads:read", "Bearer nvk_unknown")).rejects.toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })

            const empty = await build(mockEntityManager({ query: [API_KEY_AUTH, []] }))
            await expect(empty.authenticate("leads:read", "Bearer nvk_unknown")).rejects.toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })
        })

        it("refuses a revoked key and a key over its budget with the parameters of the refusal", async () => {
            const revoked = await build(mockEntityManager({ query: [API_KEY_AUTH, [{ auth: { revoked: true } }]] }))
            await expect(revoked.authenticate("leads:read", "Bearer nvk_old")).rejects.toMatchObject({
                code: ApiKeysErrorCode.Revoked,
            })

            const busy = await build(
                mockEntityManager({
                    query: [
                        API_KEY_AUTH,
                        [{ auth: { id: "key-1", workspace_id: "workspace-1", scopes: ["leads:read"], hits: 61 } }],
                    ],
                }),
            )
            await expect(busy.authenticate("leads:read", "Bearer nvk_busy")).rejects.toMatchObject({
                code: ApiKeysErrorCode.RateLimited,
                params: { limit: 60, retryAfter: 40 },
            })
        })
    })
})

const keyRow = {
    id: "key-2",
    name: "Daily sync",
    key_prefix: "nvk_stored12",
    created_at: "2026-10-12T10:00:00.000Z",
    last_used_at: null,
    revoked_at: null,
}

const keyView = {
    id: "key-2",
    name: "Daily sync",
    prefix: "nvk_stored12",
    createdAt: "2026-10-12T10:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
}

const buildManagement = async (entityManager: MockEntityManager) => {
    const transaction = fakeTransaction(entityManager)
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
        ],
    }).compile()
    return { service: moduleRef.get(ApiKeysService), events, transaction, managers }
}

describe("ApiKeysService management", () => {
    it("lists the workspace keys as public views for an owner", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_MEMBER, [{ role: "owner", display_name: "Owner" }]],
                [LIST_KEYS, [keyRow]],
            ],
        })
        const { service } = await buildManagement(em)

        await expect(service.listKeys("principal-1", "workspace-1")).resolves.toEqual([keyView])
        expect(em.query).toHaveBeenNthCalledWith(1, SELECT_MEMBER, ["workspace-1", "principal-1"])
        expect(em.query).toHaveBeenNthCalledWith(2, LIST_KEYS, ["workspace-1"])
    })

    it.each([
        { members: [], reason: "a non-member" },
        { members: [{ role: "member", display_name: "Staff" }], reason: "a staff member" },
    ])("refuses $reason before reading the keys", async ({ members }) => {
        const em = mockEntityManager({ query: [SELECT_MEMBER, members] })
        const { service, events } = await buildManagement(em)

        await expect(service.listKeys("principal-1", "workspace-1")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotManager,
        })
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(SELECT_MEMBER, ["workspace-1", "principal-1"])
        expect(events.record).not.toHaveBeenCalled()
    })

    it("rejects a short name before starting a transaction", async () => {
        const em = mockEntityManager()
        const { service, events } = await buildManagement(em)

        expect(() => service.createKey("principal-1", "workspace-1", " x ")).toThrow(
            expect.objectContaining({ code: ApiKeysErrorCode.NameTooShort }),
        )
        expect(em.transaction).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })
})

describe("ApiKeysService management", () => {
    it.each([
        { active: [], scenario: "the count query answers no row" },
        { active: [{ active: 19 }], scenario: "one active slot remains" },
    ])("creates a key when $scenario", async ({ active }) => {
        const em = mockEntityManager({
            query: [
                [SELECT_MEMBER, [{ role: "manager", display_name: "Manager" }]],
                [COUNT_ACTIVE_KEYS, active],
                [INSERT_KEY, [keyRow]],
            ],
        })
        const { service, events, transaction, managers } = await buildManagement(em)

        const created = await service.createKey("principal-1", "workspace-1", "  Daily\n sync  ")

        expect(created.item).toEqual(keyView)
        expect(created.key).toMatch(/^nvk_[A-Za-z0-9_-]{43}$/u)
        expect(em.query).toHaveBeenNthCalledWith(1, SELECT_MEMBER, ["workspace-1", "principal-1"])
        expect(em.query).toHaveBeenNthCalledWith(2, COUNT_ACTIVE_KEYS, ["workspace-1"])
        expect(em.query).toHaveBeenNthCalledWith(3, INSERT_KEY, [
            "workspace-1",
            "Daily sync",
            created.key.slice(0, 12),
            hashKey(created.key),
            "principal-1",
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
        const em = mockEntityManager({
            query: [
                [SELECT_MEMBER, [{ role: "owner", display_name: "Owner" }]],
                [COUNT_ACTIVE_KEYS, [{ active: 20 }]],
            ],
        })
        const { service, events, transaction } = await buildManagement(em)

        await expect(service.createKey("principal-1", "workspace-1", "Daily sync")).rejects.toMatchObject({
            code: ApiKeysErrorCode.LimitReached,
            params: { limit: 20 },
        })
        expect(em.query).toHaveBeenCalledTimes(2)
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })
})

describe("ApiKeysService management", () => {
    it("refuses an insert that returns no key and leaves no creation event", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_MEMBER, [{ role: "owner", display_name: "Owner" }]],
                [COUNT_ACTIVE_KEYS, [{ active: 0 }]],
                [INSERT_KEY, []],
            ],
        })
        const { service, events, transaction } = await buildManagement(em)

        await expect(service.createKey("principal-1", "workspace-1", "Daily sync")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotCreated,
        })
        expect(em.query).toHaveBeenCalledTimes(3)
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it("revokes the requested workspace key and records the actor in the same transaction", async () => {
        const revokedAt = "2026-10-12T10:00:20.000Z"
        const lastUsedAt = "2026-10-12T09:00:00.000Z"
        const em = mockEntityManager({
            query: [
                [SELECT_MEMBER, [{ role: "manager", display_name: "Manager" }]],
                [REVOKE_KEY, [{ ...keyRow, revoked_at: revokedAt, last_used_at: lastUsedAt }]],
            ],
        })
        const { service, events, transaction, managers } = await buildManagement(em)

        await expect(service.revokeKey("principal-1", "workspace-1", "key-2")).resolves.toEqual({
            ...keyView,
            revokedAt,
            lastUsedAt,
        })
        expect(em.query).toHaveBeenNthCalledWith(1, SELECT_MEMBER, ["workspace-1", "principal-1"])
        expect(em.query).toHaveBeenNthCalledWith(2, REVOKE_KEY, ["workspace-1", "key-2"])
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

    it("refuses revocation of a missing active key without recording an event", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_MEMBER, [{ role: "owner", display_name: "Owner" }]],
                [REVOKE_KEY, []],
            ],
        })
        const { service, events, transaction } = await buildManagement(em)

        await expect(service.revokeKey("principal-1", "workspace-1", "missing")).rejects.toMatchObject({
            code: ApiKeysErrorCode.NotFound,
        })
        expect(em.query).toHaveBeenCalledWith(REVOKE_KEY, ["workspace-1", "missing"])
        expect(events.record).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })
})

describe("ApiKeysService credential admission", () => {
    it("proves the stored credential without calling the rate-accounting function", async () => {
        const em = mockEntityManager({
            query: [
                API_KEY_CREDENTIAL,
                [{ id: "key-1", workspace_id: "ws-1", name: "Till", scopes: ["loyalty:read"] }],
            ],
        })
        const keys = await build(em)

        await expect(keys.verifyCredential("Bearer nvk_secret")).resolves.toEqual({
            keyId: "key-1",
            workspaceId: "ws-1",
            name: "Till",
            scopes: ["loyalty:read"],
        })
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(API_KEY_CREDENTIAL, [hashKey("nvk_secret")])
    })

    it("defaults optional descriptive fields without inventing scopes", async () => {
        const keys = await build(
            mockEntityManager({
                query: [API_KEY_CREDENTIAL, [{ id: "key-1", workspace_id: "ws-1" }]],
            }),
        )

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
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([{ rows: [] }, { rows: [{}] }, { rows: [{ id: "key-1" }] }])(
        "rejects an unknown or incomplete key (%p)",
        async ({ rows }) => {
            const keys = await build(mockEntityManager({ query: [API_KEY_CREDENTIAL, rows] }))

            await expect(keys.verifyCredential("Bearer nvk_secret")).rejects.toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })
        },
    )

    it("preserves the revoked-key refusal", async () => {
        const keys = await build(mockEntityManager({ query: [API_KEY_CREDENTIAL, [{ revoked: true }]] }))

        await expect(keys.verifyCredential("Bearer nvk_secret")).rejects.toMatchObject({
            code: ApiKeysErrorCode.Revoked,
        })
    })
})
