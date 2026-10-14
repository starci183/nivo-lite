import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { Passage } from "@modules/domain/knowledge"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { KnowledgeView } from "./agent-knowledge.contracts"
import { AgentKnowledgeLogEvent } from "./agent-knowledge.log-events"
import { KnowledgeRecallService } from "./knowledge-recall.service"

const view: KnowledgeView = {
    workspaceId: "11111111-1111-4111-8111-111111111111",
    module: "chatbot",
    audience: "customer",
    installationId: null,
}

const fact: FactRecord = {
    id: "fact-1",
    subjectType: "product",
    subjectKey: "tea",
    subjectLabel: "Tea",
    attribute: "price",
    attributeLabel: "Price",
    value: "50k",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 100,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "owner-1",
    proposedAt: "2026-10-12T10:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
}
const passage = (layer: string, title: string): Passage => ({
    layer,
    id: title,
    sourceId: "source-1",
    module: "chatbot",
    kind: "document",
    title,
    content: `${title} text`,
    score: 1,
    visibility: "public",
    topic: null,
})
const lesson = (title: string, appliesWhen: string): LessonRecord => ({
    id: title,
    module: "chatbot",
    title,
    body: "Ask once.",
    appliesWhen,
    status: "active",
    origin: "manual",
    evidence: [],
    version: 1,
    proposedBy: "owner-1",
    proposedAt: "2026-10-12T10:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
})
const catalog: MessageCatalog = { get: (key: string) => key }

