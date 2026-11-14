import { summary } from "@tests/fixtures/builders/knowledge-sources.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeIds, mock } from "@starci/jest-preset"
import { BrainFactBatchService, BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceDetail } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainBulkService } from "./brain-bulk.service"
import { BrainLogEvent } from "./brain.log-events"
import { BrainErrorCode } from "./errors/brain.error"

const WS = "ws-1"
const AT = "2026-10-12T10:00:00.000Z"
const BATCH = "00000000-0000-4000-8000-000000000001"

const factOf = builder<FactRecord>({
    id: "f1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8 to 21",
    valueNumber: null,
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
    evidence: [{ kind: "document", ref: "s1", label: "Rules", quote: "Open from 8 to 21", sourceId: "s1" }],
    proposedBy: "Rules",
    proposedAt: AT,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})
const memberOf = builder<WorkspaceMember>({
    userId: "u1",
    workspaceId: WS,
    role: "owner",
    staffId: null,
    displayName: "Ada",
    status: "active",
})
const sourceOf = builder<SourceDetail>({
    ...summary,
    id: "s1",
    workspaceId: WS,
    title: "Rules",
    visibility: "internal",
    content: "",
})

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const sources = mock<KnowledgeSourcesService>()
    const facts = mock<BrainFactsService>()
    const reads = mock<BrainFactsReadService>()
    const batches = mock<BrainFactBatchService>()
    const logger = mock<Logger>()
    members.require.mockResolvedValue(memberOf())
    sources.detail.mockResolvedValue(sourceOf())
    facts.byKey.mockResolvedValueOnce([factOf()]).mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainBulkService,
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: IDS, useValue: fakeIds() },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: BrainFactsService, useValue: facts },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainFactBatchService, useValue: batches },
        ],
    }).compile()
    return { service: moduleRef.get(BrainBulkService), members, sources, facts, reads, batches, logger }
}

describe("BrainBulkService applyDocument", () => {
    it("applies the safe facts of an internal document as one batch, each noting the batch, and leaves the rest for a person", async () => {
        const { service, facts, reads, members } = await build()
        const safe = factOf()
        const unsafe = factOf({ id: "f2", conflictWith: "f0" })
        const publicFact = factOf({ id: "f3", scope: "public" })
        reads.ofSources.mockResolvedValue([safe, unsafe, publicFact])

        await expect(service.applyDocument("u1", WS, "s1")).resolves.toEqual({ batchId: BATCH, applied: 1, skipped: 2 })

        // Applying a batch puts truths in force: the founder's alone.
        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner"])
        expect(reads.ofSources).toHaveBeenCalledWith(WS, ["s1"], ["proposed"], 2000)
        expect(facts.applyUnannounced).toHaveBeenCalledTimes(1)
        expect(facts.applyUnannounced).toHaveBeenCalledWith(
            WS,
            "f1",
            "Ada",
            expect.stringContaining(`bulk:${BATCH} - Applied together with the other checked facts of "Rules"`),
        )
        // The store is told ONCE, with the facts applied: one vector batch and one policy request, never one per fact.
        expect(facts.announceChanged.mock.calls).toEqual([[WS, ["f1"]]])
    })

    it("refuses a document kept public: a bulk path never makes anything public", async () => {
        const { service, sources, facts, reads } = await build()
        sources.detail.mockResolvedValue(sourceOf({ visibility: "public" }))

        await expect(service.applyDocument("u1", WS, "s1")).rejects.toMatchObject({
            code: BrainErrorCode.BulkNeedsInternal,
        })

        expect(reads.ofSources).not.toHaveBeenCalled()
        expect(facts.applyUnannounced).not.toHaveBeenCalled()
        expect(facts.announceChanged).not.toHaveBeenCalled()
    })

    it("leaves a fact for a person when another value waits for its key or one is in force by now", async () => {
        const { service, facts, reads } = await build()
        reads.ofSources.mockResolvedValue([factOf(), factOf({ id: "f2", subjectKey: "menu" })])
        facts.byKey.mockReset()
        facts.byKey
            .mockResolvedValueOnce([factOf(), factOf({ id: "rival", value: "9 to 20" })])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([factOf({ id: "f2" })])
            .mockResolvedValueOnce([factOf({ id: "held", status: "active" })])

        await expect(service.applyDocument("u1", WS, "s1")).resolves.toEqual({ batchId: BATCH, applied: 0, skipped: 2 })

        expect(facts.applyUnannounced).not.toHaveBeenCalled()
    })

    it("goes on with the other facts when one write fails, and says which was left", async () => {
        const { service, facts, reads, logger } = await build()
        reads.ofSources.mockResolvedValue([factOf(), factOf({ id: "f2", subjectKey: "menu" })])
        facts.byKey.mockReset()
        facts.byKey
            .mockResolvedValueOnce([factOf()])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([factOf({ id: "f2" })])
            .mockResolvedValueOnce([])
        const decided = new Error("decided meanwhile")
        facts.applyUnannounced.mockRejectedValueOnce(decided)

        await expect(service.applyDocument("u1", WS, "s1")).resolves.toEqual({ batchId: BATCH, applied: 1, skipped: 1 })

        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.BulkFactSkipped, decided, { factId: "f1" })
        expect(facts.applyUnannounced).toHaveBeenCalledTimes(2)
        expect(facts.announceChanged.mock.calls).toEqual([[WS, ["f2"]]])
    })
})

