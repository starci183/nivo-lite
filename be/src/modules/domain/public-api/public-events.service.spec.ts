import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { ApiKeysService } from "@modules/domain/api-keys"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PublicApiErrorCode } from "./errors/public-api.error"
import { PublicEventsService } from "./public-events.service"

const WHO = { keyId: "key-1", workspaceId: "workspace-1", name: "n8n", scopes: [] }

const AUTH = "Bearer nvk_secret"

const EVENT_ROW = {
    id: "event-1",
    kind: "api.lead",
    actor: "api:n8n",
    summary: "s",
    evidence: null,
    lead_id: null,
    created_at: "2026-10-12T09:30:00.000Z",
}

const build = async (entityManager: MockEntityManager) => {
    const keys = mock<ApiKeysService>()
    keys.authenticate.mockResolvedValue(WHO)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicEventsService,
            { provide: ApiKeysService, useValue: keys },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
        ],
    }).compile()
    return { service: moduleRef.get(PublicEventsService), keys }
}

describe("PublicEventsService", () => {
    describe("listEvents", () => {
        it("admits the key for events:read, lists the events after since and answers the time of the last one as the next cursor", async () => {
            const em = mockEntityManager()
            const read = fakeQueryBuilder({ getRawMany: [EVENT_ROW] })
            answerQueryBuilders(em, read)
            const { service, keys } = await build(em)

            await expect(
                service.listEvents({ authorization: AUTH, since: "2026-10-12T00:00:00Z", limit: "10" }),
            ).resolves.toEqual({
                events: [
                    {
                        id: "event-1",
                        kind: "api.lead",
                        actor: "api:n8n",
                        summary: "s",
                        evidence: null,
                        leadId: null,
                        createdAt: "2026-10-12T09:30:00.000Z",
                    },
                ],
                nextSince: "2026-10-12T09:30:00.000Z",
            })

            expect(keys.authenticate).toHaveBeenCalledWith("events:read", AUTH)
            expect(read.argsOf("from")).toEqual([["public.events", "e"]])
            expect(read.argsOf("where")).toEqual([
                [
                    "e.workspace_id = :workspaceId AND e.created_at > :since",
                    { workspaceId: "workspace-1", since: "2026-10-12T00:00:00.000Z" },
                ],
            ])
            expect(read.argsOf("orderBy")).toEqual([["e.created_at", "ASC"]])
            expect(read.argsOf("limit")).toEqual([[10]])
        })

        it("keeps the start of the window as the cursor when nothing happened, one day back and a hundred events by default", async () => {
            const em = mockEntityManager()
            const read = fakeQueryBuilder({ getRawMany: [] })
            answerQueryBuilders(em, read)
            const { service } = await build(em)

            await expect(service.listEvents({ authorization: AUTH })).resolves.toEqual({
                events: [],
                nextSince: "2026-10-11T10:00:00.000Z",
            })

            expect(read.argsOf("where")[0]?.[1]).toEqual({
                workspaceId: "workspace-1",
                since: "2026-10-11T10:00:00.000Z",
            })
            expect(read.argsOf("limit")).toEqual([[100]])
        })

        it("refuses a since that is not a time and reads nothing", async () => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await expect(service.listEvents({ authorization: AUTH, since: "later" })).rejects.toMatchObject({
                code: PublicApiErrorCode.SinceInvalid,
            })

            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("stops at a refused key before any query", async () => {
            const em = mockEntityManager()
            const { service, keys } = await build(em)
            const refused = new Error("API_KEYS_UNAUTHORIZED")
            keys.authenticate.mockRejectedValue(refused)

            await expect(service.listEvents({ authorization: undefined })).rejects.toBe(refused)

            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
})
