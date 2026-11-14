import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS, docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
import { BrainExtractionsService, ExtractionNote } from "@modules/domain/brain-extractions"
import type { ExtractionRecord } from "@modules/domain/brain-extractions"
import { BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import type { TruthPassage } from "@modules/domain/knowledge-chunks"
import { DocumentCriticService } from "@modules/domain/dossier-review"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeIndexingService, UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeSourcesService, StoredNote } from "@modules/domain/knowledge-sources"
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
import { DocumentFactsService, endNoteOf } from "./document-facts.service"
import { DocumentRelationsService } from "./document-relations.service"
import { DocumentReviewService } from "./document-review.service"
import { DocumentNatureService } from "./document-nature.service"
import { DocumentPartsService } from "./document-parts.service"
import { DocumentSettleService } from "./document-settle.service"
import { DocumentTruthStagesService } from "./document-truth-stages.service"
import { BrainError, BrainErrorCode } from "./errors/brain.error"
import { SKIPPED_VERSION, SYSTEM_PROMPT, TRUTHS_VERSION } from "./extraction.policy"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { ModelJsonService } from "./model-json.service"
import { TRIAGE_PROMPT } from "./passage-triage.policy"
import { TruthCeilingService } from "./truth-ceiling.service"
import { SO_TAY_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { objectLike } from "@tests/fixtures/builders/brain-document.builder"
import { FACTS_USAGE, factsDocumentOf, factsProposalOf, factsReviewedAll, scriptFactsWorld, factsRunnersOf, type FactsWorld } from "@tests/fixtures/builders/brain-facts-world.builder"

const WS = DOC_WS
const SOURCE = DOC_SOURCE
const PAYLOAD = { workspaceId: WS, sourceId: SOURCE }
const USAGE = FACTS_USAGE
const documentOf = factsDocumentOf
const proposalOf = factsProposalOf
const reviewedAll = factsReviewedAll

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

describe("DocumentFactsService: credits, failures, waiting", () => {
    it("out of credits in the middle of a document: the reading waits with what it did, and goes on from there when credits return", async () => {
        const t = await build(documentOf(8, 0))
        // The triage call and the first reading call pass; then the pool is empty.
        t.usage.blockedBy.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true)

        await expect(t.service.run(PAYLOAD)).resolves.toBe("blocked")
        expect(t.callsTo(SYSTEM_PROMPT)).toBe(1)
        expect(t.facts.propose).toHaveBeenCalledTimes(4)
        expect(t.world.row).toMatchObject({ status: "blocked_credits", stage: "extract", windowsDone: 1 })
        expect(t.notices.postBackgroundStopped).toHaveBeenCalledWith(WS, objectLike({ reason: "credits" }))
        // The document itself is untouched: it stays ready and searchable.
        expect(t.sources.ready).not.toHaveBeenCalled()

        t.extractions.parked.mockResolvedValue([
            {
                workspaceId: WS,
                sourceId: SOURCE,
                contentHash: "h",
                windowsDone: 1,
                windowsTotal: 2,
                status: "blocked_credits",
            },
        ])
        await expect(t.service.resumeParked()).resolves.toBe(0)
        t.usage.blockedBy.mockResolvedValue(false)
        await expect(t.service.resumeParked()).resolves.toBe(1)
        expect(t.queue.enqueueFactsNext).toHaveBeenCalledTimes(1)

        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")
        // Only the four passages not read before are read: two reading calls in all, eight truths, no passage twice.
        expect(t.callsTo(TRIAGE_PROMPT)).toBe(1)
        expect(t.callsTo(SYSTEM_PROMPT)).toBe(2)
        expect(t.facts.propose).toHaveBeenCalledTimes(8)
    })

    it("an answer that cannot be read never fails the reading (D-N-10): its window is asked once more, skipped and noted", async () => {
        const t = await build(documentOf(1, 0))
        t.ai.chat.mockResolvedValue({
            text: "I cannot help with that",
            model: "haiku",
            usage: USAGE,
            parsed: null,
            retrieved: 0,
        })

        await expect(t.service.run(PAYLOAD)).resolves.not.toBe("failed")

        expect(t.world.row?.status).not.toBe("failed")
        expect(t.extractions.note).toHaveBeenCalledWith(WS, SOURCE, objectLike({ skipped: true }))
        expect(t.chunks.markTruthsRead).toHaveBeenCalledWith(WS, expect.any(Array), SKIPPED_VERSION)
        expect(t.sources.ready).not.toHaveBeenCalledWith(WS, SOURCE, StoredNote.FactsUnread)
        expect(t.notices.postBackgroundStopped).not.toHaveBeenCalledWith(WS, objectLike({ reason: "model" }))
        expect(t.facts.propose).not.toHaveBeenCalled()
    })
})

