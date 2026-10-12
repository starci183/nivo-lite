import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentItemsService } from "./content-items.service"
import { ContentItemsErrorCode } from "./errors/content-items.error"
import { INSERT_OFFER_IDEA, SELECT_ITEMS_BETWEEN, SELECT_OFFER_ITEM } from "./persistence/content-items.sql"

const IDEA = {
    workspaceId: "workspace-1",
    title: "Post about: Opening",
    brief: "Write about the opening",
    pillarId: null,
    channels: ["facebook", "zalo"],
    evidence: "[]",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentItemsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ContentItemsService)
}

describe("ContentItemsService", () => {
    describe("listBetween", () => {
        it("answers the posts due in the window", async () => {
            const em = mockEntityManager({
                query: [
                    SELECT_ITEMS_BETWEEN,
                    [
                        {
                            id: "item-1",
                            title: "Opening",
                            status: "approved",
                            channels: ["facebook"],
                            scheduled_at: "2026-10-12T02:00:00.000Z",
                            pillar_id: "pillar-1",
                        },
                    ],
                ],
            })
            const items = await build(em)

            await expect(items.listBetween("workspace-1", "from", "to")).resolves.toEqual([
                {
                    id: "item-1",
                    title: "Opening",
                    status: "approved",
                    channels: ["facebook"],
                    scheduledAt: "2026-10-12T02:00:00.000Z",
                    pillarId: "pillar-1",
                },
            ])
            expect(em.query).toHaveBeenCalledWith(SELECT_ITEMS_BETWEEN, ["workspace-1", "from", "to"])
        })
    })

    describe("hasOffer", () => {
        it("is true when an earlier tick already made a post with the title", async () => {
            const em = mockEntityManager({ query: [SELECT_OFFER_ITEM, [{ id: "item-1", status: "idea" }]] })

            await expect((await build(em)).hasOffer("workspace-1", "Post")).resolves.toBe(true)
            expect(em.query).toHaveBeenCalledWith(SELECT_OFFER_ITEM, ["workspace-1", "Post"])
        })

        it("is false when none exists", async () => {
            const em = mockEntityManager({ query: [SELECT_OFFER_ITEM, []] })

            await expect((await build(em)).hasOffer("workspace-1", "Post")).resolves.toBe(false)
        })
    })

    describe("createOfferIdea", () => {
        it("writes the idea and answers its id", async () => {
            const em = mockEntityManager({ query: [INSERT_OFFER_IDEA, [{ id: "item-9" }]] })

            await expect((await build(em)).createOfferIdea(IDEA)).resolves.toBe("item-9")
            expect(em.query).toHaveBeenCalledWith(INSERT_OFFER_IDEA, [
                "workspace-1",
                "Post about: Opening",
                "Write about the opening",
                null,
                ["facebook", "zalo"],
                "[]",
            ])
        })

        it("refuses when the insert answers no row", async () => {
            const em = mockEntityManager({ query: [INSERT_OFFER_IDEA, []] })

            await expect((await build(em)).createOfferIdea(IDEA)).rejects.toMatchObject({
                code: ContentItemsErrorCode.NotWritten,
            })
        })
    })
})
