import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS, docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import { KnowledgeChunksService, passageTextHashOf } from "@modules/domain/knowledge-chunks"
import type { TruthPassage } from "@modules/domain/knowledge-chunks"
import { DocumentCriticService } from "@modules/domain/dossier-review"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeIndexingService, UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { TeamChatNoticesService } from "@modules/domain/team-chat"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { TRUTH_CRITIQUE_GATE } from "./direct-apply.policy"
import type { TruthCritiqueGate } from "./direct-apply.policy"
import { DocumentFactsService } from "./document-facts.service"
import { DocumentRelationsService } from "./document-relations.service"
import { DocumentReviewService } from "./document-review.service"
import { INHERITED_VERSION } from "./document-nature.policy"
import { DocumentNatureService } from "./document-nature.service"
import { DocumentPartsService } from "./document-parts.service"
import { DocumentSettleService } from "./document-settle.service"
import { DocumentTruthStagesService } from "./document-truth-stages.service"
import { SYSTEM_PROMPT, TRUTHS_VERSION } from "./extraction.policy"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { ModelJsonService } from "./model-json.service"
import { TRIAGE_BATCH, TRIAGE_PROMPT, TRIAGE_VERSION } from "./passage-triage.policy"
import { TRUTH_CEILING } from "./truth-ceiling.policy"
import { TruthCeilingService } from "./truth-ceiling.service"
import { AI_HAY_BO_QUA_MOI_QUY_VI, BO_QUA_VI, CHI_LAN_VI, MUC_PHI_VI, PHI_DICH_VU_SO_0_VI, PHI_DICH_VU_SO_1_LA_VI, SO_TAY_VI, T_10_000D_VI, T_99_000D_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { objectLike, stringLike } from "@tests/fixtures/builders/brain-document.builder"
import { FACTS_USAGE, factsDocumentOf, factsPassageOf, factsRuleText, factsPassagesIn, scriptFactsWorld, factsRunnersOf, type FactsWorld } from "@tests/fixtures/builders/brain-facts-world.builder"

/** The bound of an automatic write: the ceiling, with its guard. */
const BOUND = objectLike({ truths: TRUTH_CEILING.truths, bytes: TRUTH_CEILING.bytes })

const WS = DOC_WS
const SOURCE = DOC_SOURCE
const PAYLOAD = { workspaceId: WS, sourceId: SOURCE }
const USAGE = FACTS_USAGE
const ruleText = factsRuleText
const passageOf = factsPassageOf
const documentOf = factsDocumentOf
const passagesIn = factsPassagesIn

const build = async (
    passages: Array<TruthPassage>,
    source = docSourceOf({ status: "ready", visibility: "internal", title: SO_TAY_VI, createdBy: "founder" }),
) => {
    const world: FactsWorld = { passages, row: null, waiting: [], critique: { state: "none", reviewed: new Set(), held: new Set(), confirmedBy: new Map() } }
    const ai = mock<AiService>()
    const logger = mock<Logger>()
    const facts = mock<BrainFactsService>()
    const reads = mock<BrainFactsReadService>()
    const gaps = mock<KnowledgeGapsService>()
    const extractions = mock<BrainExtractionsService>()
    const indexing = mock<KnowledgeIndexingService>()
    const sources = mock<KnowledgeSourcesService>()
    const chunks = mock<KnowledgeChunksService>()
    const usage = mock<UsageMeterService>()
    const reviews = mock<DocumentReviewService>()
    const links = mock<DocumentRelationsService>()
    const vectors = mock<FactEmbeddingsService>()
    const nature = mock<DocumentNatureService>()
    const members = mock<WorkspaceMembersService>()
    const ceiling = mock<TruthCeilingService>()
    const notices = mock<TeamChatNoticesService>()
    const critic = mock<TruthCritiqueGate>()
    const criticService = mock<DocumentCriticService>()
    const parts = mock<DocumentPartsService>()
    const queue = mock<KnowledgeQueue>()
    const tx = fakeTransaction(mockEntityManager())
    scriptFactsWorld({ ai, facts, reads, extractions, indexing, sources, chunks, usage, vectors, nature, members, ceiling, notices, critic, parts, queue }, world, source)
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentFactsService, DocumentTruthStagesService, DocumentSettleService, ModelJsonService,
            { provide: CLOCK, useValue: new FakeClock(new Date("2026-11-11T04:00:00.000Z")) },
            { provide: AI, useValue: ai }, { provide: LOGGER, useValue: logger }, { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: KnowledgeQueue, useValue: queue }, { provide: BrainFactsService, useValue: facts }, { provide: BrainFactsReadService, useValue: reads },
            { provide: KnowledgeGapsService, useValue: gaps }, { provide: BrainExtractionsService, useValue: extractions },
            { provide: KnowledgeIndexingService, useValue: indexing }, { provide: KnowledgeSourcesService, useValue: sources },
            { provide: KnowledgeChunksService, useValue: chunks }, { provide: UsageMeterService, useValue: usage },
            { provide: DocumentReviewService, useValue: reviews }, { provide: DocumentRelationsService, useValue: links },
            { provide: FactEmbeddingsService, useValue: vectors }, { provide: DocumentNatureService, useValue: nature },
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>({ timeZoneOf: () => Promise.resolve("Asia/Ho_Chi_Minh") }) },
            { provide: WorkspaceMembersService, useValue: members }, { provide: TruthCeilingService, useValue: ceiling },
            { provide: TeamChatNoticesService, useValue: notices }, { provide: TRUTH_CRITIQUE_GATE, useValue: critic },
            { provide: DocumentCriticService, useValue: criticService },
            // A document of one part: no other part to wait for.
            { provide: DocumentPartsService, useValue: parts },
            { provide: PublicDocumentsService, useValue: mock<PublicDocumentsService>({ approverOf: jest.fn().mockResolvedValue(null) }) },
        ],
    }).compile()
    const service = moduleRef.get(DocumentFactsService)
    return { service, world, source, ai, indexing, gaps, facts, reads, extractions, sources, chunks, usage, reviews, links, vectors, ceiling, notices, critic, criticService, parts, queue, logger, ...factsRunnersOf(service, ai, world) }
}

