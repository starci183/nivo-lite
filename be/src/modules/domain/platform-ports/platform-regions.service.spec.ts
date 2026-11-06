import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundConnection } from "@modules/domain/agent-connections"
import { AgentKnowledgeLensService } from "@modules/domain/agent-knowledge"
import { AgentDirectoryService } from "@modules/domain/agents"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { PlatformRegionsService } from "./platform-regions.service"

const connection = (overrides: Partial<BoundConnection>): BoundConnection => ({
    id: "k1",
    provider: "zalo_oa",
    name: "Zalo OA",
    botUsername: null,
    accountMasked: null,
    status: "connected",
    access: "auto",
    purpose: "inbound_chat",
    ...overrides,
})

const gap = (id: string, question: string, topic: string | null, count: number): GapRecord => ({
    id,
    module: "chatbot",
    question,
    topic,
    attributeGuess: null,
    count,
    firstSeenAt: "",
    lastSeenAt: "",
    exampleConversationId: null,
    status: "open",
    reopenedCount: 0,
})

const COUNTS = {
    audience: "internal" as const,
    documents: { public: 14, internal: 6 },
    facts: { public: 0, internal: 0, restricted: 0 },
}

const build = async () => {
    const bindings = mock<AgentBindingsService>()
    const directory = mock<AgentDirectoryService>()
    const gaps = mock<KnowledgeGapsService>()
    const lens = mock<AgentKnowledgeLensService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PlatformRegionsService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentDirectoryService, useValue: directory },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: AgentKnowledgeLensService, useValue: lens },
        ],
    }).compile()
    return { service: moduleRef.get(PlatformRegionsService), bindings, directory, gaps, lens }
}

describe("PlatformRegionsService connections", () => {
    it("lists the connections bound to the agent with their state and access in the viewer's words", async () => {
        const { service, bindings } = await build()
        bindings.connectionsFor.mockResolvedValue([
            connection({}),
            connection({ id: "k2", name: "SePay", status: "error", access: "read", purpose: "bank_feed" }),
        ])

        const region = await service.connectionsOf("a1", "en")

        expect(region.manageLabel).toBe("en:workbench.platform.connections.manage:{}")
        expect(region.rows.map((row) => [row.id, row.name, row.statusTone])).toEqual([
            ["k1", "Zalo OA", "success"],
            ["k2", "SePay", "danger"],
        ])
        expect(region.rows[1]).toMatchObject({
            description: "en:workbench.platform.purpose.bank_feed:{}",
            statusLabel: "en:workbench.platform.status.error:{}",
            accessLabel: "en:workbench.platform.access.read:{}",
        })
        expect(bindings.connectionsFor.mock.calls[0]?.[0]).toBe("a1")
    })

    it("lists no row for an agent with no connection", async () => {
        const { service, bindings } = await build()
        bindings.connectionsFor.mockResolvedValue([])
        await expect(service.connectionsOf("a1", "vi")).resolves.toMatchObject({ rows: [] })
    })
})

describe("PlatformRegionsService knowledge", () => {
    it("counts the documents by visibility and lists the most asked open gaps of the agent's module", async () => {
        const { service, directory, gaps, lens } = await build()
        directory.find.mockResolvedValue({ id: "a1", name: "Chat", module: "chatbot", canTagAgentIds: [] })
        lens.countsFor.mockResolvedValue(COUNTS)
        gaps.openOfModule.mockResolvedValue({
            openCount: 3,
            items: [gap("g1", "Open on Tet?", "hours", 2), gap("g2", "Refund?", null, 1)],
        })

        const region = await service.knowledgeOf("w1", "a1", "vi")

        expect(lens.countsFor).toHaveBeenCalledWith("w1", "chatbot", null)
        expect(gaps.openOfModule).toHaveBeenCalledWith("w1", "chatbot", 5)
        expect(region.publicDescription).toBe('vi:workbench.platform.knowledge.documents:{"count":14}')
        expect(region.internalDescription).toBe('vi:workbench.platform.knowledge.documents:{"count":6}')
        expect(region.gaps?.count).toBe("3")
        expect(region.gaps?.rows.map((row) => [row.id, row.title, row.description])).toEqual([
            ["g1", "Open on Tet?", "hours"],
            ["g2", "Refund?", ""],
        ])
        expect(region.gaps?.rows[0]?.asked).toBe('vi:workbench.platform.knowledge.asked:{"count":2}')
    })

    it("shows no gaps card when nothing is open, and no module for an agent the workspace does not hold", async () => {
        const { service, directory, gaps, lens } = await build()
        directory.find.mockResolvedValue(null)
        lens.countsFor.mockResolvedValue(COUNTS)
        gaps.openOfModule.mockResolvedValue({ openCount: 0, items: [] })

        const region = await service.knowledgeOf("w1", "a1", "en")

        expect(region.gaps).toBeNull()
        expect(lens.countsFor).toHaveBeenCalledWith("w1", "", null)
    })
})
