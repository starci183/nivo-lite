import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import type { DocumentAiCost } from "@modules/domain/ai-usage-events"
import type { SourceDetail } from "@modules/domain/knowledge-sources"
import { KnowledgeDocumentsService } from "./knowledge-documents.service"
import type { OpenedKnowledgeSource } from "./knowledge.contracts"
import { KnowledgeSourceReadService } from "./knowledge-source-read.service"

const ZERO = { calls: 0, failedTries: 0, tokens: 0, costUsd: 0, credits: 0, failedCostUsd: 0, failedCredits: 0 }
const COST: DocumentAiCost = { read: ZERO, critique: ZERO, reread: ZERO, total: { ...ZERO, credits: 5 }, models: [] }

const build = async (costs: ReadonlyMap<string, DocumentAiCost> | null) => {
    const documents = mock<KnowledgeDocumentsService>()
    documents.document.mockResolvedValue(mock<OpenedKnowledgeSource>({ source: mock<SourceDetail>({ id: "s1" }) }))
    const usage = mock<AiUsageOverviewService>()
    usage.documentCosts.mockResolvedValue(costs)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSourceReadService,
            { provide: KnowledgeDocumentsService, useValue: documents },
            { provide: AiUsageOverviewService, useValue: usage },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeSourceReadService), documents, usage }
}

describe("KnowledgeSourceReadService", () => {
    it("opens the document for the caller and adds what it cost in AI", async () => {
        const { service, documents, usage } = await build(new Map([["s1", COST]]))

        const read = await service.read("user-1", "ws-1", "s1")

        expect(documents.document).toHaveBeenCalledWith("user-1", "ws-1", "s1")
        expect(usage.documentCosts).toHaveBeenCalledWith("user-1", "ws-1", ["s1"])
        expect(read.aiCost?.total.credits).toBe(5)
    })

    it("answers a null cost for staff (no usage is read) and for a document with no usage", async () => {
        const staff = await build(null)
        await expect(staff.service.read("user-2", "ws-1", "s1")).resolves.toEqual(expect.objectContaining({ aiCost: null }))

        const none = await build(new Map())
        await expect(none.service.read("user-1", "ws-1", "s1")).resolves.toEqual(expect.objectContaining({ aiCost: null }))
    })
})