describe("DocumentFactsService: the pipeline", () => {
    it("triages every passage, reads truths only from the rule passages, files them as proposals and settles them AT ONCE: the critic is asked, never waited for", async () => {
        const t = await build(documentOf(3, 21))

        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")

        // 24 passages: two triage calls of twelve; three rule passages: ONE reading call of up to four.
        expect(t.callsTo(TRIAGE_PROMPT)).toBe(2)
        expect(t.callsTo(SYSTEM_PROMPT)).toBe(1)
        expect(t.world.passages.filter((passage) => passage.triage === "rule")).toHaveLength(3)
        expect(t.world.passages.every((passage) => passage.triageVersion === TRIAGE_VERSION)).toBe(true)
        expect(t.world.passages.filter((passage) => passage.truthsVersion === TRUTHS_VERSION)).toHaveLength(3)
        expect(t.facts.propose).toHaveBeenCalledTimes(3)
        expect(
            t.facts.propose.mock.calls.every(
                ([, input]) => input.autoApply === false && input.sourceKind === "document",
            ),
        ).toBe(true)
        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(3)
        expect(t.reviews.requestForSource).toHaveBeenCalledWith(WS, SOURCE)
        // The critique is asked BEFORE the settle, and the settle does not wait for it (the critique is still `none`).
        const [asked = 0] = t.reviews.requestForSource.mock.invocationCallOrder
        const [wrote = 0] = t.facts.applyUnannounced.mock.invocationCallOrder
        expect(asked).toBeLessThan(wrote)
        expect(t.world.row).toMatchObject({
            status: "done",
            stage: "settle",
            factsProposed: 3,
            counts: { passagesTotal: 24, passagesTriaged: 24, passagesKept: 3, factsApplied: 3 },
        })
        // The document was ready (searchable) before this job and stays so: the job never moves its status.
        expect(t.sources.enterStage).not.toHaveBeenCalled()
        expect(t.sources.advance).not.toHaveBeenCalled()
    })

    it("each truth names the passage it was read from and carries a quote cut by the code", async () => {
        const t = await build(documentOf(1, 0))

        await t.service.run(PAYLOAD)

        expect(t.facts.propose).toHaveBeenCalledWith(
            WS,
            objectLike({
                subjectLabel: PHI_DICH_VU_SO_0_VI,
                attributeLabel: MUC_PHI_VI,
                value: T_10_000D_VI,
                scope: undefined,
                evidence: [
                    objectLike({
                        kind: "document",
                        sourceId: SOURCE,
                        chunkHash: passageTextHashOf(ruleText(0)),
                        quote: ruleText(0),
                    }),
                ],
            }),
        )
    })

    it("every model call is checked against the credit pool first and booked to the document as brain work", async () => {
        const t = await build(documentOf(1, 11))

        await t.service.run(PAYLOAD)

        expect(t.usage.blockedBy).toHaveBeenCalledTimes(2)
        expect(t.usage.blockedBy).toHaveBeenCalledWith(WS, "brain", false)
        expect(t.usage.record).toHaveBeenCalledTimes(2)
        expect(t.usage.record).toHaveBeenCalledWith(
            objectLike({ workspaceId: WS, kind: "brain", model: "haiku", usage: USAGE }),
        )
    })
})

