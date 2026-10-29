import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { FakeTransaction } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { GuideAsk } from "./ai-generations.contracts"
import { AiGenerationsErrorCode } from "./errors/ai-generations.error"
import { GenerationsService } from "./generations.service"
import { GUIDE_ASKS_PER_WINDOW, GUIDE_TIMEOUT_MS, guidePrompt } from "./guide.policy"
import { GuideService } from "./guide.service"
import { AiGenerationEntity } from "./persistence/entities"

/** The statement `advisoryXactLock` sends. */
const LOCK_GUIDE_ASKER = "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))"

const NOW = new Date("2026-10-13T10:00:00.000Z")
const ASK: GuideAsk = { workspaceId: "w1", question: "Where are my leads?", path: "/chat", history: [], locale: "vi" }

const build = async (asked: number | undefined, role: WorkspaceMember["role"] = "staff") => {
    const tx: FakeTransaction = fakeTransaction(mockEntityManager({ query: [LOCK_GUIDE_ASKER, []] }))
    const [count] = queueQueryBuilders(tx.em, [{ getCount: asked ?? 0 }])
    const generations = mock<GenerationsService>({
        request: jest.fn(() => Promise.resolve({ id: "g1", status: "queued" as const })),
    })
    const members = mock<WorkspaceMembersService>({
        require: jest.fn((): Promise<WorkspaceMember> =>
            Promise.resolve({
                userId: "u1",
                workspaceId: "w1",
                role,
                staffId: null,
                displayName: "Lan",
                status: "active",
            }),
        ),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GuideService,
            { provide: GenerationsService, useValue: generations },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
        ],
    }).compile()
    return { service: moduleRef.get(GuideService), tx, count, generations, members, catalog }
}

describe("GuideService", () => {
    it("queues the guide prompt under the NIVO-paid kind and tags it with the member", async () => {
        const { service, generations, members } = await build(0)

        const queued = await service.ask("u1", ASK)

        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(queued).toEqual({ id: "g1", status: "queued" })
        expect(generations.request).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: "w1",
                purpose: "guide",
                kind: "guide",
                responseFormat: "json",
                locale: "vi",
            }),
            { requestedBy: "u1" },
            expect.anything(),
        )
    })

    it("counts the member's questions of the last ten minutes under a per-member lock", async () => {
        const { service, tx, count } = await build(3)

        await service.ask("u1", ASK)

        expect(tx.em.query).toHaveBeenCalledWith(LOCK_GUIDE_ASKER, ["guide:w1:u1"])
        expect(tx.em.createQueryBuilder).toHaveBeenCalledWith(AiGenerationEntity, "g")
        expect(count?.callsOf("where")).toEqual([
            [
                "g.workspace_id = :workspaceId AND g.usage_kind = 'guide' AND g.created_at >= :since",
                { workspaceId: "w1", since: new Date("2026-10-13T09:50:00.000Z") },
            ],
        ])
        expect(count?.callsOf("andWhere")).toEqual([
            ["g.input -> 'context' ->> 'requestedBy' = :userId", { userId: "u1" }],
        ])
    })

    it("refuses once the member reached the limit and queues nothing", async () => {
        const { service, generations } = await build(GUIDE_ASKS_PER_WINDOW)

        await expect(service.ask("u1", ASK)).rejects.toMatchObject({ code: AiGenerationsErrorCode.GuideRateLimited })
        expect(generations.request).not.toHaveBeenCalled()
    })

})

describe("GuideService prompt", () => {
    it("treats an absent count row as zero and sends the localized staff prompt in the locked transaction", async () => {
        const { service, generations, tx, catalog } = await build(undefined)

        await expect(service.ask("u1", ASK)).resolves.toEqual({ id: "g1", status: "queued" })

        expect(generations.request).toHaveBeenCalledWith(
            {
                workspaceId: "w1",
                purpose: "guide",
                messages: guidePrompt(ASK, false, { text: (key) => `[${key}]` }),
                responseFormat: "json",
                timeoutMs: GUIDE_TIMEOUT_MS,
                kind: "guide",
                module: "other",
                locale: "vi",
            },
            { requestedBy: "u1" },
            expect.anything(),
        )
        expect(isTransactionManager(generations.request.mock.calls[0]?.[2])).toBe(true)
        expect(tx.outcomes).toEqual(["commit"])
        expect(catalog.get).toHaveBeenCalledWith("guide.audienceStaff", {}, "vi")
        expect(catalog.get).not.toHaveBeenCalledWith("guide.page.billing.title", {}, "vi")
    })

    it("allows the last question below the limit and includes manager pages for an owner", async () => {
        const { service, generations, catalog } = await build(GUIDE_ASKS_PER_WINDOW - 1, "owner")

        await expect(service.ask("u1", ASK)).resolves.toEqual({ id: "g1", status: "queued" })

        expect(generations.request).toHaveBeenCalledWith(
            expect.objectContaining({ messages: guidePrompt(ASK, true, { text: (key) => `[${key}]` }) }),
            { requestedBy: "u1" },
            expect.anything(),
        )
        expect(catalog.get).toHaveBeenCalledWith("guide.audienceManager", {}, "vi")
        expect(catalog.get).toHaveBeenCalledWith("guide.page.billing.title", {}, "vi")
    })
})
