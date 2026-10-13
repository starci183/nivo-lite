import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { KnowledgeView } from "./agent-knowledge.contracts"
import { KnowledgeRecallService } from "./knowledge-recall.service"

const view: KnowledgeView = {
    workspaceId: "11111111-1111-4111-8111-111111111111",
    module: "chatbot",
    audience: "customer",
    installationId: null,
}

const fact = { subjectKey: "tea", subjectLabel: "Tea", attributeLabel: "Price", value: "50k", scope: "public" }
const passage = (layer: string, title: string) => ({ layer, title, content: `${title} text`, topic: null })
const catalog: MessageCatalog = { get: (key: string) => key }

const build = async () => {
    const facts = { search: jest.fn().mockResolvedValue([fact]), forView: jest.fn().mockResolvedValue([fact]) }
    const lessons = { forModule: jest.fn().mockResolvedValue([]) }
    const search = {
        passages: jest.fn().mockResolvedValue([passage("business", "Menu"), passage("nivo", "Playbook")]),
    }
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeRecallService,
            { provide: BrainFactsService, useValue: mock<BrainFactsService>(facts) },
            { provide: BrainLessonsService, useValue: mock<BrainLessonsService>(lessons) },
            { provide: KnowledgeSearchService, useValue: mock<KnowledgeSearchService>(search) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>(catalog) },
            { provide: LOGGER, useValue: mock<Logger>(logger) },
        ],
    }).compile()
    return { recall: moduleRef.get(KnowledgeRecallService), search, logger }
}

describe("KnowledgeRecallService", () => {
    it("recalls the facts first, then the business passages only", async () => {
        const { recall } = await build()
        const found = await recall.recall(view, "tea price")
        expect(found.brief).toContain("Tea - Price: 50k")
        expect(found.brief).toContain("Menu")
        expect(found.brief).not.toContain("Playbook")
        expect(found.passages).toHaveLength(1)
    })

    it("goes on without the passages when the search fails, and says so in the log", async () => {
        const { recall, search, logger } = await build()
        search.passages.mockRejectedValueOnce(new Error("embedding down"))
        const found = await recall.recall(view, "tea price")
        expect(found.brief).toContain("Tea - Price: 50k")
        expect(logger.error).toHaveBeenCalled()
    })

    it("writes the standing memory grouped by subject", async () => {
        const { recall } = await build()
        await expect(recall.standingMemory(view)).resolves.toBe("bundle.memoryFacts")
    })
})
