import type { CredentialMetadata, CredentialPrincipal } from "@modules/domain/identity"
import { IdentityError, IdentityErrorCode } from "@modules/domain/identity"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ApiKeysService } from "@modules/domain/api-keys"
import { ApiCredentialAuthenticatorService } from "./api-credential-authenticator.service"

const build = async () => {
    const invites = mock<WorkspaceInvitesService>()
    const keys = mock<ApiKeysService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApiCredentialAuthenticatorService,
            { provide: WorkspaceInvitesService, useValue: invites },
            { provide: ApiKeysService, useValue: keys },
        ],
    }).compile()
    return {
        authenticator: moduleRef.get(ApiCredentialAuthenticatorService),
        keys,
        invites,
    }
}

describe("ApiCredentialAuthenticatorService", () => {
    it("proves an API key without consuming a rate hit or borrowing a user identity", async () => {
        const { authenticator, keys } = await build()
        keys.verifyCredential.mockResolvedValue({ keyId: "key-1", workspaceId: "ws-1", name: "Till", scopes: [] })

        await expect(authenticator.authenticate({ kind: "api-key" }, "Bearer key")).resolves.toEqual({
            kind: "api-key",
            subject: "key-1",
            workspaceId: "ws-1",
        })
        expect(keys.verifyCredential).toHaveBeenCalledWith("Bearer key")
        expect(keys.authenticate).not.toHaveBeenCalled()
    })

    it("admits no agent token: an agent reaches the app through the MCP gateway alone", async () => {
        const { authenticator } = await build()

        await expect(authenticator.authenticate({ kind: "tool-token" }, "Bearer tool")).rejects.toMatchObject({
            code: IdentityErrorCode.Unauthenticated,
        })
    })

    it("propagates credential failures", async () => {
        const { authenticator, keys } = await build()
        const refusal = new Error("revoked")
        keys.verifyCredential.mockRejectedValue(refusal)

        await expect(authenticator.authenticate({ kind: "api-key" }, "Bearer key")).rejects.toBe(refusal)
    })
})

describe("link credentials", () => {
    it("delegates preview-invite to the workspace invites", async () => {
        const { authenticator, invites } = await build()
        const principal: CredentialPrincipal = {
            kind: "link-token",
            subject: "stored-record",
            workspaceId: "stored-workspace",
        }
        invites.authenticateLink.mockResolvedValue(principal)
        await expect(
            authenticator.authenticate({ kind: "link-token", workflow: "preview-invite" }, "opaque-token"),
        ).resolves.toEqual(principal)
        expect(invites.authenticateLink).toHaveBeenCalledWith("opaque-token")
    })

    it.each([undefined, "other"])("refuses an unknown link purpose %s", async (workflow) => {
        const { authenticator } = await build()
        await expect(authenticator.authenticate({ kind: "link-token", workflow }, "token")).rejects.toThrow()
    })

    it("propagates the domain refusal without trying another credential", async () => {
        const { authenticator, invites, keys } = await build()
        const refusal = new Error("link missing")
        invites.authenticateLink.mockRejectedValue(refusal)
        await expect(
            authenticator.authenticate({ kind: "link-token", workflow: "preview-invite" }, "bad"),
        ).rejects.toBe(refusal)
        expect(keys.verifyCredential).not.toHaveBeenCalled()
    })
})

describe("credential refusal ownership", () => {
    const doors: Array<CredentialMetadata> = [
        { kind: "api-key" },
        { kind: "tool-token" },
        { kind: "link-token", workflow: "preview-invite" },
    ]

    it.each(doors)("preserves invalid and missing credential refusals for %p", async (metadata) => {
        for (const raw of ["invalid", ""]) {
            const { authenticator, keys, invites } = await build()
            const refusal = new IdentityError({ code: IdentityErrorCode.Unauthenticated })
            keys.verifyCredential.mockRejectedValue(refusal)
            invites.authenticateLink.mockRejectedValue(refusal)
            await expect(authenticator.authenticate(metadata, raw)).rejects.toEqual(refusal)
        }
    })
})
