import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GenerationUsageRecord } from "@modules/domain/ai-generations"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { QuotaStatus } from "./ai-usage-events.contracts"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { UsageGateService } from "./usage-gate.service"

const BLOCKED: QuotaStatus = {
    periodStart: "2026-10-01",
    messagesUsed: 100,
    tokensUsed: 30,
    costUsd: 0.1,
    messagesLimit: 100,
    tokensLimit: 1000,
    fallbackReply: null,
    creditsUsed: 20,
    creditsLimit: 20,
    creditsCarried: 0,
    topupBalance: 0,
    messagesExceeded: true,
    tokensExceeded: false,
    creditsExceeded: true,
    ratio: 1,
    level: "exceeded",
}

const ENTRY: GenerationUsageRecord = {
    workspaceId: "ws-1",
    kind: "chat_reply",
    module: "chat",
    usage: {
        prompt_tokens: 10,
        completion_tokens: 4,
        cached_tokens: 0,
        cost: 0.02,
        model: "openclaw/writer",
    },
    completionChars: 20,
}

const build = async () => {
    const usage = mock<AiUsageEventsService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("Allowance used")
    const moduleRef = await Test.createTestingModule({
        providers: [
            UsageGateService,
            { provide: AiUsageEventsService, useValue: usage },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { gate: moduleRef.get(UsageGateService), usage, catalog }
}

describe("UsageGateService", () => {
    it("returns no block when the allowance still has room", async () => {
        const { gate, usage } = await build()
        usage.blockedBy.mockResolvedValue(null)

        await expect(gate.blockedBy("ws-1", "chat_reply", "en")).resolves.toBeNull()
        expect(usage.blockedBy).toHaveBeenCalledWith("ws-1", "chat_reply", false)
    })

    it("returns the catalog sentence when the allowance is used up", async () => {
        const { gate, usage, catalog } = await build()
        usage.blockedBy.mockResolvedValue(BLOCKED)

        await expect(gate.blockedBy("ws-1", "unknown-kind", "vi")).resolves.toEqual({ message: "Allowance used" })
        expect(usage.blockedBy).toHaveBeenCalledWith("ws-1", "engine", false)
        expect(catalog.get).toHaveBeenCalledWith("usage.exceeded", {}, "vi")
    })

    it("meters provider figures and books openclaw when the run names no model", async () => {
        const { gate, usage } = await build()
        usage.record.mockResolvedValue(undefined)

        await expect(gate.record(ENTRY)).resolves.toBeUndefined()
        await expect(gate.record({ ...ENTRY, usage: null, completionChars: 8 })).resolves.toBeUndefined()
        expect(usage.record).toHaveBeenNthCalledWith(1, {
            workspaceId: "ws-1",
            kind: "chat_reply",
            module: "chat",
            model: "openclaw/writer",
            usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14, cost: 0.02 },
            promptChars: 0,
            completionChars: 20,
        })
        expect(usage.record).toHaveBeenNthCalledWith(2, {
            workspaceId: "ws-1",
            kind: "chat_reply",
            module: "chat",
            model: "openclaw",
            usage: null,
            promptChars: 0,
            completionChars: 8,
        })
    })
})
