import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundConnection } from "@modules/domain/agent-connections"
import { AgentKnowledgeLensService } from "@modules/domain/agent-knowledge"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import type { ConnectionCandidate } from "@modules/domain/connection-grants"
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

const OVERVIEW = {
    module: "accounting",
    installationId: null,
    audience: "internal" as const,
    waitingFacts: 1,
    layers: [
        { layer: "public" as const, isRead: true, documents: 2, approvedFacts: 0, totalFacts: 1 },
        { layer: "internal" as const, isRead: true, documents: 4, approvedFacts: 1, totalFacts: 3 },
        { layer: "restricted" as const, isRead: false, documents: 0, approvedFacts: 0, totalFacts: 0 },
    ],
    documents: Array.from({ length: 6 }, (_, index) => ({
        id: `d${index}`,
        title: "t",
        kind: "file",
        layer: "internal" as const,
        updatedAt: "",
        isRead: true,
        approvedFacts: 0,
        waitingFacts: 0,
    })),
    ownFacts: [],
}

const candidate = (overrides: Partial<ConnectionCandidate>): ConnectionCandidate => ({
    id: "k9",
    name: "VCB 1234",
    provider: "sepay",
    botUsername: null,
    accountMasked: "1234",
    status: "connected",
    purpose: "bank_feed",
    access: null,
    ...overrides,
})

const build = async () => {
    const bindings = mock<AgentBindingsService>()
    const directory = mock<AgentDirectoryService>()
    const gaps = mock<KnowledgeGapsService>()
    const lens = mock<AgentKnowledgeLensService>()
    const grants = mock<ConnectionGrantsService>()
    lens.overviewFor.mockResolvedValue(OVERVIEW)
    lens.waitingFactLabel.mockResolvedValue(null)
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
            { provide: ConnectionGrantsService, useValue: grants },
        ],
    }).compile()
    return { service: moduleRef.get(PlatformRegionsService), bindings, directory, gaps, lens, grants }
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

describe("PlatformRegionsService connections with candidates", () => {
    it("lists the bound connections with their provider and level, then the accounts not granted, each with the grant command", async () => {
        const { service, bindings, directory, grants } = await build()
        bindings.connectionsFor.mockResolvedValue([
            connection({ id: "k2", provider: "sepay", name: "MB", accountMasked: "9999", purpose: "bank_feed" }),
        ])
        directory.find.mockResolvedValue({ id: "a1", name: "KT", module: "accounting", canTagAgentIds: [] })
        grants.candidatesOf.mockResolvedValue([
            candidate({ id: "k2", access: "auto" }),
            candidate({}),
            candidate({ id: "k8", access: "ask" }),
        ])

        const region = await service.connectionsWithCandidatesOf("w1", "a1", "en")

        expect(grants.candidatesOf).toHaveBeenCalledWith("w1", "a1", "accounting")
        expect(region.rows.map((row) => [row.id, row.isGranted])).toEqual([
            ["k2", true],
            ["k9", false],
        ])
        expect(region.rows[0]).toMatchObject({ provider: "sepay", access: "auto", accountMasked: "9999" })
        expect(region.rows[1]).toMatchObject({
            provider: "sepay",
            accountMasked: "1234",
            actionLabel: "en:workbench.platform.connections.grant:{}",
            accessLabel: "",
        })
    })

    it("offers the accounts of an agent the workspace does not hold by no module, and an account with no mask without one", async () => {
        const { service, bindings, directory, grants } = await build()
        bindings.connectionsFor.mockResolvedValue([])
        directory.find.mockResolvedValue(null)
        grants.candidatesOf.mockResolvedValue([candidate({ accountMasked: null })])

        const region = await service.connectionsWithCandidatesOf("w1", "a1", "vi")

        expect(grants.candidatesOf).toHaveBeenCalledWith("w1", "a1", "")
        expect(region.rows[0]).not.toHaveProperty("accountMasked")
    })
})

describe("PlatformRegionsService knowledge summary", () => {
    it("sums the documents and the approved facts of the layers and names the fact that waits", async () => {
        const { service, directory, gaps, lens } = await build()
        directory.find.mockResolvedValue({ id: "a1", name: "KT", module: "accounting", canTagAgentIds: [] })
        lens.countsFor.mockResolvedValue(COUNTS)
        gaps.openOfModule.mockResolvedValue({ openCount: 0, items: [] })
        lens.waitingFactLabel.mockResolvedValue("Threshold · auto post")

        const region = await service.knowledgeOf("w1", "a1", "en")

        expect(lens.overviewFor).toHaveBeenCalledWith("w1", "accounting", null)
        expect(region.summary).toEqual({
            documentsLine: 'en:workbench.platform.knowledge.documents_line:{"documents":6,"public":2}',
            factsLine: 'en:workbench.platform.knowledge.facts_line:{"approved":1,"total":4}',
            approvedFacts: 1,
            totalFacts: 4,
            blocker: "Threshold · auto post",
            blockerLine: 'en:workbench.platform.knowledge.blocker:{"fact":"Threshold · auto post"}',
        })
    })
})
