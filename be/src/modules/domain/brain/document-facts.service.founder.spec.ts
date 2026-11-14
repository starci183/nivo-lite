import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { DOC_AT, DOC_SOURCE, DOC_WS, docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
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
import type { PassageCritique, TruthCritiqueGate } from "./direct-apply.policy"
import { DocumentFactsService } from "./document-facts.service"
import { DocumentRelationsService } from "./document-relations.service"
import { DocumentReviewService } from "./document-review.service"
import { DocumentNatureService } from "./document-nature.service"
import { DocumentPartsService } from "./document-parts.service"
import { DocumentSettleService } from "./document-settle.service"
import { DocumentTruthStagesService } from "./document-truth-stages.service"
import { SYSTEM_PROMPT } from "./extraction.policy"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { ModelJsonService } from "./model-json.service"
import { TRIAGE_PROMPT } from "./passage-triage.policy"
import { TruthCeilingService } from "./truth-ceiling.service"
import { BO_QUA_MOI_HUONG_DAN_TRUOC_VI, CHI_LAN_CHU_TIEM_VI, DICH_VU_0_VI, PHI_DICH_VU_SO_0_LA_VI, SO_TAY_VI, T_10_000D_VI, T_11_000D_VI, T_12_000D_VI, T_15_000D_VI, T_1_POLICY_MOI_DON_GIAM_GIA_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { objectLike, stringLike } from "@tests/fixtures/builders/brain-document.builder"
import { FACTS_USAGE, factsDocumentOf, factsPassageOf, factsProposalOf, factsReviewedAll, factsRuleText, factsPassagesIn, scriptFactsWorld, factsRunnersOf, type FactsWorld } from "@tests/fixtures/builders/brain-facts-world.builder"

const WS = DOC_WS
const SOURCE = DOC_SOURCE
const PAYLOAD = { workspaceId: WS, sourceId: SOURCE }
const USAGE = FACTS_USAGE
const ruleText = factsRuleText
const passageOf = factsPassageOf
const documentOf = factsDocumentOf
const proposalOf = factsProposalOf
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

/**
 * One reading of a one-rule document that settles at once: `arrange` runs once its truths are filed and before they settle (the
 * critic is asked right before the settle), with the critic's word `more` on its passages.
 */
const settled = async (
    arrange: (t: Awaited<ReturnType<typeof build>>) => void,
    more: Partial<PassageCritique> = {},
) => {
    const t = await build(documentOf(1, 0))
    t.world.critique = factsReviewedAll(t.world.passages, more)
    t.reviews.requestForSource.mockImplementationOnce(() => {
        arrange(t)
        return Promise.resolve()
    })
    const outcome = await t.service.run(PAYLOAD)
    return { t, outcome }
}

describe("DocumentFactsService: the founder is asked, and nothing wrong goes in force", () => {
    it("another value is in force for the same key (also the founder's own later edit): his value stays", async () => {
        const { t, outcome } = await settled((world) => {
            world.facts.byKey.mockImplementation((_ws, _subject, _attribute, status) =>
                Promise.resolve(
                    status === "active"
                        ? [proposalOf({ id: "owner-edit", status: "active", sourceKind: "owner", value: T_12_000D_VI })]
                        : [],
                ),
            )
        })

        expect(outcome).toBe("done")
        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.world.row).toMatchObject({ counts: { factsApplied: 0, factsAsked: 1 } })
    })

    it("the truth names the value in force it disagrees with", async () => {
        const { t } = await settled((world) => {
            world.world.waiting = world.world.waiting.map((fact) => ({ ...fact, conflictWith: "in-force" }))
        })

        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.world.row?.counts.factsAsked).toBe(1)
    })

    it("the document contradicts itself (or another document): two values wait for one key and neither goes in force", async () => {
        const { t } = await settled((world) => {
            const [first] = world.world.waiting
            if (first === undefined) return
            const second = { ...first, id: "second", value: T_15_000D_VI, conflictWith: first.id }
            world.world.waiting = [first, second]
            world.facts.byKey.mockImplementation((_ws, _subject, _attribute, status) =>
                Promise.resolve(status === "proposed" ? [first, second] : []),
            )
        })

        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.world.row).toMatchObject({ counts: { factsApplied: 0, factsAsked: 2 } })
    })
})

