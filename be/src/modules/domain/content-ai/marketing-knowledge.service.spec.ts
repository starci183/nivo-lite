import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { Passage } from "@modules/domain/knowledge"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarketingKnowledgeService } from "./marketing-knowledge.service"

const lesson = (id: string, title: string, body: string): LessonRecord =>
    mock<LessonRecord>({ id, title, body, module: "content" })

const passage = (id: string, layer: string, title: string, content: string): Passage => ({
    layer,
    id,
    sourceId: null,
    module: "content",
    kind: "template",
    title,
    content,
    score: 1,
    visibility: "internal",
    topic: null,
})

const build = async () => {
    const lessons = mock<BrainLessonsService>()
    const search = mock<KnowledgeSearchService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingKnowledgeService,
            { provide: LOGGER, useValue: logger },
            { provide: BrainLessonsService, useValue: lessons },
            { provide: KnowledgeSearchService, useValue: search },
        ],
    }).compile()
    return { service: moduleRef.get(MarketingKnowledgeService), lessons, search, logger }
}

describe("MarketingKnowledgeService", () => {
    it("reads the content agent's lessons and the NIVO templates closest to the request", async () => {
        const { service, lessons, search } = await build()
        lessons.forModule.mockResolvedValue([
            lesson("l-1", "Short captions", "Keep  three\nlines."),
            ...["2", "3", "4", "5", "6"].map((n) => lesson(`l-${n}`, `Lesson ${n}`, "b")),
        ])
        search.passages.mockResolvedValue([
            passage("p-1", "business", "Price list", "x"),
            passage("p-2", "nivo", "Weekend offer", "Hook, offer, call to book."),
            passage("p-3", "nivo", "T3", "c"),
            passage("p-4", "nivo", "T4", "c"),
            passage("p-5", "nivo", "T5", "y".repeat(500)),
        ])

        const guidance = await service.guidanceOf("ws-1", "spa offer 20%")

        expect(lessons.forModule).toHaveBeenCalledWith("ws-1", "content")
        expect(search.passages).toHaveBeenCalledWith(
            { workspaceId: "ws-1", module: "content", audience: "internal", installationId: null },
            "spa offer 20%",
            6,
        )
        expect(guidance.lessons).toHaveLength(5)
        expect(guidance.lessons[0]).toBe("Short captions: Keep three lines.")
        expect(guidance.templates).toEqual(["Weekend offer: Hook, offer, call to book.", "T3: c", "T4: c"])
        expect(guidance.sources).toEqual([
            { layer: 3, ref: "l-1", label: "Short captions" },
            { layer: 3, ref: "l-2", label: "Lesson 2" },
            { layer: 3, ref: "l-3", label: "Lesson 3" },
            { layer: 3, ref: "l-4", label: "Lesson 4" },
            { layer: 3, ref: "l-5", label: "Lesson 5" },
            { layer: 4, ref: "p-2", label: "Weekend offer" },
            { layer: 4, ref: "p-3", label: "T3" },
            { layer: 4, ref: "p-4", label: "T4" },
        ])
    })

    it("cuts a long line and leaves out a layer whose read failed, logging it", async () => {
        const { service, lessons, search, logger } = await build()
        lessons.forModule.mockRejectedValue(new Error("db down"))
        search.passages.mockResolvedValue([passage("p-5", "nivo", "T5", "y".repeat(500))])

        const guidance = await service.guidanceOf("ws-1", "r")

        expect(guidance.lessons).toEqual([])
        expect(guidance.templates[0]).toHaveLength(400)
        expect(logger.error).toHaveBeenCalledWith("marketing.draft.knowledge_failed", new Error("db down"), {
            workspaceId: "ws-1",
        })
    })

    it("drafts without templates when the search fails", async () => {
        const { service, lessons, search } = await build()
        lessons.forModule.mockResolvedValue([])
        search.passages.mockRejectedValue(new Error("no embeddings"))

        await expect(service.guidanceOf("ws-1", "r")).resolves.toEqual({ lessons: [], templates: [], sources: [] })
    })
})