const build = async () => {
    const facts = mock<BrainFactsService>({
        search: jest.fn().mockResolvedValue([fact]),
        forView: jest.fn().mockResolvedValue([fact]),
    })
    const lessons = mock<BrainLessonsService>({ forModule: jest.fn().mockResolvedValue([]) })
    const search = mock<KnowledgeSearchService>({
        passages: jest.fn().mockResolvedValue([passage("business", "Menu"), passage("nivo", "Playbook")]),
    })
    const logger = mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
    const messages = mock<MessageCatalog>({ get: jest.fn(catalog.get) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeRecallService,
            { provide: BrainFactsService, useValue: facts },
            { provide: BrainLessonsService, useValue: lessons },
            { provide: KnowledgeSearchService, useValue: search },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { recall: moduleRef.get(KnowledgeRecallService), facts, lessons, search, logger, messages }
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

    it("reads a bounded fact view and passes the complete view to a fact search", async () => {
        const { recall, facts } = await build()
        const second = { ...fact, id: "fact-2", value: "60k" }
        facts.forView.mockResolvedValue([fact, second])
        const scoped = { ...view, installationId: "agent-1", audience: "internal" as const }

        await expect(recall.factsInView(scoped, 1)).resolves.toEqual([fact])
        await expect(recall.factsMatching(scoped, "tea price", 2)).resolves.toEqual([fact])

        expect(facts.forView).toHaveBeenCalledWith(view.workspaceId, "internal", "chatbot", "agent-1", 500)
        expect(facts.search).toHaveBeenCalledWith(view.workspaceId, "internal", "chatbot", "agent-1", "tea price", 2)
    })

    it("keeps passage knowledge when facts fail and logs the exact failed part", async () => {
        const { recall, facts, search, logger } = await build()
        const cause = new Error("facts unavailable")
        facts.search.mockRejectedValueOnce(cause)

        await expect(recall.recall(view, "menu", { facts: 2, passages: 3, budget: 100 })).resolves.toEqual({
            brief: [
                "BUSINESS KNOWLEDGE (use only what is here; never invent a price, policy, date or promise that is not written):",
                "From the business documents:\n- Menu: Menu text",
            ].join("\n"),
            passages: [passage("business", "Menu")],
        })
        expect(facts.search).toHaveBeenCalledWith(view.workspaceId, "customer", "chatbot", null, "menu", 2)
        expect(search.passages).toHaveBeenCalledWith(view, "menu", 3)
        expect(logger.error).toHaveBeenCalledWith(AgentKnowledgeLogEvent.RecallPartFailed, cause, {
            workspaceId: view.workspaceId,
            part: "facts",
        })
    })

    it("answers an empty recall when both knowledge sources fail", async () => {
        const { recall, facts, search, logger } = await build()
        const factsCause = new Error("facts unavailable")
        const passageCause = new Error("passages unavailable")
        facts.search.mockRejectedValueOnce(factsCause)
        search.passages.mockRejectedValueOnce(passageCause)

        await expect(recall.recall(view, "tea")).resolves.toEqual({ brief: "", passages: [] })
        expect(logger.error).toHaveBeenCalledWith(AgentKnowledgeLogEvent.RecallPartFailed, factsCause, {
            workspaceId: view.workspaceId,
            part: "facts",
        })
        expect(logger.error).toHaveBeenCalledWith(AgentKnowledgeLogEvent.RecallPartFailed, passageCause, {
            workspaceId: view.workspaceId,
            part: "passages",
        })
    })

    it("uses the fact budget before passages and omits citations that do not fit", async () => {
        const { recall, search } = await build()
        search.passages.mockResolvedValue([passage("business", "Menu"), passage("business", "Hours")])

        await expect(recall.recall(view, "tea", { facts: 1, passages: 2, budget: 18 })).resolves.toEqual({
            brief: [
                "BUSINESS KNOWLEDGE (use only what is here; never invent a price, policy, date or promise that is not written):",
                "Confirmed facts:\n- Tea - Price: 50k",
            ].join("\n"),
            passages: [],
        })
    })

    it("normalizes and clips document text and returns only the passages quoted in the brief", async () => {
        const { recall, facts, search } = await build()
        facts.search.mockResolvedValue([])
        const menu = { ...passage("business", "Menu"), content: `Tea\n\t${"x".repeat(400)}` }
        const hours = passage("business", "Hours")
        search.passages.mockResolvedValue([passage("nivo", "Playbook"), menu, hours])

        await expect(recall.recall(view, "tea", { facts: 0, passages: 3, budget: 408 })).resolves.toEqual({
            brief: [
                "BUSINESS KNOWLEDGE (use only what is here; never invent a price, policy, date or promise that is not written):",
                `From the business documents:\n- Menu: Tea ${"x".repeat(395)}…`,
            ].join("\n"),
            passages: [menu],
        })
    })

    it("answers empty recall and standing memory when the view contains no knowledge", async () => {
        const { recall, facts, search, messages } = await build()
        facts.search.mockResolvedValue([])
        facts.forView.mockResolvedValue([])
        search.passages.mockResolvedValue([])

        await expect(recall.recall(view, "tea")).resolves.toEqual({ brief: "", passages: [] })
        await expect(recall.standingMemory(view, 100)).resolves.toBe("")
        expect(messages.get).not.toHaveBeenCalled()
    })

    it("groups facts by their first subject label and budgets complete subject blocks", async () => {
        const { recall, facts, lessons, messages } = await build()
        facts.forView.mockResolvedValue([
            fact,
            { ...fact, id: "fact-2", subjectLabel: "Tea renamed", attributeLabel: "Size", value: "Large" },
            { ...fact, id: "fact-3", subjectKey: "coffee", subjectLabel: "Coffee" },
        ])
        messages.get.mockImplementation((_key, params) => `facts: ${String(params?.body)}`)

        await expect(recall.standingMemory(view, 35)).resolves.toBe("facts: ### Tea\n- Price: 50k\n- Size: Large")
        expect(messages.get).toHaveBeenCalledWith(
            "bundle.memoryFacts",
            { body: "### Tea\n- Price: 50k\n- Size: Large" },
            "vi",
        )
        expect(lessons.forModule).toHaveBeenCalledWith(view.workspaceId, "chatbot")
    })

    it.each([null, undefined, ""])("keeps an empty heading for provider subject label %s", async (subjectLabel) => {
        const { recall, facts, messages } = await build()
        facts.forView.mockResolvedValue([Object.assign({}, fact, { subjectLabel })])
        messages.get.mockImplementation((_key, params) => `facts: ${String(params?.body)}`)

        await expect(recall.standingMemory(view)).resolves.toBe("facts: ### \n- Price: 50k")
        expect(messages.get).toHaveBeenCalledWith("bundle.memoryFacts", { body: "### \n- Price: 50k" }, "vi")
    })

    it("includes conditional lessons after facts and omits a condition for blank applicability", async () => {
        const { recall, lessons, messages } = await build()
        lessons.forModule.mockResolvedValue([lesson("Size", "Size missing"), lesson("Always", " \t ")])
        messages.get.mockImplementation((key, params) =>
            key === "bundle.memoryWhen" ? ` (when ${String(params?.when)})` : `${key}: ${String(params?.body)}`,
        )

        await expect(recall.standingMemory(view)).resolves.toBe(
            "bundle.memoryFacts: ### Tea\n- Price: 50k\n\nbundle.memoryLessons: - Size: Ask once. (when Size missing)\n- Always: Ask once.",
        )
        expect(messages.get).toHaveBeenCalledWith("bundle.memoryWhen", { when: "Size missing" }, "vi")
        expect(messages.get).toHaveBeenCalledWith(
            "bundle.memoryLessons",
            { body: "- Size: Ask once. (when Size missing)\n- Always: Ask once." },
            "vi",
        )
    })
})
