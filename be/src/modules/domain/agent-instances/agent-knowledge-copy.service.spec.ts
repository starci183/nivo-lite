import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { factOf } from "@tests/fixtures/builders/brain-facts.builder"
import { installationRecordOf } from "@tests/fixtures/builders/module-install.builder"
import { BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactStatus } from "@modules/domain/brain-facts"
import {
    KnowledgeSourcesError,
    KnowledgeSourcesErrorCode,
    KnowledgeSourcesReadService,
    KnowledgeSourcesService,
} from "@modules/domain/knowledge-sources"
import type { InstanceDocument } from "@modules/domain/knowledge-sources"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentInstancesLogEvent } from "./agent-instances.log-events"
import { AgentKnowledgeCopyService } from "./agent-knowledge-copy.service"

const SOURCE = installationRecordOf({ id: "inst-lan", workspaceId: "w1", moduleKey: "sales", name: "Sales Lan" })

const BY = { userId: "u1", memberId: "m-1", role: "owner" as const }

const documentOf = builder<InstanceDocument>({
    id: "d1",
    kind: "text",
    title: "Prices",
    content: "Rose 20k",
    topic: null,
    tags: [],
    visibility: "internal",
})

type Facts = Partial<Record<FactStatus, ReadonlyArray<ReturnType<typeof factOf>>>>

/** The private facts of the source by status: what the read answers for each ask. */
const build = async (facts: Facts, docs: ReadonlyArray<InstanceDocument> = []) => {
    const brain = mock<BrainFactsService>()
    const reads = mock<BrainFactsReadService>()
    reads.ofInstance.mockImplementation((_ws, _inst, statuses) =>
        Promise.resolve(statuses.flatMap((status) => facts[status] ?? [])),
    )
    const sources = mock<KnowledgeSourcesService>()
    const sourceReads = mock<KnowledgeSourcesReadService>()
    sourceReads.readyOfInstance.mockResolvedValue(docs)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentKnowledgeCopyService,
            { provide: BrainFactsService, useValue: brain },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: KnowledgeSourcesReadService, useValue: sourceReads },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(AgentKnowledgeCopyService), brain, reads, sources, sourceReads, logger }
}

describe("AgentKnowledgeCopyService > facts", () => {
    it("copies the approved private facts as approved, private to the new agent, with provenance", async () => {
        const { service, brain } = await build({ active: [factOf({ id: "f1" })], scheduled: [factOf({ id: "f2" })] })

        const done = await service.copy(SOURCE, "inst-minh", BY)

        expect(brain.propose).toHaveBeenCalledTimes(2)
        expect(brain.propose).toHaveBeenCalledWith(
            "w1",
            expect.objectContaining({ installationId: "inst-minh", autoApply: true, proposedBy: "m-1" }),
        )
        expect(done).toMatchObject({ knowledgeFacts: 2 })
    })

    it("never copies a fact still waiting for approval as approved: it stays with the source and is counted", async () => {
        const { service, brain } = await build({
            active: [factOf({ id: "f1" })],
            proposed: [factOf({ id: "f9" }), factOf({ id: "f8" })],
        })

        const done = await service.copy(SOURCE, "inst-minh", BY)

        const copiedRefs = brain.propose.mock.calls.flatMap(([, input]) => (input.evidence ?? []).map((one) => one.ref))
        expect(copiedRefs).toEqual(expect.arrayContaining(["copy:f1"]))
        expect(copiedRefs).not.toContain("copy:f9")
        expect(copiedRefs).not.toContain("copy:f8")
        expect(brain.propose).toHaveBeenCalledTimes(1)
        expect(done).toMatchObject({ knowledgeFacts: 1, knowledgeWaiting: 2 })
    })

    it("reads only the facts kept for the source agent alone", async () => {
        const { service, reads } = await build({})

        await service.copy(SOURCE, "inst-minh", BY)

        expect(reads.ofInstance).toHaveBeenCalledWith("w1", "inst-lan", ["active", "scheduled"])
        expect(reads.ofInstance).toHaveBeenCalledWith("w1", "inst-lan", ["proposed"])
    })
})

describe("AgentKnowledgeCopyService > documents", () => {
    it("copies each private document as the new agent's own, added by the member's account", async () => {
        const { service, sources } = await build({}, [documentOf({ id: "d1" }), documentOf({ id: "d2" })])

        const done = await service.copy(SOURCE, "inst-minh", BY)

        expect(sources.addSource).toHaveBeenCalledTimes(2)
        expect(sources.addSource).toHaveBeenCalledWith(
            "u1",
            "w1",
            expect.objectContaining({ installationId: "inst-minh", module: "sales", title: "Prices" }),
        )
        expect(done).toMatchObject({ knowledgeDocuments: 2, knowledgeSkipped: 0 })
    })

    it("counts and logs a document the knowledge rules refuse, and goes on with the rest", async () => {
        const { service, sources, logger } = await build({}, [documentOf({ id: "d1" }), documentOf({ id: "d2" })])
        sources.addSource
            .mockRejectedValueOnce(new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound }))
            .mockResolvedValueOnce({ id: "new" })

        const done = await service.copy(SOURCE, "inst-minh", BY)

        expect(done).toMatchObject({ knowledgeDocuments: 1, knowledgeSkipped: 1 })
        expect(logger.warn).toHaveBeenCalledWith(
            AgentInstancesLogEvent.DocumentCopyRefused,
            expect.objectContaining({ workspaceId: "w1" }),
        )
    })

    it("lets any other failure through", async () => {
        const { service, sources } = await build({}, [documentOf()])
        const failure = new Error("database down")
        sources.addSource.mockRejectedValue(failure)

        await expect(service.copy(SOURCE, "inst-minh", BY)).rejects.toBe(failure)
    })
})
