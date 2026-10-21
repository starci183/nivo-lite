import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentItemsService } from "./content-items.service"
import { ContentItemsErrorCode } from "./errors/content-items.error"
import {
    INSERT_AGENT_DRAFT,
    INSERT_OFFER_IDEA,
    MARK_CHANNEL_FAILED,
    MARK_ITEM_SCHEDULED,
    SELECT_DUE_CHANNEL_POSTS,
    SELECT_ITEMS_BETWEEN,
    SELECT_OFFER_ITEM,
    SELECT_SCHEDULE_ITEM,
} from "./persistence/content-items.sql"

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

describe("ContentItemsService (continued)", () => {
    describe("agent drafts", () => {
        const draft = {
            workspaceId: "workspace-1",
            title: "T".repeat(210),
            brief: "brief",
            channels: ["facebook"],
            scheduledAt: "2026-10-21T02:00:00.000Z",
            variants: { facebook: { text: "text", hashtags: ["#A"], note: "" } },
            hashtags: ["#A"],
            imagePaths: ["workspace-1/marketing/1-1.png"],
            actor: "Mai Linh",
            evidenceText: "request",
            at: "2026-10-20T07:00:00.000Z",
        }

        it("stores the draft with its images and history and answers the snapshot", async () => {
            const em = mockEntityManager({
                query: [INSERT_AGENT_DRAFT, [{ id: "item-1", variants: draft.variants, channels: ["facebook"] }]],
            })
            const items = await build(em)

            await expect(items.createAgentDraft(draft)).resolves.toEqual({
                id: "item-1",
                variants: draft.variants,
                channels: ["facebook"],
            })
            const args = em.query.mock.calls[0]?.[1] ?? []
            expect(args[1]).toHaveLength(200)
            expect(args[7]).toBe('[{"kind":"image","name":"1.png","path":"workspace-1/marketing/1-1.png"}]')
        })

        it("fails when nothing was stored", async () => {
            const items = await build(mockEntityManager({ query: [INSERT_AGENT_DRAFT, []] }))

            await expect(items.createAgentDraft(draft)).rejects.toMatchObject({
                code: ContentItemsErrorCode.NotWritten,
            })
        })
    })
})

describe("ContentItemsService (continued) (continued)", () => {
    describe("agent drafts (continued)", () => {
        it("reads a post for the scheduler, or null when it is gone", async () => {
            const em = mockEntityManager({
                query: [
                    [
                        SELECT_SCHEDULE_ITEM,
                        [
                            {
                                id: "item-1",
                                title: "T",
                                channels: ["facebook", "zalo"],
                                variants: { facebook: { text: "fb" }, zalo: {} },
                                media: [{ path: "p1" }, {}],
                                scheduled_at: null,
                            },
                        ],
                    ],
                    [SELECT_SCHEDULE_ITEM, []],
                ],
            })
            const items = await build(em)

            await expect(items.scheduleViewOf("workspace-1", "item-1")).resolves.toEqual({
                id: "item-1",
                title: "T",
                channels: ["facebook", "zalo"],
                texts: { facebook: "fb", zalo: "" },
                mediaPaths: ["p1"],
                scheduledAt: null,
            })
            await expect(items.scheduleViewOf("workspace-1", "item-1")).resolves.toBeNull()
        })

        it("records the scheduled refs", async () => {
            const em = mockEntityManager({ query: [MARK_ITEM_SCHEDULED, []] })
            const items = await build(em)

            await items.markScheduled("workspace-1", "item-1", [{ channel: "facebook", ref: "p_1", scheduledAt: "x" }])

            expect(em.query).toHaveBeenCalledWith(MARK_ITEM_SCHEDULED, [
                "workspace-1",
                "item-1",
                '{"facebook":{"ref":"p_1","scheduled_at":"x"}}',
            ])
        })
    })
})

describe("ContentItemsService due channel posts", () => {
    describe("the scheduler tick", () => {
        it("reads the posts due on a channel with the channel's reference", async () => {
            const em = mockEntityManager({
                query: [
                    SELECT_DUE_CHANNEL_POSTS,
                    [
                        {
                            workspace_id: "workspace-1",
                            id: "item-1",
                            title: "T",
                            channels: ["facebook", "zalo"],
                            variants: { zalo: { text: "zl" } },
                            media: [{ path: "p1" }],
                            scheduled_at: "2026-10-21T02:00:00.000Z",
                            ref: "tok-1",
                        },
                    ],
                ],
            })
            const items = await build(em)

            await expect(items.dueOnChannel("zalo", "2026-10-21T02:05:00.000Z", 50)).resolves.toEqual([
                {
                    workspaceId: "workspace-1",
                    id: "item-1",
                    title: "T",
                    channels: ["facebook", "zalo"],
                    texts: { facebook: "", zalo: "zl" },
                    mediaPaths: ["p1"],
                    scheduledAt: "2026-10-21T02:00:00.000Z",
                    ref: "tok-1",
                },
            ])
            expect(em.query).toHaveBeenCalledWith(SELECT_DUE_CHANNEL_POSTS, ["zalo", "2026-10-21T02:05:00.000Z", 50])
        })

        it("records a channel's refusal with a bounded reason", async () => {
            const em = mockEntityManager({ query: [MARK_CHANNEL_FAILED, []] })
            const items = await build(em)

            await items.markChannelFailed("workspace-1", "item-1", "zalo", "r".repeat(400), "2026-10-21T02:05:00.000Z")

            expect(em.query).toHaveBeenCalledWith(MARK_CHANNEL_FAILED, [
                "workspace-1",
                "item-1",
                "zalo",
                "r".repeat(300),
                "2026-10-21T02:05:00.000Z",
            ])
        })
    })
})
