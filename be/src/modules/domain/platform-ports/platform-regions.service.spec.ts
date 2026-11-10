import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundConnection } from "@modules/domain/agent-connections"
import { AgentKnowledgeLensService } from "@modules/domain/agent-knowledge"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ProviderAbilitiesService } from "@modules/domain/mcp-gateway"
import type { ProviderBoard } from "@modules/domain/mcp-gateway"
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

/**
 * The rights board of a workspace: Zalo OA (one account), SePay with two accounts (MB, the default receiving one, and VCB) and payOS with
 * no ability. Agent a1 is attached to both SePay accounts and to payOS; a2 to the Zalo OA.
 */
const BOARD = {
    providers: [
        {
            provider: "zalo_oa",
            label: { vi: "Zalo OA", en: "Zalo OA" },
            kind: "messaging",
            kindLabel: { vi: "Tin nhắn", en: "Messaging" },
            connected: true,
            abilities: [{ id: "customer.send", label: { vi: "Gửi tin cho khách", en: "Send to customers" }, scope: "write", tools: [] }],
            accounts: [{ connectionId: "z1", provider: "zalo_oa", label: "Tiệm hoa NIVO", connected: true, isDefault: false }],
        },
        {
            provider: "sepay",
            label: { vi: "SePay", en: "SePay" },
            kind: "payment",
            kindLabel: { vi: "Thanh toán", en: "Payment" },
            connected: true,
            abilities: [
                { id: "bank.read", label: { vi: "Đọc giao dịch", en: "Read transactions" }, scope: "read", tools: [] },
                { id: "payment.rematch", label: { vi: "Dò lại tiền", en: "Rematch" }, scope: "write", tools: [] },
                { id: "payment.qr", label: { vi: "Tạo QR", en: "Create QR" }, scope: "write", tools: [] },
            ],
            accounts: [
                { connectionId: "k-mb", provider: "sepay", label: "MB •••• 5252", connected: true, isDefault: true },
                { connectionId: "k-vcb", provider: "sepay", label: "VCB •••• 0071", connected: true, isDefault: false },
            ],
        },
        {
            provider: "payos",
            label: { vi: "payOS", en: "payOS" },
            kind: "payment",
            kindLabel: { vi: "Thanh toán", en: "Payment" },
            connected: true,
            abilities: [],
            accounts: [{ connectionId: "p1", provider: "payos", label: "payOS shop", connected: true, isDefault: false }],
        },
    ],
    attachments: [
        { agentId: "a1", connectionId: "k-mb", provider: "sepay", abilities: { "bank.read": "auto", "payment.rematch": "auto", "payment.qr": "ask" } },
        { agentId: "a1", connectionId: "k-vcb", provider: "sepay", abilities: { "bank.read": "auto" } },
        { agentId: "a1", connectionId: "p1", provider: "payos", abilities: {} },
        { agentId: "a2", connectionId: "z1", provider: "zalo_oa", abilities: { "customer.send": "auto" } },
    ],
} as unknown as ProviderBoard

const build = async () => {
    const bindings = mock<AgentBindingsService>()
    const directory = mock<AgentDirectoryService>()
    const gaps = mock<KnowledgeGapsService>()
    const lens = mock<AgentKnowledgeLensService>()
    const abilities = mock<ProviderAbilitiesService>({ board: jest.fn().mockResolvedValue(BOARD) })
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
            { provide: ProviderAbilitiesService, useValue: abilities },
        ],
    }).compile()
    return { service: moduleRef.get(PlatformRegionsService), bindings, directory, gaps, lens, abilities }
}

describe("PlatformRegionsService connections: the accounts attached to the agent, read only", () => {
    it("lists one row per attached ACCOUNT: provider · account, abilities with the mode of each write, and the default receiving flag", async () => {
        const { service, bindings, abilities } = await build()
        bindings.connectionsFor.mockResolvedValue([
            connection({ id: "k-mb", provider: "sepay", name: "MB", accountMasked: "5252", purpose: "bank_feed" }),
        ])

        const region = await service.connectionsOf("w1", "a1", "vi")

        expect(abilities.board).toHaveBeenCalledWith("w1")
        expect(region).toEqual({
            label: "vi:workbench.platform.connections.title:{}",
            rightsLabel: "vi:workbench.platform.connections.rights:{}",
            rightsHref: "",
            rows: [
                {
                    id: "k-mb",
                    name: "SePay · MB •••• 5252",
                    description:
                        "Đọc giao dịch · Dò lại tiền (vi:workbench.platform.connections.mode_auto:{}) · Tạo QR (vi:workbench.platform.connections.mode_ask:{})",
                    provider: "sepay",
                    account: "MB •••• 5252",
                    isDefaultReceiving: true,
                    access: "auto",
                    accountMasked: "5252",
                },
                {
                    id: "k-vcb",
                    name: "SePay · VCB •••• 0071",
                    description: "Đọc giao dịch",
                    provider: "sepay",
                    account: "VCB •••• 0071",
                    access: "read",
                },
                {
                    id: "p1",
                    name: "payOS · payOS shop",
                    description: "vi:workbench.platform.connections.none:{}",
                    provider: "payos",
                    account: "payOS shop",
                },
            ],
        })
    })

    it("lists no row for an agent attached to nothing, and never another agent's attachment", async () => {
        const { service, bindings } = await build()
        bindings.connectionsFor.mockResolvedValue([])
        await expect(service.connectionsOf("w1", "a9", "en")).resolves.toMatchObject({ rows: [] })
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
