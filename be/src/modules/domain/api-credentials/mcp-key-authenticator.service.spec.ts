import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ApiKeysService } from "@modules/domain/api-keys"
import { IdentityErrorCode } from "@modules/domain/identity"
import { McpKeyAuthenticatorService } from "./mcp-key-authenticator.service"

const build = async () => {
    const keys = mock<ApiKeysService>()
    const moduleRef = await Test.createTestingModule({
        providers: [McpKeyAuthenticatorService, { provide: ApiKeysService, useValue: keys }],
    }).compile()
    return { authenticator: moduleRef.get(McpKeyAuthenticatorService), keys }
}

describe("McpKeyAuthenticatorService", () => {
    it("admits an MCP key as the key itself (its id), in its workspace", async () => {
        const { authenticator, keys } = await build()
        keys.verifyMcpKey.mockResolvedValue({ keyId: "key-1", workspaceId: "ws-1", holderId: "user-1", agentId: null })

        await expect(
            authenticator.authenticate({ kind: "tool-token", workflow: "mcp-gateway" }, "Bearer nvk_secret"),
        ).resolves.toEqual({ kind: "tool-token", subject: "key-1", workspaceId: "ws-1" })
        expect(keys.verifyMcpKey).toHaveBeenCalledWith("Bearer nvk_secret")
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
        expect(keys.verifyMcpKey).not.toHaveBeenCalled()
    })
})
