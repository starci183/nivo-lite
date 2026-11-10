import { mock } from "@starci/jest-preset"
import type { AgentDirectoryService } from "@modules/domain/agents"
import type { GrantView, McpGatewayAdminService, ProviderBoard } from "@modules/domain/mcp-gateway"
import type { InstallationRecordsService } from "@modules/domain/module-installations"
import type { Logger } from "@modules/platform/logging"
import { GetAgentToolsHandler } from "./get-agent-tools.handler"
import { GetAgentToolsQuery } from "./get-agent-tools.query"

const BOARD: ProviderBoard = {
    providers: [
        {
            provider: "zalo_oa",
            label: { vi: "Zalo OA", en: "Zalo OA" },
            kind: "messaging",
            kindLabel: { vi: "Nhắn tin", en: "Messaging" },
            connected: true,
            abilities: [],
            accounts: [
                { connectionId: "oa-1", provider: "zalo_oa", label: "Tiệm hoa NIVO", connected: true, isDefault: false },
            ],
        },
    ],
    attachments: [
        { agentId: "agent-1", connectionId: "oa-1", provider: "zalo_oa", abilities: { "customer.send": "ask" } },
        { agentId: "agent-2", connectionId: "oa-1", provider: "zalo_oa", abilities: { "customer.send": "auto" } },
    ],
}

const GRANTS: ReadonlyArray<GrantView> = [
    { agentId: "agent-1", agentName: "Lễ tân", tool: "brain.search", mode: "never", limitVnd: null, constraints: [], constraintsJson: "[]" },
    { agentId: "agent-2", agentName: "Sales", tool: "agent.tag", mode: "never", limitVnd: null, constraints: [], constraintsJson: "[]" },
]

const build = (options: { readonly module?: string | null; readonly agent?: boolean } = {}) => {
    const admin = mock<McpGatewayAdminService>({
        providerBoard: jest.fn().mockResolvedValue(BOARD),
        grants: jest.fn().mockResolvedValue(GRANTS),
    })
    const agents = mock<AgentDirectoryService>({
        find: jest.fn().mockResolvedValue(options.agent === false ? null : { id: "agent-1", name: "Lễ tân", module: "chatbot" }),
    })
    const installations = mock<InstallationRecordsService>({
        ofAgent: jest.fn().mockResolvedValue(options.module === null ? null : { moduleKey: options.module ?? "chatbot" }),
    })
    return { handler: new GetAgentToolsHandler(mock<Logger>(), admin, agents, installations), admin }
}

const query = (): GetAgentToolsQuery =>
    new GetAgentToolsQuery({ request: { workspaceId: "ws-1", agentId: "agent-1" }, principal: { id: "user-1" } as never })

describe("GetAgentToolsHandler", () => {
    it("proves the role on the rights board and lists the declared tools of the agent's module, its accounts and its rows only", async () => {
        const { handler, admin } = build()

        const tools = await handler.execute(query())

        expect(admin.providerBoard).toHaveBeenCalledWith({ principalId: "user-1", workspaceId: "ws-1" })
        expect(tools.filter((tool) => tool.origin === "declared").map((tool) => tool.id)).toEqual([
            "agent.tag",
            "customer.message.send",
            "team.message.post",
            "brain.search",
        ])
        expect(tools.find((tool) => tool.id === "customer.message.send")?.accounts).toEqual([
            { connectionId: "oa-1", provider: "zalo_oa", accountLabel: "Tiệm hoa NIVO", ability: "customer.send", mode: "ask" },
        ])
        expect(tools.find((tool) => tool.id === "brain.search")).toMatchObject({ grant: "never", ready: false })
        expect(tools.find((tool) => tool.id === "agent.tag")).toMatchObject({ grant: null, ready: true })
    })

    it("reads the module of the agent's installation (a copied agent), else the agent's own", async () => {
        const sales = await build({ module: "sales" }).handler.execute(query())
        const own = await build({ module: null }).handler.execute(query())

        expect(sales.some((tool) => tool.id === "order.create")).toBe(true)
        expect(own.some((tool) => tool.id === "order.create")).toBe(false)
    })

    it("answers nothing for an agent the workspace does not have", async () => {
        await expect(build({ agent: false }).handler.execute(query())).resolves.toEqual([])
    })
})
