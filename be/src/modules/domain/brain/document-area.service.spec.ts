import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainFactAreasService } from "@modules/domain/brain-facts"
import {
    KnowledgeSourcesLogEvent,
    KnowledgeSourcesReadService,
    KnowledgeSourcesService,
    type SourceMove,
} from "@modules/domain/knowledge-sources"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { DocumentAreaService } from "./document-area.service"
import { DocumentReviewService } from "./document-review.service"

const WS = "ws-1"

/** A bicycle workshop's tune-up price list, cut into two parts, moved by Lan. */
const moveOf = (from: SourceMove["from"], to: SourceMove["to"]): SourceMove => ({
    sourceIds: ["s1", "p2"],
    title: "Tune-up prices",
    from,
    to,
    movedBy: "Lan",
})

const build = async () => {
    const logger = mock<Logger>()
    const sources = mock<KnowledgeSourcesService>()
    const states = mock<KnowledgeSourcesReadService>()
    const facts = mock<BrainFactAreasService>()
    const review = mock<DocumentReviewService>()
    facts.followDocumentAreas.mockResolvedValue(["f1", "f2"])
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentAreaService,
            { provide: LOGGER, useValue: logger },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: KnowledgeSourcesReadService, useValue: states },
            { provide: BrainFactAreasService, useValue: facts },
            { provide: DocumentReviewService, useValue: review },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentAreaService), logger, sources, states, facts, review }
}

describe("DocumentAreaService: moving a document to public / to internal flips every exit", () => {
    it("records the move, re-labels its truths from the areas as they are now, and asks the security read before customers are served", async () => {
        const { service, logger, sources, states, facts, review } = await build()
        sources.updateSource.mockResolvedValue(moveOf("internal", "public"))
        states.statesOf.mockResolvedValue([
            { id: "s1", title: "Tune-up prices", visibility: "public", status: "ready", contentHash: null },
            { id: "s9", title: "Staff rota", visibility: "internal", status: "ready", contentHash: null },
        ])

        await service.update("u1", WS, { sourceId: "s1", visibility: "public" })

        expect(sources.updateSource).toHaveBeenCalledWith("u1", WS, { sourceId: "s1", visibility: "public" })
        expect(logger.info).toHaveBeenCalledWith(KnowledgeSourcesLogEvent.AreaMoved, {
            workspaceId: WS,
            sourceId: "s1",
            parts: 1,
            from: "internal",
            to: "public",
            movedBy: "u1",
        })
        const [workspaceId, ids, publicOf, movedBy, note] = facts.followDocumentAreas.mock.calls[0] ?? []
        expect([workspaceId, ids, movedBy, note]).toEqual([
            WS,
            ["s1", "p2"],
            "Lan",
            '"Tune-up prices" internal -> public',
        ])
        await expect(publicOf?.(["s1", "s9"])).resolves.toEqual(new Set(["s1"]))
        expect(review.requestForSource.mock.calls).toEqual([
            [WS, "s1"],
            [WS, "p2"],
        ])
    })

    it("moving back to internal re-labels the truths and needs no security read (a customer read needs the public area)", async () => {
        const { service, sources, facts, review } = await build()
        sources.updateSource.mockResolvedValue(moveOf("public", "internal"))

        await service.update("u1", WS, { sourceId: "s1", visibility: "internal" })

        expect(facts.followDocumentAreas).toHaveBeenCalledTimes(1)
        expect(review.requestForSource).not.toHaveBeenCalled()
    })

    it("a change that names no area moves nothing", async () => {
        const { service, sources, facts, logger } = await build()
        sources.updateSource.mockResolvedValue(null)

        await service.update("u1", WS, { sourceId: "s1", title: "Tune-up" })

        expect(facts.followDocumentAreas).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
    })

    it("a move the area cannot hold is refused before anything follows", async () => {
        const { service, sources, facts } = await build()
        const full = new Error("KNOWLEDGE_SOURCES_PUBLIC_AREA_FULL")
        sources.updateSource.mockRejectedValue(full)

        await expect(service.update("u1", WS, { sourceId: "s1", visibility: "public" })).rejects.toBe(full)
        expect(facts.followDocumentAreas).not.toHaveBeenCalled()
    })
})
