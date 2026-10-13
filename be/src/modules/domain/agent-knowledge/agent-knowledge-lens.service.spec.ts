import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import { AgentKnowledgeLensService } from "./agent-knowledge-lens.service"
import { KnowledgeRecallService } from "./knowledge-recall.service"

const WS = "11111111-1111-4111-8111-111111111111"

const nivoItem = (module: string, slug: string, kind: string) => ({
    id: slug,
    module,
    slug,
    title: slug,
    body: `${slug} body`,
    kind,
    version: 1,
    updatedAt: "2026-10-01T00:00:00.000Z",
})

const build = async () => {
    const sources = { readableFor: jest.fn().mockResolvedValue([]), countReadable: jest.fn().mockResolvedValue(2) }
    const recall = { standingMemory: jest.fn().mockResolvedValue(""), factsInView: jest.fn().mockResolvedValue([]) }
    const nivo = {
        list: jest
            .fn()
            .mockResolvedValue([
                nivoItem("core", "a-core", "authority"),
                nivoItem("chatbot", "b-bot", "escalation"),
                nivoItem("chatbot", "c-play", "playbook"),
            ]),
    }
    const gaps = { openOfModule: jest.fn() }
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentKnowledgeLensService,
            { provide: KnowledgeSourcesService, useValue: mock<KnowledgeSourcesService>(sources) },
            { provide: KnowledgeRecallService, useValue: mock<KnowledgeRecallService>(recall) },
            { provide: NivoKnowledgeService, useValue: mock<NivoKnowledgeService>(nivo) },
            { provide: KnowledgeGapsService, useValue: mock<KnowledgeGapsService>(gaps) },
        ],
    }).compile()
    return { lens: moduleRef.get(AgentKnowledgeLensService), sources, gaps }
}

describe("AgentKnowledgeLensService", () => {
    it("reads customer modules and unknown keys through the public view", async () => {
        const { lens } = await build()
        expect(lens.audienceOf("chatbot")).toBe("customer")
        expect(lens.audienceOf("content")).toBe("customer")
        expect(lens.audienceOf("no-such-module")).toBe("customer")
        expect(lens.audienceOf("accounting")).toBe("internal")
    })

    it("orders the module's own rules before core and leaves other kinds out", async () => {
        const { lens } = await build()
        const rules = await lens.baseRulesOf(["chatbot", "core"])
        expect(rules.map((rule) => rule.title)).toEqual(["b-bot", "a-core"])
    })

    it("never counts internal documents for a customer lens", async () => {
        const { lens, sources } = await build()
        const counts = await lens.countsFor(WS, "chatbot", null)
        expect(counts.audience).toBe("customer")
        expect(sources.countReadable).toHaveBeenCalledWith(expect.objectContaining({ audience: "customer" }), "public")
    })

    it("answers null for the gaps only when their table is missing", async () => {
        const { lens, gaps } = await build()
        gaps.openOfModule.mockRejectedValueOnce({ driverError: { code: "42P01" } })
        await expect(lens.openGapsOf(WS, "chatbot", 5)).resolves.toBeNull()
        gaps.openOfModule.mockRejectedValueOnce(new Error("boom"))
        await expect(lens.openGapsOf(WS, "chatbot", 5)).rejects.toThrow("boom")
    })
})