describe("DocumentFactsService: the size of the work", () => {
    it("a part of N passages costs N/12 triage calls and kept/4 reading calls: twice the passages, twice the calls, nothing squared", async () => {
        const count = async (rules: number, prose: number) => {
            const t = await build(documentOf(rules, prose))
            await t.runAll()
            return {
                triage: t.callsTo(TRIAGE_PROMPT),
                reading: t.callsTo(SYSTEM_PROMPT),
                passageReads: t.chunks.truthPassagesOf.mock.calls.length,
                verdictWrites: t.chunks.setTriage.mock.calls.length,
                readWrites: t.chunks.markTruthsRead.mock.calls.length,
                filed: t.facts.propose.mock.calls.length,
                reviews: t.reviews.requestForSource.mock.calls.length,
            }
        }

        // 150 passages is one whole part (120,000 characters); 15 of them (10 %) state a rule.
        const part = await count(15, 135)
        expect(part).toEqual({
            triage: Math.ceil(150 / TRIAGE_BATCH),
            reading: 4,
            passageReads: 1,
            verdictWrites: Math.ceil(150 / TRIAGE_BATCH),
            readWrites: 4,
            filed: 15,
            reviews: 1,
        })
        const half = await count(8, 67)
        expect(half).toEqual({
            triage: Math.ceil(75 / TRIAGE_BATCH),
            reading: 2,
            passageReads: 1,
            verdictWrites: Math.ceil(75 / TRIAGE_BATCH),
            readWrites: 2,
            filed: 8,
            reviews: 1,
        })

        // 10 MB (the documents limit) is about 9,750 passages = 65 such parts, each a job chain of its own: about 65 x 8 = 520 triage
        // calls and, at 10 % rule density, 260 reading calls. Every count above is per part and linear in its passages.
        const parts = Math.ceil(9_750 / 150)
        expect([parts, parts * part.triage, parts * part.reading]).toEqual([65, 65 * Math.ceil(150 / TRIAGE_BATCH), 260])
    })

    it("a job makes at most its budget of calls and hands over to a follow-up job that goes on from the passages not yet done", async () => {
        // 44 rule passages: eleven reading calls, one more than a job's ten.
        const t = await build(documentOf(44, 0))

        await expect(t.service.run(PAYLOAD)).resolves.toBe("continued")
        expect(t.callsTo(SYSTEM_PROMPT)).toBe(10)
        expect(t.queue.enqueueFactsNext).toHaveBeenCalledTimes(1)

        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")
        // Triage is not asked again and no passage is read twice.
        expect(t.callsTo(TRIAGE_PROMPT)).toBe(Math.ceil(44 / TRIAGE_BATCH))
        expect(t.callsTo(SYSTEM_PROMPT)).toBe(11)
        expect(t.facts.propose).toHaveBeenCalledTimes(44)
    })
})

