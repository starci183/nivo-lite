import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ApiKeysService } from "./api-keys.service"
import { hashKey } from "./api-keys.policy"
import { ApiKeysErrorCode } from "./errors/api-keys.error"
import {
    API_KEY_AUTH,
    COUNT_ACTIVE_KEYS,
    INSERT_EVIDENCE,
    INSERT_KEY,
    LIST_KEYS,
    REVOKE_KEY,
    SELECT_MEMBER,
} from "./persistence/api-keys.sql"

const KEY_ROW = {
    id: "key-1",
    name: "n8n sales",
    key_prefix: "nvk_AAAAAAAA",
    created_at: "2026-10-12T10:00:00.000Z",
    last_used_at: null,
    revoked_at: null,
}

const VIEW = {
    id: "key-1",
    name: "n8n sales",
    prefix: "nvk_AAAAAAAA",
    createdAt: "2026-10-12T10:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
}

const MANAGER = [{ role: "manager", display_name: "Lan" }]

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApiKeysService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:20.000Z") },
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
                    [{ auth: { id: "key-1", workspace_id: "workspace-1", name: "n8n", scopes: ["leads:read"], hits: 3 } }],
                ],
            })
            const keys = await build(em)

            await expect(keys.authenticate("Bearer nvk_secret", "leads:read")).resolves.toEqual({
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

            await expect(keys.authenticate(undefined, "leads:read")).rejects.toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })

            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a key no workspace issued", async () => {
            const keys = await build(mockEntityManager({ query: [API_KEY_AUTH, [{ auth: null }]] }))

            await expect(keys.authenticate("Bearer nvk_unknown", "leads:read")).rejects.toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })
        })

        it("refuses when the database answers no row at all", async () => {
            const keys = await build(mockEntityManager({ query: [API_KEY_AUTH, []] }))

            await expect(keys.authenticate("Bearer nvk_unknown", "leads:read")).rejects.toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })
        })

        it("refuses a revoked key and a key over its budget with the parameters of the refusal", async () => {
            const revoked = await build(mockEntityManager({ query: [API_KEY_AUTH, [{ auth: { revoked: true } }]] }))
            await expect(revoked.authenticate("Bearer nvk_old", "leads:read")).rejects.toMatchObject({
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
            await expect(busy.authenticate("Bearer nvk_busy", "leads:read")).rejects.toMatchObject({
                code: ApiKeysErrorCode.RateLimited,
                params: { limit: 60, retryAfter: 40 },
            })
        })
    })

    describe("listKeys", () => {
        it("lists the keys of a workspace for its manager", async () => {
            const em = mockEntityManager({ query: [[SELECT_MEMBER, MANAGER], [LIST_KEYS, [KEY_ROW]]] })
            const keys = await build(em)

            await expect(keys.listKeys("person-1", "workspace-1")).resolves.toEqual([VIEW])

            expect(em.query).toHaveBeenCalledWith(SELECT_MEMBER, ["workspace-1", "person-1"])
            expect(em.query).toHaveBeenCalledWith(LIST_KEYS, ["workspace-1"])
        })

        it("refuses a member who is not an owner or manager and a stranger", async () => {
            const staff = await build(mockEntityManager({ query: [SELECT_MEMBER, [{ role: "staff", display_name: "An" }]] }))
            await expect(staff.listKeys("person-2", "workspace-1")).rejects.toMatchObject({
                code: ApiKeysErrorCode.NotManager,
            })

            const stranger = await build(mockEntityManager({ query: [SELECT_MEMBER, []] }))
            await expect(stranger.listKeys("person-3", "workspace-1")).rejects.toMatchObject({
                code: ApiKeysErrorCode.NotManager,
            })
        })
    })

    describe("createKey", () => {
        const stubs = (active: number, inserted: ReadonlyArray<typeof KEY_ROW>) =>
            mockEntityManager({
                query: [
                    [SELECT_MEMBER, MANAGER],
                    [COUNT_ACTIVE_KEYS, [{ active }]],
                    [INSERT_KEY, inserted],
                    [INSERT_EVIDENCE, []],
                ],
            })

        it("stores only the hash, answers the secret once and writes the evidence in the same transaction", async () => {
            const tx = fakeTransaction(stubs(0, [KEY_ROW]))
            const keys = await build(tx.em)

            const created = await keys.createKey("person-1", "workspace-1", "  n8n   sales ")

            expect(created.item).toEqual(VIEW)
            expect(created.key.startsWith("nvk_")).toBe(true)
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_KEY, [
                "workspace-1",
                "n8n sales",
                created.key.slice(0, 12),
                hashKey(created.key),
                "person-1",
            ])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_EVIDENCE, [
                "workspace-1",
                "api.key_created",
                "Lan",
                "API key created: n8n sales",
                created.key.slice(0, 12),
            ])
            expect(tx.commits).toBe(1)
        })

        it("refuses a name that is too short before any query", async () => {
            const em = mockEntityManager()
            const keys = await build(em)

            await expect(keys.createKey("person-1", "workspace-1", " a ")).rejects.toMatchObject({
                code: ApiKeysErrorCode.NameTooShort,
            })

            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses the twenty-first active key", async () => {
            const tx = fakeTransaction(stubs(20, []))
            const keys = await build(tx.em)

            await expect(keys.createKey("person-1", "workspace-1", "n8n")).rejects.toMatchObject({
                code: ApiKeysErrorCode.LimitReached,
                params: { limit: 20 },
            })

            expect(tx.rollbacks).toBe(1)
        })

        it("counts a workspace without a count row as having no key", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER, MANAGER],
                        [COUNT_ACTIVE_KEYS, []],
                        [INSERT_KEY, [KEY_ROW]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const keys = await build(tx.em)

            await expect(keys.createKey("person-1", "workspace-1", "n8n")).resolves.toMatchObject({ item: VIEW })
        })

        it("refuses when the insert answers no row", async () => {
            const tx = fakeTransaction(stubs(0, []))
            const keys = await build(tx.em)

            await expect(keys.createKey("person-1", "workspace-1", "n8n")).rejects.toMatchObject({
                code: ApiKeysErrorCode.NotCreated,
            })
        })

        it("refuses a caller who does not manage the workspace and writes nothing", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [SELECT_MEMBER, []] }))
            const keys = await build(tx.em)

            await expect(keys.createKey("person-3", "workspace-1", "n8n")).rejects.toMatchObject({
                code: ApiKeysErrorCode.NotManager,
            })

            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("revokeKey", () => {
        it("revokes the key of the workspace and records who did it", async () => {
            const revoked = { ...KEY_ROW, revoked_at: "2026-10-12T11:00:00.000Z" }
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER, MANAGER],
                        [REVOKE_KEY, [revoked]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const keys = await build(tx.em)

            await expect(keys.revokeKey("person-1", "workspace-1", "key-1")).resolves.toEqual({
                ...VIEW,
                revokedAt: "2026-10-12T11:00:00.000Z",
            })

            expect(tx.em.query).toHaveBeenCalledWith(REVOKE_KEY, ["workspace-1", "key-1"])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_EVIDENCE, [
                "workspace-1",
                "api.key_revoked",
                "Lan",
                "API key revoked: n8n sales",
                "nvk_AAAAAAAA",
            ])
            expect(tx.commits).toBe(1)
        })

        it("refuses a key that is missing, of another workspace or already revoked", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER, MANAGER],
                        [REVOKE_KEY, []],
                    ],
                }),
            )
            const keys = await build(tx.em)

            await expect(keys.revokeKey("person-1", "workspace-1", "key-9")).rejects.toMatchObject({
                code: ApiKeysErrorCode.NotFound,
            })

            expect(tx.rollbacks).toBe(1)
        })
    })
})
