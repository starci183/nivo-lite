import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import {
    BrainChangeRequestsService,
    BrainFactRelationsService,
    BrainFactsError,
    BrainFactsErrorCode,
    BrainFactsReadService,
} from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import type { SourceDocument } from "@modules/domain/knowledge-sources"
import type { Passage } from "@modules/domain/knowledge"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { CLOCK } from "@modules/platform/clock"
import { BRAIN_NOTICE, BrainNativeService } from "./brain-native.service"
import { nativeRefusal } from "./native-refusal.policy"
import { viewOfCall } from "./native-view.policy"
import { NativeViewService } from "./native-view.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = { agentId: "a1", conversationId: null }
const NOW = new Date("2026-10-31T00:00:00.000Z")

const fact = (changes: Partial<FactRecord> = {}): FactRecord => ({
    id: "f1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8 to 21",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [{ kind: "document", ref: "https://x", label: "Price list", quote: "private words", connectionId: "c9" }],
    proposedBy: "u1",
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    ...changes,
})

const passage = (changes: Partial<Passage> = {}): Passage => ({
    layer: "business",
    id: "p1",
    sourceId: "s1",
    module: null,
    kind: "faq",
    title: "Hours",
    content: "Open 8 to 21",
    score: 0.9,
    visibility: "public",
    topic: "hours",
    order: 2,
    ...changes,
})

const document = (changes: Partial<SourceDocument> = {}): SourceDocument => ({
    id: "d1",
    title: "Delivery policy",
    visibility: "internal",
    status: "ready",
    contentHash: "h1",
    module: null,
    installationId: null,
    topic: "delivery",
    content: "Same day delivery. Call 0901234567 when needed.",
    ...changes,
})

interface Scope {
    readonly module: string
    readonly installationId: string | null
}

const build = async (scope: Scope = { module: "sales", installationId: null }) => {
    const views = mock<NativeViewService>()
    views.of.mockImplementation((workspaceId, caller) =>
        Promise.resolve(viewOfCall(workspaceId, scope, caller.conversationId)),
    )
    const facts = mock<BrainFactsReadService>()
    facts.search.mockResolvedValue([fact()])
    facts.forView.mockResolvedValue([fact()])
    facts.get.mockResolvedValue(fact())
    views.internalOf.mockImplementation((workspaceId, caller) => {
        const view = viewOfCall(workspaceId, scope, caller.conversationId)
        if (caller.conversationId !== null || view.audience === "customer") {
            return Promise.reject(nativeRefusal("internal_only"))
        }
        return Promise.resolve(view)
    })
    const knowledge = mock<KnowledgeSearchService>()
    knowledge.forAgent.mockResolvedValue([passage()])
    const documents = mock<KnowledgeSourcesReadService>()
    documents.textOf.mockResolvedValue(document())
    const relations = mock<BrainFactRelationsService>()
    relations.ofFacts.mockResolvedValue([])
    facts.byIds.mockResolvedValue([])
    const changes = mock<BrainChangeRequestsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: BrainFactsReadService, useValue: facts },
            { provide: KnowledgeSearchService, useValue: knowledge },
            { provide: KnowledgeSourcesReadService, useValue: documents },
            { provide: BrainFactRelationsService, useValue: relations },
            { provide: BrainChangeRequestsService, useValue: changes },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { brain: moduleRef.get(BrainNativeService), views, facts, knowledge, documents, relations, changes }
}

const OTHER = "22222222-2222-4222-8222-222222222222"
const EDGE = {
    id: "e1",
    fromFactId: "f1",
    toFactId: OTHER,
    kind: "part_of" as const,
    label: "giao bang",
    createdBy: "NIVO",
    createdAt: NOW.toISOString(),
}

