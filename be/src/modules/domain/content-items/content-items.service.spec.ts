import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { ContentItemsService } from "./content-items.service"
import { ContentItemsErrorCode } from "./errors/content-items.error"
import { ContentItemEntity } from "./persistence/entities"

const IDEA = {
    workspaceId: "workspace-1",
    title: "Post about: Opening",
    brief: "Write about the opening",
    pillarId: null,
    channels: ["facebook", "zalo"],
    evidence: "[]",
}

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

const build = async (answers: ReadonlyArray<QueryBuilderAnswers> = [], em: MockEntityManager = mockEntityManager()) => {
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [ContentItemsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { items: moduleRef.get(ContentItemsService), fakes, em }
}

describe("ContentItemsService", () => {
    describe("listBetween", () => {
        it("answers the posts due in the window, soonest first and bounded", async () => {
            const row = {
                id: "item-1",
                title: "Opening",
                status: "approved",
                channels: ["facebook"],
                scheduledAt: "2026-10-12T02:00:00.000Z",
                pillarId: "pillar-1",
            }
            const { items, fakes } = await build([{ getRawMany: [row] }])

            await expect(items.listBetween("workspace-1", "from", "to")).resolves.toEqual([row])
            expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "workspace-1", from: "from", to: "to" })
            expect(fakes[0]?.callsOf("orderBy")).toEqual([["c.scheduledAt"]])
            expect(fakes[0]?.callsOf("limit")).toEqual([[500]])
        })
    })

    describe("hasOffer", () => {
        it.each([true, false])("answers %s for whether a post with the title exists", async (held) => {
            const em = mockEntityManager({ exists: [ContentItemEntity, held] })

            await expect((await build([], em)).items.hasOffer("workspace-1", "Post")).resolves.toBe(held)
            expect(em.exists.mock.calls).toEqual([
                [ContentItemEntity, { where: { workspaceId: "workspace-1", source: "offer", title: "Post" } }],
            ])
        })
    })

    describe("createOfferIdea", () => {
        it("writes the idea and answers its id", async () => {
            const { items, fakes, em } = await build([{ execute: { raw: [{ id: "item-9" }] } }])

            await expect(items.createOfferIdea(IDEA)).resolves.toBe("item-9")
            expect(em.createQueryBuilder).toHaveBeenCalledWith(ContentItemEntity, "ci")
            expect(evaluatedValues(fakes[0]?.callsOf("values")[0]?.[0])).toEqual({
                workspaceId: "workspace-1",
                title: "Post about: Opening",
                brief: "Write about the opening",
                pillarId: null,
                channels: ["facebook", "zalo"],
                status: "idea",
                source: "offer",
                createdBy: "NIVO",
                evidence: ":evidence::jsonb",
            })
            expect(fakes[0]?.callsOf("setParameter")).toEqual([["evidence", "[]"]])
        })

        it("refuses when the insert answers no row", async () => {
            const { items } = await build([{ execute: { raw: [] } }])

            await expect(items.createOfferIdea(IDEA)).rejects.toMatchObject({ code: ContentItemsErrorCode.NotWritten })
        })
    })

    describe("agent drafts", () => {
        it("stores the draft with its images and history and answers the snapshot", async () => {
            const stored = { id: "item-1", variants: draft.variants, channels: ["facebook"] }
            const { items, fakes } = await build([{ execute: { raw: [stored] } }])

            await expect(items.createAgentDraft(draft)).resolves.toEqual(stored)
            expect(evaluatedValues(fakes[0]?.callsOf("values")[0]?.[0])).toMatchObject({
                title: "T".repeat(200),
                status: "draft",
                source: "quick",
                createdBy: "Mai Linh",
                draftedAt: "now()",
            })
            expect(fakes[0]?.callsOf("setParameters")[0]?.[0]).toMatchObject({
                scheduledAt: "2026-10-21T02:00:00.000Z",
                media: '[{"kind":"image","name":"1.png","path":"workspace-1/marketing/1-1.png"}]',
            })
            expect(fakes[0]?.callsOf("returning")).toEqual([["id, variants, channels"]])
        })

        it.each([[[]], [["broken"]], [[{ id: "item-1", variants: null, channels: [] }]]])(
            "fails when nothing usable was stored (%j)",
            async (raw) => {
                const { items } = await build([{ execute: { raw } }])

                await expect(items.createAgentDraft(draft)).rejects.toMatchObject({
                    code: ContentItemsErrorCode.NotWritten,
                })
            },
        )
    })

    describe("scheduling", () => {
        it("reads a post for the scheduler, or null when it is gone", async () => {
            const { items, fakes } = await build([
                {
                    getRawOne: {
                        id: "item-1",
                        title: "T",
                        channels: ["facebook", "zalo"],
                        variants: { facebook: { text: "fb" }, zalo: {} },
                        media: [{ path: "p1" }, {}],
                        scheduledAt: null,
                    },
                },
                { getRawOne: undefined },
            ])

            await expect(items.scheduleViewOf("workspace-1", "item-1")).resolves.toEqual({
                id: "item-1",
                title: "T",
                channels: ["facebook", "zalo"],
                texts: { facebook: "fb", zalo: "" },
                mediaPaths: ["p1"],
                scheduledAt: null,
            })
            await expect(items.scheduleViewOf("workspace-1", "item-1")).resolves.toBeNull()
            expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "workspace-1", id: "item-1" })
        })

        it("records the scheduled refs", async () => {
            const { items, fakes } = await build([{ execute: {} }])

            await items.markScheduled("workspace-1", "item-1", [{ channel: "facebook", ref: "p_1", scheduledAt: "x" }])

            expect(fakes[0]?.callsOf("where")).toEqual([[{ workspaceId: "workspace-1", id: "item-1" }]])
            expect(fakes[0]?.callsOf("setParameter")).toEqual([
                ["published", '{"facebook":{"ref":"p_1","scheduled_at":"x"}}'],
            ])
        })
    })

    describe("the scheduler tick", () => {
        it("reads the posts due on a channel with the channel's reference", async () => {
            const row = {
                workspaceId: "workspace-1",
                id: "item-1",
                title: "T",
                channels: ["facebook", "zalo"],
                variants: { zalo: { text: "zl" } },
                media: [{ path: "p1" }],
                scheduledAt: "2026-10-21T02:00:00.000Z",
                ref: "tok-1",
            }
            const { items, fakes } = await build([{ getRawMany: [row] }])

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
            expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ channel: "zalo" })
            expect(fakes[0]?.callsOf("andWhere")[1]?.[1]).toEqual({ now: "2026-10-21T02:05:00.000Z" })
            expect(fakes[0]?.callsOf("limit")).toEqual([[50]])
        })

        it("records a channel's refusal with a bounded reason", async () => {
            const { items, fakes, em } = await build([{ execute: {} }])

            await items.markChannelFailed("workspace-1", "item-1", "zalo", "r".repeat(400), "2026-10-21T02:05:00.000Z")

            expect(fakes[0]?.callsOf("setParameters")).toEqual([
                [{ channel: "zalo", at: "2026-10-21T02:05:00.000Z", reason: "r".repeat(300) }],
            ])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(ContentItemEntity, "ci")
            expect(fakes[0]?.callsOf("update")).toEqual([[]])
        })
    })
})
