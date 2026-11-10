import { mock } from "@starci/jest-preset"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import type { DocumentAiCost } from "@modules/domain/ai-usage-events"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceSummary } from "@modules/domain/knowledge-sources"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeSourcesHandler } from "./knowledge-sources.handler"
import { KnowledgeSourcesQuery } from "./knowledge-sources.query"

const ZERO = { calls: 0, failedTries: 0, tokens: 0, costUsd: 0, credits: 0, failedCostUsd: 0, failedCredits: 0 }
const COST: DocumentAiCost = {
    read: { ...ZERO, calls: 3, costUsd: 0.00113, credits: 1 },
    critique: { ...ZERO, calls: 1, costUsd: 0.0113, credits: 10 },
    reread: ZERO,
    total: { ...ZERO, calls: 4, costUsd: 0.01243, credits: 11 },
    models: ["claude-sonnet-5-5"],
}

const build = (costs: ReadonlyMap<string, DocumentAiCost> | null) => {
    const sources = mock<KnowledgeSourcesService>()
    sources.list.mockResolvedValue([{ id: "s1" } as SourceSummary, { id: "s2" } as SourceSummary])
    const usage = mock<AiUsageOverviewService>()
    usage.documentCosts.mockResolvedValue(costs)
    return { handler: new KnowledgeSourcesHandler(mock<Logger>(), sources, usage), usage }
}

const query = () =>
    new KnowledgeSourcesQuery({ request: { workspaceId: "ws-1" }, principal: { id: "user-1" } as never })

describe("KnowledgeSourcesHandler", () => {
    it("gives an owner or manager each document's AI cost (read, critique, re-read), read for the listed documents at once", async () => {
        const { handler, usage } = build(new Map([["s1", COST]]))

        const listed = await handler.execute(query())

        expect(listed.map((source) => [source.id, source.aiCost?.total.credits ?? null])).toEqual([
            ["s1", 11],
            ["s2", null],
        ])
        expect(usage.documentCosts).toHaveBeenCalledWith("user-1", "ws-1", ["s1", "s2"])
    })

    it("gives staff the list with no cost (the role guard answers null)", async () => {
        const { handler } = build(null)

        const listed = await handler.execute(query())

        expect(listed.map((source) => source.aiCost)).toEqual([null, null])
    })
})
