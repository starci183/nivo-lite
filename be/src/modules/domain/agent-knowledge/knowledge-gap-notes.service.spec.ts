import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import type { GapRecord, MaybeGapRecorded } from "@modules/domain/knowledge-gaps"
import { GapProposalsService } from "@modules/domain/public-documents"
import { LOGGER } from "@modules/platform/logging"
import type { GapNote } from "./agent-knowledge.contracts"
import { AgentKnowledgeLogEvent } from "./agent-knowledge.log-events"
import { KnowledgeGapNotesService } from "./knowledge-gap-notes.service"

const WS = "11111111-1111-4111-8111-111111111111"

/** A bicycle workshop's customer turn (synthetic trade). */
const noteOf = (signals: Partial<GapNote["signals"]> = {}): GapNote => ({
    view: {
        workspaceId: WS,
        module: "chatbot",
        audience: "customer",
        installationId: null,
    },
    conversationId: "c1",
    question: "Do you true carbon wheels on Saturdays?",
    signals: { knowledgeGap: null, needsHuman: false, proposedAnswer: null, isTransaction: false, ...signals },
})

/** The model of the turn claimed a gap. */
const CLAIMED = { question: "Carbon wheel truing on Saturday?", topic: "Wheel truing | Saturday hours" }

const build = async () => {
    const gaps = mock<KnowledgeGapsService>({ record: jest.fn().mockResolvedValue(null) })
    const logger = mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
    const proposals = mock<GapProposalsService>({ open: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeGapNotesService,
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: GapProposalsService, useValue: proposals },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { notes: moduleRef.get(KnowledgeGapNotesService), gaps, logger, proposals }
}

describe("KnowledgeGapNotesService: the model's claim", () => {
    it("records the exact gap the turn's model claimed, with its topic, whatever the other signals say", async () => {
        const { notes, gaps } = await build()
        await notes.note(
            noteOf({
                knowledgeGap: { question: " Carbon wheel truing on Saturday? ", topic: CLAIMED.topic },
                proposedAnswer: "Ask the mechanic.",
                isTransaction: true,
            }),
        )

        expect(gaps.record).toHaveBeenCalledTimes(1)
        expect(gaps.record).toHaveBeenCalledWith(WS, {
            module: "chatbot",
            question: " Carbon wheel truing on Saturday? ",
            topic: CLAIMED.topic,
            conversationId: "c1",
            source: "model",
        })
    })

    it.each<Partial<GapNote["signals"]>>([
        { knowledgeGap: null, needsHuman: true },
        { knowledgeGap: null, needsHuman: true, proposedAnswer: null, isTransaction: false },
        { knowledgeGap: null, needsHuman: false, proposedAnswer: "We true wheels on Saturdays." },
        { knowledgeGap: { question: " \t ", topic: "Wheel truing | Saturday hours" }, needsHuman: true },
        { knowledgeGap: { question: "", topic: "" }, isTransaction: true },
    ])("no model claim (null or blank) records nothing, whatever the escalation says: %j", async (signals) => {
        const { notes, gaps, proposals } = await build()

        await notes.note(noteOf(signals))

        expect(gaps.record).not.toHaveBeenCalled()
        expect(proposals.open).not.toHaveBeenCalled()
    })

    it("logs a record failure with its conversation and never throws", async () => {
        const { notes, gaps, logger } = await build()
        const cause = new Error("gap storage unavailable")
        gaps.record.mockRejectedValueOnce(cause)

        await expect(notes.note(noteOf({ knowledgeGap: CLAIMED }))).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(AgentKnowledgeLogEvent.GapNoteFailed, cause, { conversationId: "c1" })
    })
})

describe("KnowledgeGapNotesService proposals", () => {
    const gap: GapRecord = {
        id: "g1",
        module: "chatbot",
        question: CLAIMED.question,
        topic: "Wheel truing",
        attributeGuess: "Saturday hours",
        count: 1,
        firstSeenAt: "2026-11-01T00:00:00.000Z",
        lastSeenAt: "2026-11-01T00:00:00.000Z",
        exampleConversationId: "c1",
        status: "open",
        reopenedCount: 0,
    }
    const recorded = (flags: Pick<NonNullable<MaybeGapRecorded>, "isNew" | "reopened">) => ({ gap, ...flags })

    it("starts the look for an internal answer when the claimed gap is new", async () => {
        const { notes, gaps, proposals } = await build()
        gaps.record.mockResolvedValue(recorded({ isNew: true, reopened: false }))

        await notes.note(noteOf({ knowledgeGap: CLAIMED }))

        expect(proposals.open).toHaveBeenCalledTimes(1)
        expect(proposals.open).toHaveBeenCalledWith(WS, gap)
    })

    it("starts it again for a gap that was answered and asked again", async () => {
        const { notes, gaps, proposals } = await build()
        gaps.record.mockResolvedValue(recorded({ isNew: false, reopened: true }))

        await notes.note(noteOf({ knowledgeGap: CLAIMED }))

        expect(proposals.open).toHaveBeenCalledTimes(1)
    })

    it("does not start it for a gap that only counted once more, or a question with no gap", async () => {
        const { notes, gaps, proposals } = await build()
        gaps.record.mockResolvedValueOnce(recorded({ isNew: false, reopened: false }))
        gaps.record.mockResolvedValueOnce(null)

        await notes.note(noteOf({ knowledgeGap: CLAIMED }))
        await notes.note(noteOf({ knowledgeGap: CLAIMED }))

        expect(proposals.open).not.toHaveBeenCalled()
    })

    it("never throws when the look cannot be started", async () => {
        const { notes, gaps, proposals, logger } = await build()
        gaps.record.mockResolvedValue(recorded({ isNew: true, reopened: false }))
        proposals.open.mockRejectedValue(new Error("queue down"))

        await expect(notes.note(noteOf({ knowledgeGap: CLAIMED }))).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalled()
    })
})
