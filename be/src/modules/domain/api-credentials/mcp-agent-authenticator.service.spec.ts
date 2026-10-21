import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ApiKeysService } from "@modules/domain/api-keys"
import { IdentityErrorCode } from "@modules/domain/identity"
import { McpAgentAuthenticatorService } from "./mcp-agent-authenticator.service"

const build = async () => {
    const keys = mock<ApiKeysService>()
    const moduleRef = await Test.createTestingModule({
        providers: [McpAgentAuthenticatorService, { provide: ApiKeysService, useValue: keys }],
    }).compile()
    return { authenticator: moduleRef.get(McpAgentAuthenticatorService), keys }
}

describe("McpAgentAuthenticatorService", () => {
    it("admits an agent key as the agent it is bound to, in its workspace", async () => {
        const { authenticator, keys } = await build()
        keys.verifyAgentKey.mockResolvedValue({ keyId: "key-1", workspaceId: "ws-1", agentId: "agent-1" })

        await expect(
            authenticator.authenticate({ kind: "tool-token", workflow: "mcp-gateway" }, "Bearer nvk_secret"),
        ).resolves.toEqual({ kind: "tool-token", subject: "agent-1", workspaceId: "ws-1" })
        expect(keys.verifyAgentKey).toHaveBeenCalledWith("Bearer nvk_secret")
    })

    it.each([
        { kind: "api-key" as const },
        { kind: "tool-token" as const, workflow: "other" },
        { kind: "tool-token" as const },
    ])("refuses any other door before reading a key: %p", async (metadata) => {
        const { authenticator, keys } = await build()

        await expect(authenticator.authenticate(metadata, "Bearer nvk_secret")).rejects.toMatchObject({
            code: IdentityErrorCode.Unauthenticated,
        })
        expect(keys.verifyAgentKey).not.toHaveBeenCalled()
    })
})
