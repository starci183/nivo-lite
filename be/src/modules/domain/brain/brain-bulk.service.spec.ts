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

        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(reads.ofSources).toHaveBeenCalledWith(WS, ["s1"], ["proposed"], 2000)
        expect(facts.apply).toHaveBeenCalledTimes(1)
        expect(facts.apply).toHaveBeenCalledWith(
            WS,
            "f1",
            "Ada",
            expect.stringContaining(`bulk:${BATCH} - Applied together with the other checked facts of "Rules"`),
        )
    })

    it("refuses a document kept public: a bulk path never makes anything public", async () => {
        const { service, sources, facts, reads } = await build()
        sources.detail.mockResolvedValue(sourceOf({ visibility: "public" }))

        await expect(service.applyDocument("u1", WS, "s1")).rejects.toMatchObject({
            code: BrainErrorCode.BulkNeedsInternal,
        })

        expect(reads.ofSources).not.toHaveBeenCalled()
        expect(facts.apply).not.toHaveBeenCalled()
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

        expect(facts.apply).not.toHaveBeenCalled()
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
        facts.apply.mockRejectedValueOnce(decided)

        await expect(service.applyDocument("u1", WS, "s1")).resolves.toEqual({ batchId: BATCH, applied: 1, skipped: 1 })

        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.BulkFactSkipped, decided, { factId: "f1" })
        expect(facts.apply).toHaveBeenCalledTimes(2)
    })
})

describe("BrainBulkService undoBatch", () => {
    it("puts every fact of the batch that is still as it was applied back to review, and keeps the ones changed since", async () => {
        const { service, batches, reads } = await build()
        const note = "bulk:batch-1 - Applied together"
        reads.list.mockResolvedValue([
            factOf({ id: "a", status: "active", decisionNote: note }),
            factOf({ id: "b", status: "active", decisionNote: note }),
            factOf({ id: "c", status: "active", decisionNote: "bulk:batch-2 - Applied together" }),
            factOf({ id: "d", status: "active", decisionNote: "Chosen among several different values" }),
        ])
        batches.reopen.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

        await expect(service.undoBatch("u1", WS, "batch-1")).resolves.toEqual({ restored: 1, kept: 1 })

        expect(reads.list).toHaveBeenCalledWith(WS, { statuses: ["active"], limit: 2000 })
        expect(batches.reopen.mock.calls).toEqual([
            [WS, "a", "batch-1"],
            [WS, "b", "batch-1"],
        ])
    })

    it("does nothing for a caller who may not change the brain", async () => {
        const { service, members, reads } = await build()
        const refusal = new Error("role")
        members.require.mockRejectedValue(refusal)

        await expect(service.undoBatch("u1", WS, "batch-1")).rejects.toBe(refusal)

        expect(reads.list).not.toHaveBeenCalled()
    })
})
