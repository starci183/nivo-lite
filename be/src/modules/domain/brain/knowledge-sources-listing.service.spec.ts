import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import type { DocumentAiCost } from "@modules/domain/ai-usage-events"
import type { DocumentTruthsView } from "@modules/domain/brain-extractions"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceSummary } from "@modules/domain/knowledge-sources"
import { DocumentPartsService } from "./document-parts.service"
import { KnowledgeSourcesListingService } from "./knowledge-sources-listing.service"

const ZERO = { calls: 0, failedTries: 0, tokens: 0, costUsd: 0, credits: 0, failedCostUsd: 0, failedCredits: 0 }
const COST: DocumentAiCost = {
    read: { ...ZERO, calls: 3, costUsd: 0.00113, credits: 1 },
    critique: { ...ZERO, calls: 1, costUsd: 0.0113, credits: 10 },
    reread: ZERO,
    total: { ...ZERO, calls: 4, costUsd: 0.01243, credits: 11 },
    models: ["claude-sonnet-5-5"],
}

const TRUTHS: DocumentTruthsView = {
    state: "awaiting_critique",
    stage: "settle",
    note: "BRAIN_NOTE_AWAITING_CRITIQUE",
    passagesTotal: 40,
    passagesTriaged: 40,
    passagesKept: 6,
    callsDone: 2,
    callsTotal: 2,
    truthsFound: 7,
    truthsInForce: 0,
    truthsAsked: 0,
    truthsWaiting: 0,
    callsSkipped: 0,
    linesRefused: 0,
}

const sourceOf = builder<SourceSummary>({
    id: "s1",
    workspaceId: "ws-1",
    module: null,
    installationId: null,
    kind: "file",
    topic: null,
    tags: [],
    visibility: "internal",
    title: "A document",
    status: "ready",
    error: null,
    chunkCount: 0,
    sizeBytes: 0,
    origin: null,
    progress: 100,
    stage: null,
    stageDone: null,
    stageTotal: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    partCount: 1,
})

const build = async (costs: ReadonlyMap<string, DocumentAiCost> | null) => {
    const sources = mock<KnowledgeSourcesService>()
    sources.list.mockResolvedValue([sourceOf({ id: "s1", partCount: 3 }), sourceOf({ id: "s2", partCount: 1 })])
    const usage = mock<AiUsageOverviewService>()
    usage.documentCosts.mockResolvedValue(costs)
    const extractions = mock<DocumentPartsService>()
    extractions.truthsOf.mockResolvedValue(new Map([["s1", TRUTHS]]))
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSourcesListingService,
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: AiUsageOverviewService, useValue: usage },
            { provide: DocumentPartsService, useValue: extractions },
        ],
    }).compile()
    return { handler: moduleRef.get(KnowledgeSourcesListingService), usage, extractions }
}

describe("KnowledgeSourcesListingService", () => {
    it("gives an owner or manager each document's AI cost (read, critique, re-read), read for the listed documents at once", async () => {
        const { handler, usage } = await build(new Map([["s1", COST]]))

        const listed = await handler.list("user-1", { workspaceId: "ws-1" })

        expect(listed.map((source) => [source.id, source.aiCost?.total.credits ?? null])).toEqual([
            ["s1", 11],
            ["s2", null],
        ])
        expect(usage.documentCosts).toHaveBeenCalledWith("user-1", "ws-1", ["s1", "s2"])
    })

    it("gives staff the list with no cost (the role guard answers null)", async () => {
        const { handler } = await build(null)

        const listed = await handler.list("user-1", { workspaceId: "ws-1" })

        expect(listed.map((source) => source.aiCost)).toEqual([null, null])
    })

    it("carries where the truths of each document stand, read for the whole list in ONE query, and null where no truths work started", async () => {
        const { handler, extractions } = await build(null)

        const listed = await handler.list("user-1", { workspaceId: "ws-1" })

        expect(listed.map((source) => [source.id, source.truths?.state ?? null])).toEqual([
            ["s1", "awaiting_critique"],
            ["s2", null],
        ])
        expect(extractions.truthsOf).toHaveBeenCalledTimes(1)
        // The read is told how many parts each document has, so a long file's parts are rolled up into its one row.
        expect(extractions.truthsOf).toHaveBeenCalledWith("ws-1", [
            { id: "s1", partCount: 3 },
            { id: "s2", partCount: 1 },
        ])
    })
})