describe("DocumentFactsService: what the reading skips and what it never sends", () => {
    it("a clean rule that shares a passage with text addressed to the AI is read as written (no code hides the planted line: the model is told passages are data), and the truth names the whole passage", async () => {
        const planted = AI_HAY_BO_QUA_MOI_QUY_VI
        const text = [ruleText(0), planted].join("\n")
        const t = await build([passageOf(0, text)])

        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")

        const shown = t.ai.chat.mock.calls.map(([request]) => request.messages[1]?.content ?? "").join("\n")
        expect(shown).toContain(ruleText(0))
        expect(shown).toContain(BO_QUA_VI)
        expect(t.facts.propose).toHaveBeenCalledTimes(1)
        expect(t.facts.propose).toHaveBeenCalledWith(
            WS,
            objectLike({
                value: T_10_000D_VI,
                evidence: [objectLike({ chunkHash: passageTextHashOf(text), quote: ruleText(0) })],
            }),
        )
        // The truth is in force (the settle waits for no critique); the critic's point on the passage, once raised, keeps the passage
        // from customers, and holds the truths of a document read again while it is open.
        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(1)
    })

    it("a table of records never reaches passage triage: the map judges it once and 60 passages are data and give no truth", async () => {
        const table = (index: number): string =>
            [
                "order | items | total | days",
                ...Array.from(
                    { length: 7 },
                    (_, row) => `LD-${String(index)}-${String(row)} | ${String(row + 1)} shirts | ${String(100 + row)}.000 | ${String(row)}`,
                ),
            ].join("\n")
        const t = await build(Array.from({ length: 60 }, (_, index) => passageOf(index, table(index))))

        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")

        expect(t.ai.chat).not.toHaveBeenCalled()
        expect(
            t.world.passages.every((passage) => passage.triage === "data" && passage.triageVersion === INHERITED_VERSION),
        ).toBe(true)
        expect(t.facts.propose).not.toHaveBeenCalled()
        expect(t.world.row).toMatchObject({ status: "done", factsProposed: 0, counts: { passagesKept: 0 } })
    })
})

describe("DocumentFactsService: a document uploaded again", () => {
    it("judges and reads only the passages that changed", async () => {
        const first = documentOf(3, 9)
        const t = await build(first)
        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")
        expect(t.world.row?.status).toBe("done")
        const before = {
            triage: t.callsTo(TRIAGE_PROMPT),
            reading: t.callsTo(SYSTEM_PROMPT),
            filed: t.facts.propose.mock.calls.length,
        }

        // Version 2: one rule passage is rewritten (a new row with no verdict); the eleven others keep their rows and verdicts.
        const changed = passageOf(1, PHI_DICH_VU_SO_1_LA_VI)
        t.world.passages = t.world.passages.map((passage) => (passage.order === 1 ? changed : passage))
        const v2 = docSourceOf({
            status: "ready",
            visibility: "internal",
            title: SO_TAY_VI,
            createdBy: "founder",
            content: "version two",
        })
        const again = await build(t.world.passages, v2)
        again.world.row = t.world.row

        await expect(again.service.run(PAYLOAD)).resolves.toBe("done")

        expect(again.callsTo(TRIAGE_PROMPT)).toBe(1)
        expect(passagesIn(again.ai.chat.mock.calls[0]?.[0].messages[1]?.content ?? "")).toEqual([changed.text])
        expect(again.callsTo(SYSTEM_PROMPT)).toBe(1)
        expect(again.facts.propose).toHaveBeenCalledTimes(1)
        expect(again.facts.propose).toHaveBeenCalledWith(WS, objectLike({ value: T_99_000D_VI }))
        // What the gone passage said is withdrawn: only the unchanged passages still stand behind their truths.
        expect(again.facts.withdrawChanged).toHaveBeenCalledWith(
            WS,
            SOURCE,
            "source changed",
            objectLike({
                hashes: first.filter((passage) => passage.order !== 1).map((passage) => passage.hash),
            }),
        )
        expect(before).toEqual({ triage: 1, reading: 1, filed: 3 })
    })

    it("does no work for a text whose reading is done and whose passages are all of the current versions", async () => {
        const t = await build(documentOf(2, 2))
        await t.service.run(PAYLOAD)
        t.ai.chat.mockClear()

        await expect(t.service.run(PAYLOAD)).resolves.toBe("skipped")
        expect(t.ai.chat).not.toHaveBeenCalled()
    })
})