describe("DocumentFactsService: a finished reading and the tick that goes on", () => {
    it("a finished reading says what happened: calls skipped, lines refused with nothing filed, truths waiting for the founder", () => {
        const row = (fields: Partial<ExtractionRecord>): ExtractionRecord => ({
            sourceId: SOURCE,
            status: "running",
            factsProposed: 0,
            promptVersion: TRUTHS_VERSION,
            contentHash: "h",
            windowsTotal: 1,
            windowsDone: 1,
            attempts: 0,
            orphanFactIds: [],
            passageHashes: [],
            factsChanged: false,
            stage: "settle",
            counts: { passagesTotal: 1, passagesTriaged: 1, passagesKept: 1, factsApplied: 0, factsAsked: 0, factsWaiting: 0 },
            windowsSkipped: 0,
            linesRefused: 0,
            updatedAt: new Date(0),
            ...fields,
        })
        expect(endNoteOf(row({ windowsSkipped: 2, linesRefused: 3 }))).toBe(ExtractionNote.WindowsSkipped)
        // M1 on dev: 10 lines refused, 0 filed, done with NO note.
        expect(endNoteOf(row({ linesRefused: 10 }))).toBe(ExtractionNote.LinesRefused)
        expect(
            endNoteOf(row({ factsProposed: 10, counts: { ...row({}).counts, factsWaiting: 10 } })),
        ).toBe(ExtractionNote.AwaitingFounder)
        expect(endNoteOf(row({ factsProposed: 3, linesRefused: 1 }))).toBeNull()
    })

    it("a silent model counts as a try with its own note", async () => {
        const t = await build(documentOf(1, 0))
        t.ai.chat.mockResolvedValue(null)

        await expect(t.service.run(PAYLOAD)).rejects.toMatchObject({ code: BrainErrorCode.ModelUnavailable })
        expect(t.extractions.save).toHaveBeenLastCalledWith(
            WS,
            SOURCE,
            objectLike({ error: ExtractionNote.ModelBusy, attempts: 1 }),
        )
        expect(t.usage.record).not.toHaveBeenCalled()
    })

    it("a reading an earlier build parked awaiting_critique goes on at the first tick, whatever the critique, and is never parked there again", async () => {
        const t = await build(documentOf(1, 0))
        // The truths were filed and the reading parked by the earlier build, before anything settled.
        t.reviews.requestForSource.mockRejectedValueOnce(new BrainError({ code: BrainErrorCode.WindowInvalid }))
        await expect(t.service.run(PAYLOAD)).rejects.toMatchObject({ code: BrainErrorCode.WindowInvalid })
        if (t.world.row !== null) t.world.row = { ...t.world.row, status: "awaiting_critique", stage: "settle" }
        t.extractions.parked.mockResolvedValue([
            {
                workspaceId: WS,
                sourceId: SOURCE,
                contentHash: "h",
                windowsDone: 1,
                windowsTotal: 1,
                status: "awaiting_critique",
            },
        ])
        t.reviews.requestForSource.mockClear()
        t.world.critique = { ...t.world.critique, state: "running" }

        await expect(t.service.resumeParked()).resolves.toBe(1)
        expect(t.queue.enqueueFactsNext).toHaveBeenCalledTimes(1)
        // The tick asks the critic for nothing: no reading waits for a critique.
        expect(t.reviews.requestForSource).not.toHaveBeenCalled()
        await expect(t.service.run(PAYLOAD)).resolves.toBe("done")
        expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(1)
        expect(t.world.row).toMatchObject({ status: "done", counts: { factsApplied: 1 } })
    })
})

