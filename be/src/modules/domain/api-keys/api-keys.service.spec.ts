import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EventsService } from "@modules/domain/events"
import { ApiKeysService } from "./api-keys.service"
import { hashKey } from "./api-keys.policy"
import { ApiKeysErrorCode } from "./errors/api-keys.error"
import { API_KEY_AUTH } from "./persistence/api-keys.sql"

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