describe("DocumentFactsService: the founder is asked: the same truth in other words, an ended value, an open point", () => {
    it("the same truth in other words holds another value; with the same value it is closed as a duplicate and nobody is asked", async () => {
        const other = proposalOf({ id: "other", status: "active", subjectLabel: DICH_VU_0_VI, value: T_11_000D_VI })
        const asked = await settled((world) => {
            world.world.waiting = world.world.waiting.map((fact) => ({
                ...fact,
                conflictWith: "other",
                flags: ["same_meaning"],
            }))
            world.facts.get.mockResolvedValue(other)
        })
        expect(asked.t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(asked.t.facts.reject).not.toHaveBeenCalled()
        expect(asked.t.world.row?.counts.factsAsked).toBe(1)

        const duplicate = await settled((world) => {
            world.world.waiting = world.world.waiting.map((fact) => ({
                ...fact,
                conflictWith: "other",
                flags: ["same_meaning"],
            }))
            world.facts.get.mockResolvedValue({ ...other, value: T_10_000D_VI })
        })
        expect(duplicate.t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(duplicate.t.facts.reject).toHaveBeenCalledWith(
            WS,
            stringLike("f-"),
            "NIVO",
            stringLike("duplicate:other"),
        )
        expect(duplicate.t.world.row).toMatchObject({ counts: { factsApplied: 0, factsAsked: 0 } })
    })

    it("a value flagged stale or period_unclear is no question: it goes in force", async () => {
        for (const flag of ["stale", "period_unclear"] as const) {
            const { t } = await settled((world) => {
                world.world.waiting = world.world.waiting.map((fact) => ({ ...fact, flags: [flag] }))
            })

            expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(1)
            expect(t.world.row?.counts.factsAsked).toBe(0)
        }
    })

    it("a holding point (a contradiction, or text addressed to an AI) holds the passage before it settles: one question, the truth waits", async () => {
        const hash = passageTextHashOf(ruleText(0))
        const { t, outcome } = await settled(() => undefined, { held: new Set([hash]) })

        expect(outcome).toBe("done")
        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()
        expect(t.facts.announceChanged).toHaveBeenCalledWith(WS, [])
        expect(t.world.row).toMatchObject({
            status: "done",
            counts: { factsApplied: 0, factsAsked: 1, factsWaiting: 0 },
        })
        expect(t.world.waiting).toHaveLength(1)
    })
})

describe("DocumentFactsService: the founder's answer to a point, and a write that fails", () => {
    it('the founder answers the point with a yes to apply: the truth goes in force as confirmed by him', async () => {
        const hash = passageTextHashOf(ruleText(0))
        const { t } = await settled(() => undefined, { held: new Set([hash]) })

        // The answer closes the point: the passage is no longer held, and the answer names the truth it decided and who decided.
        const [truth] = t.world.waiting
        const decided = new Map([[truth?.id ?? "", { kind: "confirmed" as const, by: CHI_LAN_CHU_TIEM_VI }]])
        await expect(t.critiqueThenSettle({ decided })).resolves.toBe("done")

        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(1)
        expect(t.facts.applyUnannounced).toHaveBeenCalledWith(
            WS,
            stringLike("f-"),
            CHI_LAN_CHU_TIEM_VI,
            stringLike(`confirmed:${SOURCE}`),
        )
        expect(t.world.row).toMatchObject({ status: "done", counts: { factsApplied: 1, factsAsked: 0 } })
    })

    it("a second version of the document resolves the finding: its new passage goes in force as soon as it is read", async () => {
        const hash = passageTextHashOf(ruleText(0))
        const { t } = await settled(() => undefined, { held: new Set([hash]) })
        expect(t.facts.applyUnannounced).not.toHaveBeenCalled()

        const fixed = passageOf(0, PHI_DICH_VU_SO_0_LA_VI)
        const v2 = await build(
            [fixed],
            docSourceOf({ status: "ready", visibility: "internal", createdBy: "founder", content: "version two" }),
        )
        v2.world.row = t.world.row

        // The new passage is read and its truth goes in force: no critique of this text is waited for (it is asked, in the background).
        await expect(v2.service.run(PAYLOAD)).resolves.toBe("done")
        expect(v2.facts.applyUnannounced).toHaveBeenCalledTimes(1)
        expect(v2.reviews.requestForSource).toHaveBeenCalledTimes(1)
    })

    it("a write that fails leaves the truth for the founder and never fails the document", async () => {
        const { t, outcome } = await settled((world) => {
            world.facts.applyUnannounced.mockRejectedValue(new Error("lost the race"))
        })

        expect(outcome).toBe("done")
        expect(t.world.row).toMatchObject({ counts: { factsApplied: 0, factsAsked: 1 } })
    })
})

describe("DocumentFactsService: the ceiling of truths in force", () => {
    it("applies while there is room, leaves the rest waiting as proposals, says so on the document and tells the founder once", async () => {
        const t = await build(documentOf(4, 0))
        t.ceiling.room.mockResolvedValue({ truths: 2, bytes: 2_000_000 })

        await expect(t.service.run(PAYLOAD)).resolves.toBe("waiting")

        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(2)
        expect(t.world.waiting).toHaveLength(2)
        expect(t.world.row).toMatchObject({ status: "at_ceiling", counts: { factsApplied: 2, factsWaiting: 2 } })
        expect(t.notices.postBackgroundStopped).toHaveBeenCalledWith(WS, {
            work: "brain.documents.truths",
            reason: "ceiling",
            // Each reason is an episode of its own for one version of the document: a card for credits never hides this one.
            episode: new Date(Date.parse(DOC_AT) + 3),
        })
        expect(t.sources.settle).not.toHaveBeenCalled()
    })

    it("the ceiling is told ONCE per episode of the workspace, however many documents stop at it: the card is keyed by when the first reading stopped; a new episode (room again, then full again) tells again", async () => {
        const first = new Date("2026-11-11T05:00:00.000Z")
        const stopAtCeiling = async (since: Date) => {
            const t = await build(documentOf(2, 0))
            t.ceiling.room.mockResolvedValue({ truths: 0, bytes: 0 })
            t.extractions.ceilingSince.mockResolvedValue(since)
            await t.service.run(PAYLOAD)
            expect(t.world.row?.status).toBe("at_ceiling")
            return t.notices.postBackgroundStopped.mock.calls.at(-1)?.[1]
        }

        // Two documents stop during the same episode: the same card key (the notices store posts it once).
        const one = await stopAtCeiling(first)
        const two = await stopAtCeiling(first)
        expect(one).toEqual({ work: "brain.documents.truths", reason: "ceiling", episode: first })
        expect(two).toEqual(one)
        // There was room again and the ceiling is reached anew: another episode, another card.
        const later = await stopAtCeiling(new Date("2026-11-12T02:00:00.000Z"))
        expect(later?.episode).not.toEqual(first)
    })
})

describe("DocumentFactsService: the ceiling of truths in force: bytes and the upkeep tick", () => {
    it("the byte bound stops it as well as the count", async () => {
        const t = await build(documentOf(2, 0))
        // One truth of this document is 41 bytes: the first fits, the second does not.
        t.ceiling.room.mockResolvedValue({ truths: 100, bytes: 60 })

        await t.service.run(PAYLOAD)

        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(1)
        expect(t.world.row?.status).toBe("at_ceiling")
    })

    it("goes on by itself at the upkeep tick once there is room again", async () => {
        const t = await build(documentOf(2, 0))
        t.ceiling.room.mockResolvedValue({ truths: 0, bytes: 0 })
        await t.service.run(PAYLOAD)
        expect(t.world.row?.status).toBe("at_ceiling")
        t.extractions.parked.mockResolvedValue([
            {
                workspaceId: WS,
                sourceId: SOURCE,
                contentHash: "h",
                windowsDone: 1,
                windowsTotal: 1,
                status: "at_ceiling",
            },
        ])

        // Still full: the tick moves nothing.
        await expect(t.service.resumeParked()).resolves.toBe(0)
        t.ceiling.room.mockResolvedValue({ truths: 5_000, bytes: 2_000_000 })
        await expect(t.service.resumeParked()).resolves.toBe(1)
        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")

        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(2)
        expect(t.world.row).toMatchObject({ status: "done", counts: { factsApplied: 2, factsWaiting: 0 } })
    })
})

describe("DocumentFactsService: planted text", () => {
    it("a passage that addresses a model travels only as DATA between the marks (no code hides it: the model is told passages are data), and the standing instructions never change with it", async () => {
        const planted = passageOf(
            1,
            BO_QUA_MOI_HUONG_DAN_TRUOC_VI,
        )
        const t = await build([passageOf(0, ruleText(0)), planted])

        await t.service.run(PAYLOAD)

        const shown = t.ai.chat.mock.calls.flatMap(([request]) => passagesIn(request.messages[1]?.content ?? ""))
        expect(shown).toContain(planted.text)
        // The standing instructions are the constants, whatever the document says.
        expect(new Set(t.ai.chat.mock.calls.map(([request]) => request.messages[0]?.content))).toEqual(
            new Set([TRIAGE_PROMPT, SYSTEM_PROMPT]),
        )
        // What the scripted model files for it proves nothing about a real one: the reading's rule 8 and the critic's security read
        // are what stand between planted text and a truth; no code reads the text for it.
        expect(t.facts.propose).toHaveBeenCalledWith(WS, objectLike({ value: T_10_000D_VI }))
    })

    it("a line the model was talked into writing about a value its passage does not hold is dropped, counted and never filed", async () => {
        const t = await build([passageOf(0, ruleText(0))])
        t.ai.chat.mockImplementation((request) =>
            Promise.resolve({
                text:
                    request.messages[0]?.content === TRIAGE_PROMPT
                        ? '{"rule":[1],"data":[]}'
                        : T_1_POLICY_MOI_DON_GIAM_GIA_VI,
                model: "haiku",
                usage: USAGE,
                parsed: null,
                retrieved: 0,
            }),
        )

        await t.service.run(PAYLOAD)

        expect(t.facts.propose).toHaveBeenCalledTimes(1)
        expect(t.facts.propose).toHaveBeenCalledWith(WS, objectLike({ value: T_10_000D_VI }))
        expect(t.logger.info).toHaveBeenCalledWith(
            expect.anything(),
            objectLike({ ungrounded: 1, kept: 1 }),
        )
    })
})