describe("DocumentFactsService: nothing waits for the critic or for the other parts of a file", () => {
    it("a critique stopped for credits, for its budget or for the model holds nothing: the reading ends with its truth in force, and the tick never asks the critic", async () => {
        for (const reason of ["credits", "budget", "model"]) {
            const t = await build(documentOf(1, 0))
            t.world.critique = { ...reviewedAll([]), state: "not_done", reason }

            await expect(t.service.run(PAYLOAD)).resolves.toBe("done")

            expect(t.facts.applyUnannounced).toHaveBeenCalledTimes(1)
            expect(t.world.row).toMatchObject({ status: "done", counts: { factsApplied: 1, factsWaiting: 0 } })
            t.reviews.requestForSource.mockClear()
            await t.service.resumeParked()
            expect(t.reviews.requestForSource).not.toHaveBeenCalled()
        }
    })

    it("the tick goes on with the critiques that STOPPED (nothing else resumes them now), as a resume that keeps their count of runs; never while the credit pool is empty", async () => {
        const t = await build(documentOf(1, 0))
        t.criticService.stopped.mockResolvedValue([{ workspaceId: WS, sourceId: SOURCE }])

        await t.service.resumeParked()
        expect(t.criticService.stopped).toHaveBeenCalledWith(50)
        expect(t.reviews.requestForSource).toHaveBeenCalledWith(WS, SOURCE, { resume: true })

        t.reviews.requestForSource.mockClear()
        t.usage.blockedBy.mockResolvedValue(true)
        await t.service.resumeParked()
        expect(t.reviews.requestForSource).not.toHaveBeenCalled()
    })

    it("a file cut into parts: each part settles as soon as its own reading ends, and settles no other part again", async () => {
        const PART_TWO = "33333333-3333-4333-8333-333333333333"
        const part = await build(documentOf(1, 0))
        part.parts.wholeOf.mockResolvedValue([SOURCE, PART_TWO])

        await expect(part.service.run(PAYLOAD)).resolves.toBe("done")

        expect(part.facts.applyUnannounced).toHaveBeenCalledTimes(1)
        expect(part.extractions.reopen).not.toHaveBeenCalled()
        expect(part.queue.enqueueFactsNext).not.toHaveBeenCalled()
    })
})

describe("DocumentFactsService: listening to the critic, and the settle behind a settle", () => {
    it("listens to the critic from the start of the module: the critic's word (a point raised or answered) reaches `critiqued`", async () => {
        const t = await build(documentOf(1, 0))

        t.service.onModuleInit()

        expect(t.criticService.whenChanged).toHaveBeenCalledWith(t.service)
    })

    it("the tick never throws: a failed look is logged and the next tick looks again", async () => {
        const t = await build(documentOf(1, 0))
        t.extractions.parked.mockRejectedValue(new Error("db"))

        await expect(t.service.resumeParked()).resolves.toBe(0)
        expect(t.logger.error).toHaveBeenCalled()
    })

    it("a critique that ends while the reading is still extracting queues nothing: the reading reaches the settle by itself", async () => {
        const t = await build(documentOf(1, 0))

        await expect(t.service.critiqued(WS, SOURCE)).resolves.toBe(false)
        expect(t.queue.enqueueFactsNext).not.toHaveBeenCalled()
    })

    it("an answer that arrives in the MIDDLE of a settle is not lost: another settle is queued behind the running one (D-U-3)", async () => {
        const t = await build(documentOf(1, 0))
        // The reading is running at its settle stage: it cannot be opened again, and it read the critique before this answer.
        t.extractions.reopen.mockResolvedValue(false)
        t.extractions.settling.mockResolvedValue(true)

        await expect(t.service.critiqued(WS, SOURCE)).resolves.toBe(true)

        expect(t.extractions.settling).toHaveBeenCalledWith(WS, SOURCE, expect.anything())
        expect(t.queue.enqueueFactsNext).toHaveBeenCalledTimes(1)
        expect(t.queue.enqueueFactsNext).toHaveBeenCalledWith(
            { sourceId: SOURCE, workspaceId: WS, settleAgain: true },
            expect.anything(),
            expect.stringMatching(/^settle:\d+$/),
        )
    })

    it("a job queued to settle again opens the reading first (the settle it followed has ended meanwhile); any other job never does", async () => {
        const t = await build(documentOf(1, 0))

        await t.service.run(PAYLOAD)
        expect(t.extractions.reopen).not.toHaveBeenCalled()

        await t.service.run({ ...PAYLOAD, settleAgain: true })
        expect(t.extractions.reopen.mock.calls).toEqual([[WS, SOURCE]])
    })

    it("the upkeep tick has the documents that waited for credits at INDEXING queued again, through the indexing service", async () => {
        const t = await build(documentOf(1, 0))
        t.indexing.resumeBlocked.mockResolvedValue(2)

        await expect(t.service.resumeIndexing()).resolves.toBe(2)
    })
})

