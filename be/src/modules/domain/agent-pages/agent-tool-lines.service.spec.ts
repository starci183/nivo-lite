import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ToolsConsoleService, type GrantView, type ProviderBoard } from "@modules/domain/tools"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { FLOWER_SHOP_ACCOUNT_VI, MESSAGING_KIND_VI, RECEPTIONIST_VI } from "@tests/fixtures/i18n/agents-spec.messages"
import { AgentToolLinesService } from "./agent-tool-lines.service"

const BOARD: ProviderBoard = {
    providers: [
        {
            provider: "zalo_oa",
            label: { vi: "Zalo OA", en: "Zalo OA" },
            kind: "messaging",
            kindLabel: { vi: MESSAGING_KIND_VI, en: "Messaging" },
            connected: true,
            abilities: [],
            accounts: [
                { connectionId: "oa-1", provider: "zalo_oa", label: FLOWER_SHOP_ACCOUNT_VI, connected: true },
            ],
        },
    ],
    attachments: [
        { agentId: "agent-1", connectionId: "oa-1", provider: "zalo_oa" },
        { agentId: "agent-2", connectionId: "oa-1", provider: "zalo_oa" },
    ],
}

const GRANTS: ReadonlyArray<GrantView> = [
    { agentId: "agent-1", agentName: RECEPTIONIST_VI, tool: "nivo.tool.brain.search", mode: "auto", limitVnd: null, constraints: [], constraintsJson: "[]" },
    { agentId: "agent-2", agentName: "Sales", tool: "nivo.tool.agent.tag", mode: "ask", limitVnd: null, constraints: [], constraintsJson: "[]" },
]

const build = async (options: { readonly module?: string | null; readonly agent?: boolean } = {}) => {
    const admin = mock<ToolsConsoleService>({
        providerBoard: jest.fn().mockResolvedValue(BOARD),
        grants: jest.fn().mockResolvedValue(GRANTS),
    })
    const agents = mock<AgentDirectoryService>({
        find: jest.fn().mockResolvedValue(options.agent === false ? null : { id: "agent-1", name: RECEPTIONIST_VI, module: "chatbot" }),
    })
    const installations = mock<InstallationRecordsService>({
        ofAgent: jest.fn().mockResolvedValue(options.module === null ? null : { moduleKey: options.module ?? "chatbot" }),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentToolLinesService,
            { provide: ToolsConsoleService, useValue: admin },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: InstallationRecordsService, useValue: installations },
        ],
    }).compile()
    const service = container.get(AgentToolLinesService)
    return { handler: { execute: () => service.lines("user-1", "ws-1", "agent-1") }, admin }
}

describe("AgentToolLinesService.lines", () => {
    it("proves the role on the rights board and lists the declared tools of the agent's module, its accounts and its rows only", async () => {
        const { handler, admin } = await build()

        const tools = await handler.execute()

        expect(admin.providerBoard).toHaveBeenCalledWith({ principalId: "user-1", workspaceId: "ws-1" })
        expect(tools.filter((tool) => tool.origin === "declared").map((tool) => tool.id)).toEqual([
            "nivo.tool.agent.tag",
            "nivo.tool.customer.message.send",
            "nivo.tool.team.message.post",
            "nivo.tool.brain.change.propose",
        ])
        // The truth reads are a default every agent holds (the module no longer lists them): shown as default reads, none dropped.
        expect(tools.filter((tool) => tool.origin === "default-read").map((tool) => tool.id)).toEqual(
            expect.arrayContaining([
                "nivo.tool.brain.search",
                "nivo.tool.brain.fact.get",
                "nivo.tool.brain.fact.related",
                "nivo.tool.brain.passage.search",
                "nivo.tool.brain.passage.read",
            ]),
        )
        expect(tools.find((tool) => tool.id === "nivo.tool.customer.message.send")?.accounts).toEqual([
            { connectionId: "oa-1", provider: "zalo_oa", accountLabel: FLOWER_SHOP_ACCOUNT_VI },
        ])
        // `never` is removed: the agent's `auto` row restricts nothing, so the read is ready.
        expect(tools.find((tool) => tool.id === "nivo.tool.brain.search")).toMatchObject({ grant: null, ready: true })
        expect(tools.find((tool) => tool.id === "nivo.tool.agent.tag")).toMatchObject({ grant: null, ready: true })
    })

    it("reads the module of the agent's installation (a copied agent), else the agent's own", async () => {
        const sales = await (await build({ module: "sales" })).handler.execute()
        const own = await (await build({ module: null })).handler.execute()

        expect(sales.some((tool) => tool.id === "nivo.tool.order.get")).toBe(true)
        expect(own.some((tool) => tool.id === "nivo.tool.order.get")).toBe(false)
    })

    it("answers nothing for an agent the workspace does not have", async () => {
        await expect((await build({ agent: false })).handler.execute()).resolves.toEqual([])
    })
})
