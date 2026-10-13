import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AuthorityService } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { WorkContext } from "@modules/domain/decisions"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { LEAD_TURN_READER } from "./lead-flows.decorators"
import type { LeadTurnReader } from "./lead-flows.port"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DEFAULT_CRITERIA } from "./lead-flow-score.policy"
import { flagsOf, parseAnalysis } from "./lead-flow-steps.policy"
import { LeadFlowTurnService } from "./lead-flow-turn.service"
import type { TurnRequest } from "./lead-flow-turn.service"
import { LeadFlowsLogEvent } from "./lead-flows.log-events"

const NOW = "2026-10-12T10:00:00.000Z"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const factOf = builder<FactRecord>({
    id: "fact-1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "qualification-questions",
    attributeLabel: "Qualification questions",
    value: "1. What do you need?\n2. When?",
    valueNumber: null,
    unit: null,
    scope: "internal",
    modules: ["lead_gen"],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 1,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Lan",
    proposedAt: NOW,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const requestOf = builder<TurnRequest>({
    agent: null,
    turn: "t:1",
    kind: "dm",
    text: "How much is a box of tea?",
    name: "Lan",
    pendingQuestion: null,
    criteriaText: "",
    first: false,
})

const build = async () => {
    const facts = mock<BrainFactsService>()
    const knowledge = mock<KnowledgeSearchService>()
    const gaps = mock<KnowledgeGapsService>()
    const authority = mock<AuthorityService>()
    const ai = mock<LeadTurnReader>()
    const logger = mock<Logger>()
    facts.search.mockResolvedValue([])
    knowledge.passagesText.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowTurnService,
            { provide: BrainFactsService, useValue: facts },
            { provide: KnowledgeSearchService, useValue: knowledge },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: AuthorityService, useValue: authority },
            { provide: LEAD_TURN_READER, useValue: ai },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { turns: moduleRef.get(LeadFlowTurnService), facts, gaps, authority, ai, logger }
}

describe("LeadFlowTurnService", () => {
    it("reads the owner's questions from the Second Brain and falls back to the default criteria", async () => {
        const { turns, facts, logger } = await build()
        facts.forView.mockResolvedValueOnce([factOf()])
        const failure = new Error("facts down")
        facts.forView.mockRejectedValueOnce(failure)

        await expect(turns.setup("ws-1")).resolves.toEqual({
            questions: ["What do you need?", "When?"],
            criteriaText: "",
            criteria: DEFAULT_CRITERIA,
        })
        await expect(turns.setup("ws-1")).resolves.toEqual({
            questions: [],
            criteriaText: "",
            criteria: DEFAULT_CRITERIA,
        })

        expect(facts.forView).toHaveBeenCalledWith("ws-1", "internal", "lead_gen", null, 300)
        expect(logger.error).toHaveBeenCalledWith(LeadFlowsLogEvent.SetupUnreadable, failure, { workspaceId: "ws-1" })
    })

    it("settles a keyword escalation without calling the model", async () => {
        const { turns, ai } = await build()

        await expect(turns.read(ctx, requestOf({ text: "I want a refund now" }))).resolves.toEqual({
            analysis: parseAnalysis({ flags: flagsOf("refund"), sentiment: "negative", confidence: 1 }, "t:1"),
            keywordReason: "refund",
        })

        expect(ai.readLeadTurn).not.toHaveBeenCalled()
    })

    it("reads a turn with one model call in the owner's voice", async () => {
        const { turns, ai, authority } = await build()
        authority.load.mockResolvedValue({ policies: "", reply_style: "short", brand_voice: "Warm", limits_note: "" })
        ai.readLeadTurn.mockResolvedValue({ reply: "A box is on our price list", confidence: 0.9 })

        await expect(turns.read(ctx, requestOf())).resolves.toEqual({
            analysis: parseAnalysis({ reply: "A box is on our price list", confidence: 0.9 }, "t:1"),
            keywordReason: null,
        })

        expect(ai.readLeadTurn).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "en" },
            {
                agentName: null,
                agentInstructions: "",
                kind: "dm",
                text: "How much is a box of tea?",
                name: "Lan",
                pendingQuestion: null,
                criteriaText: "",
                first: false,
                voice: "Warm\nshort",
                brief: "",
            },
        )
    })

    it("answers no reading when the model fails", async () => {
        const { turns, ai, authority, logger } = await build()
        authority.load.mockResolvedValue(null)
        const failure = new Error("model down")
        ai.readLeadTurn.mockRejectedValue(failure)

        await expect(turns.read(ctx, requestOf())).resolves.toEqual({ analysis: null, keywordReason: null })

        expect(logger.error).toHaveBeenCalledWith(LeadFlowsLogEvent.TurnUnread, failure, {
            workspaceId: "ws-1",
            turn: "t:1",
        })
    })

    it("remembers a question the knowledge could not answer and survives a failed write", async () => {
        const { turns, gaps, logger } = await build()
        const failure = new Error("gaps down")
        gaps.record.mockRejectedValue(failure)

        await expect(
            turns.noteGap("ws-1", {
                question: "Do you ship abroad?",
                topic: "shipping | abroad",
                conversationId: "conv-1",
            }),
        ).resolves.toBeUndefined()

        expect(gaps.record).toHaveBeenCalledWith("ws-1", {
            module: "lead_gen",
            question: "Do you ship abroad?",
            topic: "shipping | abroad",
            conversationId: "conv-1",
            source: "model",
        })
        expect(logger.error).toHaveBeenCalledWith(LeadFlowsLogEvent.GapNotNoted, failure, { workspaceId: "ws-1" })
    })
})
