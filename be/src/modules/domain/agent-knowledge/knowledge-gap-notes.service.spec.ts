import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { Passage } from "@modules/domain/knowledge"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { LOGGER } from "@modules/platform/logging"
import type { GapNote } from "./agent-knowledge.contracts"
import { AgentKnowledgeLogEvent } from "./agent-knowledge.log-events"
import { KnowledgeGapNotesService } from "./knowledge-gap-notes.service"
import { KnowledgeRecallService } from "./knowledge-recall.service"

const WS = "11111111-1111-4111-8111-111111111111"

const factOf = (value: string): FactRecord => ({
    id: "fact-1",
    subjectType: "policy",
    subjectKey: "sunday",
    subjectLabel: "Sunday",
    attribute: "delivery",
    attributeLabel: "Delivery",
    value,
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 100,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "owner",
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const passageOf = (title: string, topic: string | null, content: string): Passage => ({
    layer: "business",
    id: "passage-1",
    sourceId: "source-1",
    module: "chatbot",
    kind: "faq",
    title,
    content,
    score: 1,
    visibility: "public",
    topic,
})

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
    const gaps = mock<KnowledgeGapsService>({ record: jest.fn().mockResolvedValue(null) })
    const recall = mock<KnowledgeRecallService>({ factsMatching: jest.fn().mockResolvedValue([]) })
    const search = mock<KnowledgeSearchService>({ passagesText: jest.fn().mockResolvedValue([]) })
    const logger = mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeGapNotesService,
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: KnowledgeRecallService, useValue: recall },
            { provide: KnowledgeSearchService, useValue: search },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { notes: moduleRef.get(KnowledgeGapNotesService), gaps, recall, search, logger }
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

    it("records the exact model claim before considering transaction or proposed-answer signals", async () => {
        const { notes, gaps, recall, search } = await build()
        await notes.note(
            noteOf({
                knowledgeGap: { question: " Sunday delivery? ", topic: "Delivery | Days" },
                proposedAnswer: "Ask the dispatcher.",
                isTransaction: true,
            }),
        )
        expect(gaps.record).toHaveBeenCalledTimes(1)
        expect(gaps.record).toHaveBeenCalledWith(WS, {
            module: "chatbot",
            question: " Sunday delivery? ",
            topic: "Delivery | Days",
            conversationId: "c1",
            source: "model",
        })
        expect(recall.factsMatching).not.toHaveBeenCalled()
        expect(search.passagesText).not.toHaveBeenCalled()
    })

    it.each([{ needsHuman: false }, { needsHuman: true, proposedAnswer: "We deliver Sundays." }])(
        "does not search or record when escalation does not need a missing answer: %j",
        async (signals) => {
            const { notes, gaps, recall, search } = await build()
            await notes.note(noteOf(signals))
            expect(gaps.record).not.toHaveBeenCalled()
            expect(recall.factsMatching).not.toHaveBeenCalled()
            expect(search.passagesText).not.toHaveBeenCalled()
        },
    )

    it("falls back to retrieval when the model claim is blank", async () => {
        const { notes, gaps, recall, search } = await build()
        const note = {
            ...noteOf({ needsHuman: true, knowledgeGap: { question: " \t ", topic: "Delivery" } }),
            question: "Sunday delivery",
        }
        await notes.note(note)
        expect(recall.factsMatching).toHaveBeenCalledTimes(1)
        expect(recall.factsMatching).toHaveBeenCalledWith(note.view, "Sunday delivery", 5)
        expect(search.passagesText).toHaveBeenCalledTimes(1)
        expect(search.passagesText).toHaveBeenCalledWith(note.view, "sunday delivery", 5)
        expect(gaps.record).toHaveBeenCalledTimes(1)
        expect(gaps.record).toHaveBeenCalledWith(WS, {
            module: "chatbot",
            question: "Sunday delivery",
            conversationId: "c1",
            source: "retrieval",
        })
    })

    it("does not search a question without significant words", async () => {
        const { notes, gaps, recall, search } = await build()
        await notes.note({ ...noteOf({ needsHuman: true }), question: "Hi, how are you?" })
        expect(gaps.record).not.toHaveBeenCalled()
        expect(recall.factsMatching).not.toHaveBeenCalled()
        expect(search.passagesText).not.toHaveBeenCalled()
    })

    it("uses fact subject, attribute and value together to recognize an answered question", async () => {
        const { notes, gaps, recall, search } = await build()
        const note = { ...noteOf({ needsHuman: true }), question: "Sunday delivery schedule prices" }
        recall.factsMatching.mockResolvedValueOnce([factOf("Schedule")])
        await notes.note(note)
        expect(recall.factsMatching).toHaveBeenCalledTimes(1)
        expect(recall.factsMatching).toHaveBeenCalledWith(note.view, note.question, 5)
        expect(search.passagesText).toHaveBeenCalledTimes(1)
        expect(search.passagesText).toHaveBeenCalledWith(note.view, "sunday delivery schedule prices", 5)
        expect(gaps.record).not.toHaveBeenCalled()
    })

    it.each([passageOf("Sunday", "Delivery", "Schedule"), passageOf("Sunday delivery", null, "Schedule")])(
        "uses passage title, optional topic and content to recognize an answered question: %j",
        async (passage) => {
            const { notes, gaps, recall, search } = await build()
            recall.factsMatching.mockResolvedValueOnce([factOf("Unknown")])
            search.passagesText.mockResolvedValueOnce([passage])
            await notes.note({ ...noteOf({ needsHuman: true }), question: "Sunday delivery schedule prices" })
            expect(gaps.record).not.toHaveBeenCalled()
            expect(search.passagesText).toHaveBeenCalledTimes(1)
        },
    )

    it("records retrieval gaps when neither facts nor passages cover enough question words", async () => {
        const { notes, gaps, recall, search } = await build()
        const note = { ...noteOf({ needsHuman: true }), question: "Sunday delivery schedule prices" }
        recall.factsMatching.mockResolvedValueOnce([factOf("Unknown")])
        search.passagesText.mockResolvedValueOnce([passageOf("Sunday", null, "Unavailable")])
        await notes.note(note)
        expect(gaps.record).toHaveBeenCalledTimes(1)
        expect(gaps.record).toHaveBeenCalledWith(WS, {
            module: "chatbot",
            question: note.question,
            conversationId: "c1",
            source: "retrieval",
        })
    })

    it("logs each failed coverage lookup and still records the uncovered question", async () => {
        const { notes, gaps, recall, search, logger } = await build()
        const factFailure = new Error("facts unavailable")
        const passageFailure = new Error("passages unavailable")
        recall.factsMatching.mockRejectedValueOnce(factFailure)
        search.passagesText.mockRejectedValueOnce(passageFailure)
        const note = noteOf({ needsHuman: true })
        await expect(notes.note(note)).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledTimes(2)
        expect(logger.error).toHaveBeenCalledWith(AgentKnowledgeLogEvent.RecallPartFailed, factFailure, {
            workspaceId: WS,
            part: "coverage",
        })
        expect(logger.error).toHaveBeenCalledWith(AgentKnowledgeLogEvent.RecallPartFailed, passageFailure, {
            workspaceId: WS,
            part: "coverage",
        })
        expect(gaps.record).toHaveBeenCalledTimes(1)
        expect(gaps.record).toHaveBeenCalledWith(WS, {
            module: "chatbot",
            question: note.question,
            conversationId: "c1",
            source: "retrieval",
        })
    })

    it("logs the original record failure with its conversation and preserves the reply", async () => {
        const { notes, gaps, logger } = await build()
        const cause = new Error("gap storage unavailable")
        gaps.record.mockRejectedValueOnce(cause)
        await expect(notes.note(noteOf({ needsHuman: true }))).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(AgentKnowledgeLogEvent.GapNoteFailed, cause, {
            conversationId: "c1",
        })
    })
})