describe("BrainNativeService fact.related", () => {
    const ID = "33333333-3333-4333-8333-333333333333"

    it("follows the edges of a readable truth to the readable truths at their other end, with the relation", async () => {
        const { brain, facts, relations } = await build()
        facts.get.mockResolvedValue(fact({ id: ID }))
        relations.ofFacts.mockResolvedValue([{ ...EDGE, fromFactId: ID }])
        facts.byIds.mockResolvedValue([fact({ id: OTHER, subjectLabel: "Delivery", version: 2 })])

        const answer = await brain.invoke(WS, "fact.related", { id: ID }, AGENT)

        expect(relations.ofFacts).toHaveBeenCalledWith(WS, [ID])
        expect(facts.byIds).toHaveBeenCalledWith(WS, [OTHER])
        expect(answer).toMatchObject({
            notice: BRAIN_NOTICE,
            related: [
                {
                    relation: "part_of",
                    direction: "out",
                    label: "giao bang",
                    fact: { id: OTHER, subject: "Delivery", version: 2 },
                },
            ],
        })
    })

    it("leaves out a truth at the other end that the lens may not read (internal truth, customer-facing caller)", async () => {
        const { brain, facts, relations } = await build({ module: "chatbot", installationId: null })
        facts.get.mockResolvedValue(fact({ id: ID }))
        relations.ofFacts.mockResolvedValue([{ ...EDGE, fromFactId: ID }])
        facts.byIds.mockResolvedValue([fact({ id: OTHER, scope: "internal" })])

        const answer = await brain.invoke(WS, "fact.related", { id: ID }, { agentId: "a1", conversationId: "c1" })

        expect(answer).toMatchObject({ related: [] })
    })

    it("refuses a truth the caller may not read as not found, before reading edges", async () => {
        const { brain, facts, relations } = await build()
        facts.get.mockResolvedValue(fact({ id: ID, status: "proposed" }))

        await expect(brain.invoke(WS, "fact.related", { id: ID }, AGENT)).rejects.toMatchObject({
            params: { reason: "not_found" },
        })
        expect(relations.ofFacts).not.toHaveBeenCalled()
    })
})

describe("BrainNativeService change.propose", () => {
    const MESSAGE = "44444444-4444-4444-8444-444444444444"
    const ARGS = {
        subject: "Phi ship noi thanh",
        attribute: "gia",
        value: "30.000 d",
        room: "direct",
        messageId: MESSAGE,
        quote: "tu mai phi ship noi thanh 30k nhe",
    }

    it("files a change request from a private chat for the founder, in the caller's lane", async () => {
        const { brain, changes } = await build({ module: "sales", installationId: "i1" })
        changes.propose.mockResolvedValue({ outcome: "filed", fact: fact({ id: "p1", status: "proposed", value: "30.000 d" }) })

        const answer = await brain.invoke(WS, "change.propose", ARGS, AGENT)

        expect(changes.propose).toHaveBeenCalledWith(WS, {
            subjectLabel: "Phi ship noi thanh",
            attributeLabel: "gia",
            value: "30.000 d",
            unit: null,
            room: "direct",
            messageId: MESSAGE,
            quote: "tu mai phi ship noi thanh 30k nhe",
            validFrom: null,
            validTo: null,
            proposedBy: "sales",
            agentId: "a1",
            installationId: "i1",
        })
        expect(answer).toMatchObject({ outcome: "filed", changeRequest: { id: "p1", status: "proposed", waitsFor: "founder" } })
    })

    it("refuses a customer conversation before anything is filed", async () => {
        const { brain, changes } = await build()

        await expect(
            brain.invoke(WS, "change.propose", ARGS, { agentId: "a1", conversationId: "c1" }),
        ).rejects.toMatchObject({ params: { reason: "internal_only" } })
        expect(changes.propose).not.toHaveBeenCalled()
    })

    it.each([
        ["a value and retire together", { ...ARGS, retire: true }],
        ["neither a value nor retire", { ...ARGS, value: undefined }],
        ["a message id that is not one", { ...ARGS, messageId: "m1" }],
        ["another room", { ...ARGS, room: "customer" }],
    ])("refuses %s as invalid arguments", async (_name, args) => {
        const { brain, changes } = await build()

        await expect(brain.invoke(WS, "change.propose", args, AGENT)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
        })
        expect(changes.propose).not.toHaveBeenCalled()
    })

    it("answers a retire request with nothing in force as not found", async () => {
        const { brain, changes } = await build()
        changes.propose.mockRejectedValue(new BrainFactsError({ code: BrainFactsErrorCode.NotActive }))
        const { value: _value, ...retire } = ARGS

        await expect(brain.invoke(WS, "change.propose", { ...retire, retire: true }, AGENT)).rejects.toMatchObject({
            params: { reason: "not_found" },
        })
    })
})