describe("DocumentFactsService: what goes in force", () => {
    it("the founder's document: its truths go in force as soon as its reading ends, announced ONCE", async () => {
        const t = await build(documentOf(3, 1))

        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")

        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(3)
        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(
            WS,
            stringLike("f-"),
            CHI_LAN_VI,
            stringLike(`direct:${SOURCE}`),
            // Bounded by the ceiling inside the write (D-U-1), guarded against a rival written meanwhile.
            BOUND,
        )
        // One announcement for the document: one vector batch and one policy derive request, never one per truth.
        expect(t.facts.announceChanged).toHaveBeenCalledTimes(1)
        expect(t.facts.announceChanged.mock.calls[0]?.[1]).toHaveLength(3)
        expect(t.world.row).toMatchObject({
            status: "done",
            counts: { factsApplied: 3, factsAsked: 0, factsWaiting: 0 },
        })
        expect(t.sources.settle).toHaveBeenCalledWith(WS, SOURCE, t.source.content)
    })

    it.each([
        ["manager", "Minh Manager"],
        ["staff", "Sau Staff"],
    ])("D3: a %s's document goes in force directly, decided by that member; the critic is still asked", async (createdBy, name) => {
        const t = await build(documentOf(3, 1), docSourceOf({ status: "ready", visibility: "internal", createdBy }))

        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")

        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(3)
        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(WS, stringLike("f-"), name, stringLike(`put in by ${createdBy} ${name}`), BOUND)
        expect(t.world.row).toMatchObject({ status: "done", counts: { factsApplied: 3, factsWaiting: 0 } })
        // The critic is still asked: it decides what customers may be served.
        expect(t.reviews.requestForSource).toHaveBeenCalledTimes(1)
    })

    it("a document no member stands behind (a sync, a person who left) is nobody's word: its truths wait, the critic's word is never read", async () => {
        for (const createdBy of [null, "left-the-team"]) {
            const t = await build(documentOf(1, 0), docSourceOf({ status: "ready", createdBy }))

            await expect(t.service.run(PAYLOAD)).resolves.toBe("done")
            expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
            expect(t.critic.truthGateOf).not.toHaveBeenCalled()
            expect(t.world.row).toMatchObject({ status: "done", counts: { factsApplied: 0, factsWaiting: 1 } })
        }
    })

    it("a critique that never ran holds nothing; a later change of the critic's word settles the document again, and what is in force stays", async () => {
        const t = await build(documentOf(2, 0))
        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")
        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(2)

        // The critique ends later with a point: the document settles again; nothing waits any more, nothing more is written.
        await expect(t.critiqueThenSettle()).resolves.toBe("done")
        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(2)
        expect(t.world.row).toMatchObject({ status: "done", counts: { factsApplied: 2 } })
    })
})
