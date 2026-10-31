import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentViewScopeService } from "@modules/domain/agents"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { NativeViewService } from "./native-view.service"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async () => {
    const scopes = mock<AgentViewScopeService>()
    const moduleRef = await Test.createTestingModule({
        providers: [NativeViewService, { provide: AgentViewScopeService, useValue: scopes }],
    }).compile()
    return { view: moduleRef.get(NativeViewService), scopes }
}

describe("NativeViewService", () => {
    it("builds the view from the scope of the caller's agent in the workspace of the call", async () => {
        const { view, scopes } = await build()
        scopes.lensOf.mockResolvedValue({ module: "sales", installationId: "i1" })

        await expect(view.of(WS, { agentId: "a1", conversationId: null })).resolves.toEqual({
            workspaceId: WS,
            module: "sales",
            audience: "internal",
            installationId: "i1",
            searchable: true,
        })
        expect(scopes.lensOf).toHaveBeenCalledWith(WS, "a1")
    })

    it("narrows the view to the customer when the call serves a conversation", async () => {
        const { view, scopes } = await build()
        scopes.lensOf.mockResolvedValue({ module: "sales", installationId: null })

        await expect(view.of(WS, { agentId: "a1", conversationId: "c1" })).resolves.toMatchObject({
            audience: "customer",
        })
    })

    it("refuses an agent the workspace does not hold as not found", async () => {
        const { view, scopes } = await build()
        scopes.lensOf.mockResolvedValue(null)

        await expect(view.of(WS, { agentId: "gone", conversationId: null })).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_found" },
        })
    })
})

describe("NativeViewService internalOf", () => {
    it("gives an internal agent outside any conversation its view", async () => {
        const { view, scopes } = await build()
        scopes.lensOf.mockResolvedValue({ module: "sales", installationId: null })

        await expect(view.internalOf(WS, { agentId: "a1", conversationId: null })).resolves.toMatchObject({
            audience: "internal",
        })
    })

    it("refuses a conversation before reading the agent", async () => {
        const { view, scopes } = await build()

        await expect(view.internalOf(WS, { agentId: "a1", conversationId: "c1" })).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "internal_only" },
        })
        expect(scopes.lensOf).not.toHaveBeenCalled()
    })

    it("refuses an agent whose view is the customer's, and one the workspace does not hold", async () => {
        const { view, scopes } = await build()
        scopes.lensOf.mockResolvedValueOnce({ module: "chatbot", installationId: null })
        scopes.lensOf.mockResolvedValueOnce(null)

        await expect(view.internalOf(WS, { agentId: "a1", conversationId: null })).rejects.toMatchObject({
            params: { reason: "internal_only" },
        })
        await expect(view.internalOf(WS, { agentId: "a1", conversationId: null })).rejects.toMatchObject({
            params: { reason: "not_found" },
        })
    })
})
