import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AuthorityService } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { WorkContext } from "@modules/domain/decisions"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { Passage } from "@modules/domain/knowledge"
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

const passageOf = builder<Passage>({
    layer: "business",
    id: "passage-1",
    sourceId: "source-1",
    module: "lead_gen",
    kind: "document",
    title: "Tea catalogue",
    content: "A box of tea costs 100.",
    score: 0.9,
    visibility: "public",
    topic: "tea | price",
})

const KNOWLEDGE_HEADER =
    "BUSINESS KNOWLEDGE (use only what is here; never invent a price, policy, date or promise that is not written):"

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
    return { turns: moduleRef.get(LeadFlowTurnService), facts, knowledge, gaps, authority, ai, logger }
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
})

describe("LeadFlowTurnService", () => {
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
})

describe("LeadFlowTurnService", () => {
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
    it("reads the first criteria and ideal customer setup facts alongside the owner's questions", async () => {
        const { turns, facts } = await build()
        const criteriaText = "Hot: phone and need. Warm: contact."
        facts.forView.mockResolvedValue([
            factOf({ attribute: "opening-hours", value: "9-5" }),
            factOf(),
            factOf({ attribute: "hot-warm-cold", value: criteriaText }),
            factOf({ attribute: "hot-warm-cold", value: "Hot: budget" }),
            factOf({ attribute: "ideal-customer", value: "Customers in Hanoi" }),
        ])

        await expect(turns.setup("ws-1")).resolves.toEqual({
            questions: ["What do you need?", "When?"],
            criteriaText,
            criteria: {
                hot: { all: ["need", "contact"], any: [] },
                warm: { all: ["contact"] },
                areaMatters: true,
            },
        })
        expect(facts.forView).toHaveBeenCalledWith("ws-1", "internal", "lead_gen", null, 300)
    })
})

describe("LeadFlowTurnService", () => {
    it("embeds the first turn and passes the persona, facts and only public documents to the model", async () => {
        const { turns, facts, knowledge, authority, ai } = await build()
        const request = requestOf({
            agent: {
                id: "agent-1",
                name: "Tea advisor",
                handle: "tea",
                role: "lead_gen",
                instructions: "Ask one question at a time",
                knowledge: "Owner notes",
                approval_rule: "manual",
            },
            first: true,
            pendingQuestion: "How many boxes?",
            criteriaText: "Hot: needs tea",
        })
        authority.load.mockResolvedValue({ policies: "", reply_style: "short", brand_voice: "", limits_note: "" })
        facts.search.mockResolvedValue([factOf({ attributeLabel: "Price", value: "100 per box" })])
        knowledge.passages.mockResolvedValue([
            passageOf({ content: `  A   box\n costs 100.\t${"x".repeat(450)}` }),
            passageOf({ title: "Internal margin", content: "Never show this", visibility: "internal" }),
        ])
        ai.readLeadTurn.mockResolvedValue({ confidence: 0.9 })

        await expect(turns.read(ctx, request)).resolves.toEqual({
            analysis: parseAnalysis({ confidence: 0.9 }, "t:1"),
            keywordReason: null,
        })
        expect(authority.load).toHaveBeenCalledWith({ workspaceId: "ws-1" })
        expect(facts.search).toHaveBeenCalledWith("ws-1", "customer", "lead_gen", null, request.text, 5)
        expect(knowledge.passages).toHaveBeenCalledWith(
            { workspaceId: "ws-1", module: "lead_gen", audience: "customer", installationId: null },
            request.text,
            4,
        )
        expect(knowledge.passagesText).not.toHaveBeenCalled()
        expect(ai.readLeadTurn).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "en" },
            {
                agentName: "Tea advisor",
                agentInstructions: "Ask one question at a time",
                kind: "dm",
                text: request.text,
                name: "Lan",
                pendingQuestion: "How many boxes?",
                criteriaText: "Hot: needs tea",
                first: true,
                voice: "short",
                brief: [
                    KNOWLEDGE_HEADER,
                    "\nConfirmed facts:\n- Shop - Price: 100 per box\nFrom the business documents:\n- Tea ",
                    "catalogue:  A box costs 100. ",
                    "x".repeat(381),
                    "\u2026",
                ].join(""),
            },
        )
        expect(ai.readLeadTurn).toHaveBeenCalledTimes(1)
    })
})

describe("LeadFlowTurnService", () => {
    it("uses word search for later turns and keeps facts when there are no public documents", async () => {
        const { turns, facts, knowledge, authority, ai } = await build()
        authority.load.mockResolvedValue({ policies: "", reply_style: "", brand_voice: "Warm", limits_note: "" })
        facts.search.mockResolvedValue([factOf({ attributeLabel: "Shipping", value: "Nationwide" })])
        knowledge.passagesText.mockResolvedValue([passageOf({ visibility: "internal" })])
        ai.readLeadTurn.mockResolvedValue({ reply: "We ship nationwide" })

        await expect(turns.read(ctx, requestOf())).resolves.toEqual({
            analysis: parseAnalysis({ reply: "We ship nationwide" }, "t:1"),
            keywordReason: null,
        })
        expect(knowledge.passagesText).toHaveBeenCalledWith(
            { workspaceId: "ws-1", module: "lead_gen", audience: "customer", installationId: null },
            "How much is a box of tea?",
            4,
        )
        expect(knowledge.passages).not.toHaveBeenCalled()
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
                voice: "Warm",
                brief: `${KNOWLEDGE_HEADER}\nConfirmed facts:\n- Shop - Shipping: Nationwide`,
            },
        )
    })
    it("keeps document knowledge when fact search fails and logs the failed retrieval", async () => {
        const { turns, facts, knowledge, authority, ai, logger } = await build()
        const failure = new Error("facts unavailable")
        authority.load.mockResolvedValue(null)
        facts.search.mockRejectedValue(failure)
        knowledge.passagesText.mockResolvedValue([passageOf()])
        ai.readLeadTurn.mockResolvedValue({ reply: "A box costs 100" })

        await expect(turns.read(ctx, requestOf())).resolves.toEqual({
            analysis: parseAnalysis({ reply: "A box costs 100" }, "t:1"),
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
                voice: "",
                brief: `${KNOWLEDGE_HEADER}\nFrom the business documents:\n- Tea catalogue: A box of tea costs 100.`,
            },
        )
        expect(logger.error).toHaveBeenCalledWith(LeadFlowsLogEvent.KnowledgeUnreadable, failure, {
            workspaceId: "ws-1",
        })
    })
})

describe("LeadFlowTurnService", () => {
    it("caps the public brief at 1800 characters and survives a document search failure", async () => {
        const { turns, facts, knowledge, authority, ai, logger } = await build()
        const failure = new Error("documents unavailable")
        authority.load.mockResolvedValue(null)
        facts.search.mockResolvedValue([factOf({ attributeLabel: "Notes", value: "x".repeat(2000) })])
        knowledge.passagesText.mockRejectedValue(failure)
        ai.readLeadTurn.mockResolvedValue({})

        await expect(turns.read(ctx, requestOf())).resolves.toEqual({
            analysis: parseAnalysis({}, "t:1"),
            keywordReason: null,
        })
        const prefix = `${KNOWLEDGE_HEADER}\nConfirmed facts:\n- Shop - Notes: `
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
                voice: "",
                brief: prefix + "x".repeat(1800 - prefix.length),
            },
        )
        expect(logger.error).toHaveBeenCalledWith(LeadFlowsLogEvent.KnowledgeUnreadable, failure, {
            workspaceId: "ws-1",
        })
    })
})
