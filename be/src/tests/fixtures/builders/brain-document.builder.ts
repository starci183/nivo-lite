import { builder, type MockOf } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS, docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
import { TRIAGE_VERSION } from "@modules/domain/brain/passage-triage.policy"
import type { BrainExtractionsService } from "@modules/domain/brain-extractions"
import type { BrainFactsReadService, BrainFactsService, FactRecord, ProposeResult } from "@modules/domain/brain-facts"
import type { PublicDocumentsService } from "@modules/domain/public-documents"
import type { WorkspaceMember, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { PassageCritique, TruthCritiqueGate } from "@modules/domain/brain/direct-apply.policy"
import type { DocumentPartsService, TruthCeilingService } from "@modules/domain/brain"
import { passageTextHashOf, type TruthPassage } from "@modules/domain/knowledge-chunks"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import type { UsageMeterService } from "@modules/domain/knowledge"
import type { AiChatAnswer, AiCutSpend, AiService, AiUsage } from "@modules/integrations/ai"
import type { Reading } from "@modules/domain/brain/document-truths.contracts"
import type { NatureInForce } from "@modules/domain/brain/document-nature.policy"
import type { DocumentNatureService } from "@modules/domain/brain/document-nature.service"
import type { FactEmbeddingsService } from "@modules/domain/brain/fact-embeddings.service"

/** A partial-object matcher typed `unknown`, so it flows into any slot without spreading an `any`. */
export const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A substring matcher typed `unknown`, so it flows into any slot without spreading an `any`. */
export const stringLike = (part: string): unknown => expect.stringContaining(part)

/** The tokens a model call spends in the stage specs. */
export const STAGES_USAGE: AiUsage = { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.0001 }

/** The reading state a stage starts from. */
export const STAGES_STATE: Reading = { hash: "h", done: 0, filed: 0, attempts: 0, orphans: [], model: "" }

/** One passage that states a rule. */
export const STAGES_RULE = "Shipping inside the city is 30.000 VND for every order of the shop."

/** A table of records (no rule in it). */
export const STAGES_TABLE = "ticket | bike | price\nWS-26-01 | road | 350.000\nWS-26-02 | city | 420.000\nWS-26-03 | gravel | 510.000"

/** The nature of a document that is the business's own rules with no judged table. */
export const STAGES_RULES_DOC: NatureInForce = { nature: "rules", sections: [], tables: {}, by: "model" }

/** A model call cut at its cap, as the gateway reports what it spent. */
export const STAGES_CUT_SPEND: AiCutSpend = {
    model: "claude-haiku-5-5",
    usage: STAGES_USAGE,
    served: { upstream: "anthropic", finishReason: "max_tokens", durationMs: 3 },
    cap: 200,
}

/** The ready internal document the stage specs read. */
export const stageSource: SourceRecord = docSourceOf({ status: "ready", title: "Handbook", visibility: "internal" })

/** A stored passage of the document, by default not yet judged and not yet read. */
export const stagePassageOf = (order: number, text: string, state: Partial<TruthPassage> = {}): TruthPassage => ({
    id: `c${String(order)}`,
    order,
    text,
    hash: passageTextHashOf(text),
    triage: null,
    triageVersion: null,
    truthsVersion: null,
    ...state,
})

/** `count` rule passages, each stating the rule once under its own branch. */
export const stageRulesOf = (count: number): Array<TruthPassage> =>
    Array.from({ length: count }, (_, index) =>
        stagePassageOf(index, `${STAGES_RULE} Branch ${String(index)}.`, { triage: "rule", triageVersion: TRIAGE_VERSION }),
    )

/** What the model answers: its text and the bookkeeping of the call. */
export const stageReply = (text: string): AiChatAnswer => ({ text, model: "haiku", usage: STAGES_USAGE, parsed: null, retrieved: 0 })

/** One truth row, as the brain keeps it. */
export const factRecordOf: (changes?: Partial<FactRecord>) => FactRecord = builder<FactRecord>({
    id: "f1",
    subjectType: "policy",
    subjectKey: "giao-hang",
    subjectLabel: "Giao hang",
    attribute: "phi",
    attributeLabel: "phi",
    value: "30.000",
    valueNumber: 30_000,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "proposed",
    sourceKind: "document",
    trust: 75,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Doc",
    proposedAt: "2026-11-11T03:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

/** The answer of `propose` for a truth that was filed as a proposal: the row carries the id and the value it was filed with. */
export const filedAs = (id: string, value: string): Promise<ProposeResult> => Promise.resolve({ fact: factRecordOf({ id, value }), outcome: "proposed" as const, created: true })

/** The doubles a stage spec scripts: the model, the usage meter, the same-meaning judge and the document's map (the business's own rules). */
export interface StageDoubles {
    readonly ai: MockOf<AiService>
    readonly usage: MockOf<UsageMeterService>
    readonly vectors: MockOf<FactEmbeddingsService>
    readonly nature: MockOf<DocumentNatureService>
}

/** Scripts the doubles of a stage spec for a document that is the business's own rules. */
export const scriptStageDoubles = ({ ai, usage, vectors, nature }: StageDoubles): void => {
    // The stages call `attempt`; the scripted answers stay on `chat`: an answer is a try that answered, none a provider failure.
    ai.attempt.mockImplementation(async (request) => {
        const answer = await ai.chat(request)
        return answer === null ? { ok: false, failure: "provider" } : { ok: true, answer }
    })
    // By default the document is the business's own rules with no judged table: every passage is rule material.
    nature.natureFor.mockResolvedValue({ kind: "ready", nature: STAGES_RULES_DOC, calls: 0 })
    usage.blockedBy.mockResolvedValue(false)
    vectors.checkSameMeaning.mockResolvedValue({ judged: 0, flagged: 0 })
}

/** The hash of the one passage the settle specs read. */
export const SETTLE_HASH = "hash-a"

/** The reading state a settle starts from. */
export const SETTLE_STATE: Reading = { hash: "h", done: 1, filed: 2, attempts: 0, orphans: [], model: "haiku" }

/** A waiting truth filed from the document's passage. */
export const settleProposalOf: (changes?: Partial<FactRecord>) => FactRecord = builder<FactRecord>({
    id: "f1",
    subjectType: "policy",
    subjectKey: "giao-hang",
    subjectLabel: "Giao hang",
    attribute: "phi",
    attributeLabel: "phi",
    value: "30.000",
    valueNumber: 30_000,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "proposed",
    sourceKind: "document",
    trust: 75,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [{ kind: "document", ref: DOC_SOURCE, label: "Doc", sourceId: DOC_SOURCE, chunkHash: SETTLE_HASH }],
    proposedBy: "Doc",
    proposedAt: "2026-11-11T03:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

/** A finished critique that reviewed the one passage and holds nothing. */
export const settleReviewed: PassageCritique = { state: "done", reviewed: new Set([SETTLE_HASH]), held: new Set(), confirmedBy: new Map() }

/** The document the founder uploaded. */
export const settleFounderDoc: SourceRecord = docSourceOf({ createdBy: "founder", status: "ready" })

/** A membership row of the workspace. */
const memberOf = builder<WorkspaceMember>({
    userId: "founder",
    workspaceId: DOC_WS,
    role: "owner",
    staffId: null,
    displayName: "Founder",
    status: "active",
})

/**
 * The active members the settle specs know, by user id: the founder, a manager and a staff member. Anyone else (a person who left,
 * an API key) is refused by the membership check, as `WorkspaceMembersService.require` does.
 */
export const SETTLE_MEMBERS: ReadonlyMap<string, WorkspaceMember> = new Map([
    ["founder", memberOf()],
    ["manager", memberOf({ userId: "manager", role: "manager", displayName: "Minh Manager" })],
    ["staff", memberOf({ userId: "staff", role: "staff", staffId: "st1", displayName: "Sau Staff" })],
])

/** The doubles a settle spec scripts. */
export interface SettleDoubles {
    readonly facts: MockOf<BrainFactsService>
    readonly reads: MockOf<BrainFactsReadService>
    readonly extractions: MockOf<BrainExtractionsService>
    readonly members: MockOf<WorkspaceMembersService>
    readonly ceiling: MockOf<TruthCeilingService>
    readonly critic: MockOf<TruthCritiqueGate>
    readonly publicDocuments: MockOf<PublicDocumentsService>
    readonly parts: MockOf<DocumentPartsService>
    readonly vectors: MockOf<FactEmbeddingsService>
}

/** What one settle spec starts from: the truths waiting, the critic's word, whether the critic can be asked. */
export interface SettleScript {
    readonly waiting: ReadonlyArray<FactRecord>
    readonly critique: PassageCritique
    readonly bare: boolean
}

/** Scripts the doubles of a settle spec: a ready workspace with room, a document of one part. */
export const scriptSettleDoubles = (doubles: SettleDoubles, script: SettleScript): void => {
    const { facts, reads, extractions, members, ceiling, critic, publicDocuments, parts, vectors } = doubles
    publicDocuments.approverOf.mockResolvedValue(null)
    vectors.recheckBeforeForce.mockResolvedValue("clear")
    parts.wholeOf.mockResolvedValue([DOC_SOURCE])
    reads.byIds.mockResolvedValue([])
    reads.kinOf.mockResolvedValue([])
    reads.ofSources.mockResolvedValue(script.waiting)
    facts.byKey.mockResolvedValue([])
    facts.get.mockResolvedValue(null)
    extractions.get.mockResolvedValue(null)
    ceiling.room.mockResolvedValue({ truths: 10, bytes: 10_000 })
    // A critic that has no such read yet (bare): the settle must take it as "no point holds anything".
    if (!script.bare) critic.truthGateOf.mockResolvedValue(script.critique)
    members.require.mockImplementation((userId) => {
        const member = SETTLE_MEMBERS.get(userId)
        return member === undefined ? Promise.reject(new Error("not a member")) : Promise.resolve(member)
    })
}