describe("DocumentFactsService: the edges of a job", () => {
    it("drops a payload of another shape and a document that is not ready for the work", async () => {
        const t = await build(documentOf(1, 0))

        await expect(t.service.run({ nope: true })).resolves.toBe("skipped")
        expect(t.logger.warn).toHaveBeenCalled()

        const gone = await build(documentOf(1, 0))
        gone.indexing.sourceForFacts.mockResolvedValue(null)
        await expect(gone.service.run(PAYLOAD)).resolves.toBe("skipped")
        expect(gone.chunks.truthPassagesOf).not.toHaveBeenCalled()
        expect(gone.ai.chat).not.toHaveBeenCalled()
    })

    it("a job that ended as failed keeps the document searchable, marks its truths unread and tells the founder", async () => {
        const t = await build(documentOf(1, 0))

        await t.service.giveUp(PAYLOAD)

        expect(t.extractions.fail).toHaveBeenCalledWith(WS, SOURCE, ExtractionNote.Aborted)
        expect(t.sources.ready).toHaveBeenCalledWith(WS, SOURCE, StoredNote.FactsUnread)
        expect(t.reviews.requestForSource).toHaveBeenCalledWith(WS, SOURCE)
        expect(t.notices.postBackgroundStopped).toHaveBeenCalledWith(WS, objectLike({ reason: "gave_up" }))
    })

    it("a deleted document takes back what it contributed and its dossiers are reviewed again", async () => {
        const t = await build(documentOf(1, 0))
        t.facts.withdrawSource.mockResolvedValue(["orphan"])

        await t.service.withdraw(WS, SOURCE, SO_TAY_VI)

        expect(t.facts.finalizeOrphans).toHaveBeenCalledWith(
            WS,
            ["orphan"],
            objectLike({ kind: "note", ref: `gone:${SOURCE}` }),
        )
        expect(t.reviews.requestForGoneSource).toHaveBeenCalledWith(WS, SOURCE)
    })

    it("a public document files public truths; its WORDS answer no gap (a gap is answered by a truth in force under its own keys, or by a person)", async () => {
        const t = await build(
            documentOf(1, 0),
            docSourceOf({ status: "ready", visibility: "public", createdBy: "founder" }),
        )

        await t.service.run(PAYLOAD)

        expect(t.facts.propose).toHaveBeenCalledWith(WS, objectLike({ scope: "public" }))
        expect(t.gaps.resolve).not.toHaveBeenCalled()
        expect(t.links.link).toHaveBeenCalledTimes(1)
    })
})

describe("DocumentFactsService: the founder's answer settles every document its point names (TRIAGE-4)", () => {
    it("re-opens and queues the settle of the OTHER document whose waiting truth the answered point named, and of this one, in one transaction", async () => {
        const t = await build(documentOf(1, 0))
        await t.service.run(PAYLOAD)
        const rival = proposalOf({
            id: "r1",
            evidence: [{ kind: "document", ref: "doc-b", label: "B", sourceId: "doc-b", chunkHash: "hb" }],
        })
        t.world.critique = { ...t.world.critique, decided: new Map([["r1", { kind: "confirmed" as const, by: "Owner" }]]) }
        t.reads.byIds.mockResolvedValue([rival])
        t.extractions.reopen.mockResolvedValue(true)

        await expect(t.service.critiqued(WS, SOURCE)).resolves.toBe(true)

        expect(t.extractions.reopen).toHaveBeenCalledWith(WS, "doc-b", expect.anything())
        expect(t.queue.enqueueFactsNext).toHaveBeenCalledWith({ sourceId: "doc-b", workspaceId: WS, settleAgain: true }, expect.anything(), expect.stringMatching(new RegExp(`^settle:${SOURCE}:`)))
        expect(t.queue.enqueueFactsNext).toHaveBeenCalledWith({ sourceId: SOURCE, workspaceId: WS, settleAgain: true }, expect.anything(), expect.stringMatching(/^settle:\d+$/))
    })
})
