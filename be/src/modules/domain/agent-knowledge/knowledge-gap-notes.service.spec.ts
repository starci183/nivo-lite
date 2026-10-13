import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { LOGGER } from "@modules/platform/logging"
import type { GapNote } from "./agent-knowledge.contracts"
import { KnowledgeGapNotesService } from "./knowledge-gap-notes.service"
import { KnowledgeRecallService } from "./knowledge-recall.service"

const WS = "11111111-1111-4111-8111-111111111111"

const noteOf = (signals: Partial<GapNote["signals"]> = {}): GapNote => ({
    view: {
        workspaceId: WS,
        module: "chatbot",
        audience: "customer",
        installationId: null,
    },
    conversationId: "c1",
    question: "Do you deliver to Da Nang on Sunday?",
    signals: { knowledgeGap: null, needsHuman: false, proposedAnswer: null, isTransaction: false, ...signals },
})

const build = async () => {
    const gaps = { record: jest.fn().mockResolvedValue(null) }
    const recall = { factsMatching: jest.fn().mockResolvedValue([]) }
    const search = { passagesText: jest.fn().mockResolvedValue([]) }
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeGapNotesService,
            { provide: KnowledgeGapsService, useValue: mock<KnowledgeGapsService>(gaps) },
            { provide: KnowledgeRecallService, useValue: mock<KnowledgeRecallService>(recall) },
            { provide: KnowledgeSearchService, useValue: mock<KnowledgeSearchService>(search) },
            { provide: LOGGER, useValue: mock<Logger>(logger) },
        ],
    }).compile()
    return { notes: moduleRef.get(KnowledgeGapNotesService), gaps, logger }
}

describe("KnowledgeGapNotesService", () => {
    it("records the gap the reply named", async () => {
        const { notes, gaps } = await build()
        await notes.note(noteOf({ knowledgeGap: { question: "Sunday delivery?", topic: "Delivery | Days" } }))
        expect(gaps.record).toHaveBeenCalledWith(WS, expect.objectContaining({ source: "model" }))
    })

    it("records an uncovered question that asked for a person with nothing to propose", async () => {
        const { notes, gaps } = await build()
        await notes.note(noteOf({ needsHuman: true }))
        expect(gaps.record).toHaveBeenCalledWith(WS, expect.objectContaining({ source: "retrieval" }))
    })

    it("leaves a transaction alone and never throws", async () => {
        const { notes, gaps, logger } = await build()
        await notes.note(noteOf({ needsHuman: true, isTransaction: true }))
        expect(gaps.record).not.toHaveBeenCalled()
        gaps.record.mockRejectedValueOnce(new Error("db down"))
        await expect(notes.note(noteOf({ knowledgeGap: { question: "Q?", topic: "" } }))).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalled()
    })
})
