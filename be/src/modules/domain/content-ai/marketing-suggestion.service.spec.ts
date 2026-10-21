import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import type { GenerationOutcome } from "@modules/domain/ai-generations"
import { BrandKitService } from "./brand-kit.service"
import type { GuidelineKit, MarketingWeeklyReport } from "./content-agent.contracts"
import { MarketingSuggestionService } from "./marketing-suggestion.service"

const KIT: GuidelineKit = {
    brandName: "HAKUEN",
    colors: [],
    fonts: [],
    tone: "Warm.",
    address: "",
    imagery: [],
    avoid: [],
}

const REPORT: MarketingWeeklyReport = {
    weekStart: "2026-10-12",
    weekEnd: "2026-10-18",
    reach: { value: 12480, previous: 10000, changePct: 25 },
    engagements: { value: 1286, previous: 900, changePct: 43 },
    messages: { value: 48, previous: 36, changePct: 33 },
    days: [],
    channels: ["facebook"],
    posts: [],
    postCount: 0,
    suggestion: null,
}

const ok = (output: string): GenerationOutcome => ({
    ok: true,
    output,
    generationId: "g-1",
    timings: {},
    usage: null,
})

const build = async () => {
    const generations = mock<DirectGenerationService>()
    const brand = mock<BrandKitService>()
    brand.brandOf.mockResolvedValue({ kit: KIT, logoPath: null })
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingSuggestionService,
            { provide: DirectGenerationService, useValue: generations },
            { provide: BrandKitService, useValue: brand },
        ],
    }).compile()
    return { service: moduleRef.get(MarketingSuggestionService), generations, brand }
}

describe("MarketingSuggestionService", () => {
    it("asks the model about the week in the brand and answers its suggestion with the sources it read", async () => {
        const { service, generations } = await build()
        generations.run.mockResolvedValue(ok(JSON.stringify({ title: "Facebook led", body: "Post two videos." })))

        const suggestion = await service.suggest("ws-1", "en", REPORT)

        expect(suggestion).toEqual({
            title: "Facebook led",
            body: "Post two videos.",
            sources: [
                { layer: 1, kind: "connector", ref: "meta.page_insights", label: "facebook" },
                { layer: 1, kind: "connector", ref: "channel.messages", label: "facebook" },
                { layer: 2, kind: "brain_fact", ref: "brand_kit:HAKUEN", label: "HAKUEN" },
            ],
        })
        expect(generations.run).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: "ws-1",
                purpose: "marketing_report",
                responseFormat: "json",
                timeoutMs: 45_000,
                kind: "engine",
                module: "content",
                locale: "en",
            }),
        )
    })

    it("asks nothing for a week without engagement and without posts", async () => {
        const { service, generations, brand } = await build()

        await expect(
            service.suggest("ws-1", "vi", { ...REPORT, engagements: { value: 0, previous: 0, changePct: null } }),
        ).resolves.toBeNull()
        expect(generations.run).not.toHaveBeenCalled()
        expect(brand.brandOf).not.toHaveBeenCalled()
    })

    it("still asks for a week with posts but no counted engagement", async () => {
        const { service, generations } = await build()
        generations.run.mockResolvedValue(ok(JSON.stringify({ title: "t", body: "b" })))

        const suggestion = await service.suggest("ws-1", "vi", {
            ...REPORT,
            engagements: { value: 0, previous: 0, changePct: null },
            postCount: 2,
        })

        expect(suggestion?.title).toBe("t")
    })

    it("answers no suggestion when the generation is refused or unreadable", async () => {
        const { service, generations } = await build()
        generations.run.mockResolvedValueOnce({ ok: false, reason: "quota", message: "out of credit" })
        generations.run.mockResolvedValueOnce(ok("{}"))

        await expect(service.suggest("ws-1", "vi", REPORT)).resolves.toBeNull()
        await expect(service.suggest("ws-1", "vi", REPORT)).resolves.toBeNull()
    })
})