describe("BrainBulkService undoBatch", () => {
    it("puts every fact of the batch that is still as it was applied back to review, and keeps the ones changed since", async () => {
        const { service, batches, reads } = await build()
        const note = "bulk:batch-1 - Applied together"
        // Read by the batch's own tag (never out of the newest facts in force); a prefix twin (batch-10) is still told apart.
        batches.inForce.mockResolvedValue([
            factOf({ id: "a", status: "active", decisionNote: note }),
            factOf({ id: "b", status: "active", decisionNote: note }),
            factOf({ id: "c", status: "active", decisionNote: "bulk:batch-10 - Applied together" }),
        ])
        batches.reopen.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

        await expect(service.undoBatch("u1", WS, "batch-1")).resolves.toEqual({ restored: 1, kept: 1 })

        expect(batches.inForce).toHaveBeenCalledWith(WS, "batch-1")
        expect(reads.list).not.toHaveBeenCalled()
        expect(batches.reopen.mock.calls).toEqual([
            [WS, "a", "batch-1"],
            [WS, "b", "batch-1"],
        ])
    })

    it("does nothing for a caller who may not change the brain", async () => {
        const { service, members, batches } = await build()
        const refusal = new Error("role")
        members.require.mockRejectedValue(refusal)

        await expect(service.undoBatch("u1", WS, "batch-1")).rejects.toBe(refusal)

        expect(batches.inForce).not.toHaveBeenCalled()
    })
})

describe("BrainBulkService applyDocument at scale", () => {
    it("a document of 2,000 safe facts: 2,000 quiet applies and ONE announcement naming all of them (no workspace refresh)", async () => {
        const { service, facts, reads } = await build()
        const many = Array.from({ length: 2000 }, (_, index) =>
            factOf({ id: `f${String(index)}`, subjectKey: `item-${String(index)}` }),
        )
        reads.ofSources.mockResolvedValue(many)
        facts.byKey.mockReset()
        const none: Array<FactRecord> = []
        facts.byKey.mockImplementation((_ws, subjectKey, _attribute, status) =>
            Promise.resolve(status === "proposed" ? many.filter((fact) => fact.subjectKey === subjectKey) : none),
        )

        await expect(service.applyDocument("u1", WS, "s1")).resolves.toEqual({
            batchId: BATCH,
            applied: 2000,
            skipped: 0,
        })

        expect(facts.applyUnannounced).toHaveBeenCalledTimes(2000)
        expect(facts.apply).not.toHaveBeenCalled()
        expect(facts.announceChanged).toHaveBeenCalledTimes(1)
        expect(facts.announceChanged.mock.calls[0]?.[1]).toHaveLength(2000)
    })
})
