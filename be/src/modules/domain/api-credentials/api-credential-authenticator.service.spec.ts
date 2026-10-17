import type { CredentialMetadata, CredentialPrincipal } from "@modules/domain/identity"
import { IdentityError, IdentityErrorCode } from "@modules/domain/identity"
import { HiringOffersService, HiringInterviewsService, HiringPostingService } from "@modules/domain/hiring"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentToolsService } from "@modules/domain/agent-tools"
import { ApiKeysService } from "@modules/domain/api-keys"
import { N8nRunsService } from "@modules/domain/n8n-runs"
import { ApiCredentialAuthenticatorService } from "./api-credential-authenticator.service"

const run = { runId: "run-1", workspaceId: "ws-1", templateKey: "daily", config: {} }

const build = async () => {
    const posting = mock<HiringPostingService>()
    const offers = mock<HiringOffersService>()
    const interviews = mock<HiringInterviewsService>()
    const invites = mock<WorkspaceInvitesService>()
    const keys = mock<ApiKeysService>()
    const tools = mock<AgentToolsService>()
    const runs = mock<N8nRunsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApiCredentialAuthenticatorService,
            { provide: HiringPostingService, useValue: posting },
            { provide: HiringOffersService, useValue: offers },
            { provide: HiringInterviewsService, useValue: interviews },
            { provide: WorkspaceInvitesService, useValue: invites },
            { provide: ApiKeysService, useValue: keys },
            { provide: AgentToolsService, useValue: tools },
            { provide: N8nRunsService, useValue: runs },
        ],
    }).compile()
    return {
        authenticator: moduleRef.get(ApiCredentialAuthenticatorService),
        posting,
        keys,
        tools,
        runs,
        offers,
        interviews,
        invites,
    }
}

describe("ApiCredentialAuthenticatorService", () => {
    it("proves an API key without consuming a rate hit or borrowing a user identity", async () => {
        const { authenticator, keys } = await build()
        keys.verifyCredential.mockResolvedValue({ keyId: "key-1", workspaceId: "ws-1", name: "Till", scopes: [] })

        await expect(authenticator.authenticate({ kind: "api-key" }, "Bearer key", undefined)).resolves.toEqual({
            kind: "api-key",
            subject: "key-1",
            workspaceId: "ws-1",
        })
        expect(keys.verifyCredential).toHaveBeenCalledWith("Bearer key")
        expect(keys.authenticate).not.toHaveBeenCalled()
    })

    it("proves a tool token without executing its tool", async () => {
        const { authenticator, tools } = await build()
        tools.authenticateBearer.mockReturnValue({ jobId: "job-1", workspaceId: "ws-1", conversationId: "chat-1" })

        await expect(authenticator.authenticate({ kind: "tool-token" }, "Bearer tool", undefined)).resolves.toEqual({
            kind: "tool-token",
            subject: "job-1",
            workspaceId: "ws-1",
        })
        expect(tools.authenticateBearer).toHaveBeenCalledWith("Bearer tool")
        expect(tools.runBearerTool).not.toHaveBeenCalled()
    })

    it("binds a completion credential to the requested run", async () => {
        const { authenticator, runs } = await build()
        runs.verifyRun.mockResolvedValue(run)
        runs.requireRun.mockReturnValue(run)

        await expect(authenticator.authenticate({ kind: "run-token" }, "Bearer run", "run-1")).resolves.toEqual({
            kind: "run-token",
            subject: "run-1",
            workspaceId: "ws-1",
        })
        expect(runs.verifyRun).toHaveBeenCalledWith({ authorization: "Bearer run", expectedRunId: "run-1" })
        expect(runs.requireRun).toHaveBeenCalledWith(run)
    })

    it("retains the workflow-specific refusal path for a data door", async () => {
        const { authenticator, runs } = await build()
        runs.verifyRun.mockResolvedValue(run)
        runs.requireWorkflow.mockReturnValue(run)

        await expect(
            authenticator.authenticate({ kind: "run-token", workflow: "daily" }, "Bearer run", undefined),
        ).resolves.toEqual({ kind: "run-token", subject: "run-1", workspaceId: "ws-1" })
        expect(runs.requireWorkflow).toHaveBeenCalledWith(run, "daily")
        expect(runs.requireRun).not.toHaveBeenCalled()
    })

    it("propagates credential failures", async () => {
        const { authenticator, keys } = await build()
        const refusal = new Error("revoked")
        keys.verifyCredential.mockRejectedValue(refusal)

        await expect(authenticator.authenticate({ kind: "api-key" }, "Bearer key", undefined)).rejects.toBe(refusal)
    })
})

describe("link credentials", () => {
    it.each([
        "public-hiring-offer",
        "respond-hiring-offer",
        "public-hiring-interview",
        "respond-hiring-interview",
        "preview-invite",
    ])("delegates %s to its domain owner", async (workflow) => {
        const { authenticator, offers, interviews, invites } = await build()
        const owner = workflow.includes("offer") ? offers : workflow.includes("interview") ? interviews : invites
        const principal: CredentialPrincipal = {
            kind: "link-token",
            subject: "stored-record",
            workspaceId: "stored-workspace",
        }
        owner.authenticateLink.mockResolvedValue(principal)
        await expect(authenticator.authenticate({ kind: "link-token", workflow }, "opaque-token")).resolves.toEqual(
            principal,
        )
        expect(owner.authenticateLink).toHaveBeenCalledWith("opaque-token")
    })

    it.each([undefined, "other"])("refuses an unknown link purpose %s", async (workflow) => {
        const { authenticator } = await build()
        await expect(authenticator.authenticate({ kind: "link-token", workflow }, "token")).rejects.toThrow()
    })

    it("propagates the domain refusal without trying another credential", async () => {
        const { authenticator, offers, keys, runs } = await build()
        const refusal = new Error("link missing")
        offers.authenticateLink.mockRejectedValue(refusal)
        await expect(
            authenticator.authenticate({ kind: "link-token", workflow: "public-hiring-offer" }, "bad"),
        ).rejects.toBe(refusal)
        expect(keys.verifyCredential).not.toHaveBeenCalled()
        expect(runs.verifyRun).not.toHaveBeenCalled()
    })
})

describe("posting credentials", () => {
    it.each(["apply-to-hiring-job", "create-hiring-cv-upload"])("checks the posting for %s", async (workflow) => {
        const { authenticator, posting } = await build()
        const principal: CredentialPrincipal = { kind: "posting", subject: "job-1", workspaceId: "ws-1" }
        posting.requireOpen.mockResolvedValue(principal)
        await expect(authenticator.authenticate({ kind: "posting", workflow }, "shop", "cashier")).resolves.toEqual(
            principal,
        )
        expect(posting.requireOpen).toHaveBeenCalledWith({ ws: "shop", job: "cashier" })
    })

    it.each([undefined, "public-hiring-offer"])("refuses a mismatched posting capability %s", async (workflow) => {
        const { authenticator, posting } = await build()
        await expect(authenticator.authenticate({ kind: "posting", workflow }, "shop", "cashier")).rejects.toThrow()
        expect(posting.requireOpen).not.toHaveBeenCalled()
    })

    it("retains the posting refusal", async () => {
        const { authenticator, posting } = await build()
        const refusal = new Error("closed")
        posting.requireOpen.mockRejectedValue(refusal)
        await expect(
            authenticator.authenticate({ kind: "posting", workflow: "apply-to-hiring-job" }, "shop", "cashier"),
        ).rejects.toBe(refusal)
    })
})

describe("credential refusal ownership", () => {
    const doors: Array<CredentialMetadata> = [
        { kind: "api-key" },
        { kind: "run-token" },
        { kind: "tool-token" },
        { kind: "posting", workflow: "apply-to-hiring-job" },
        { kind: "link-token", workflow: "public-hiring-offer" },
        { kind: "link-token", workflow: "respond-hiring-offer" },
        { kind: "link-token", workflow: "public-hiring-interview" },
        { kind: "link-token", workflow: "respond-hiring-interview" },
        { kind: "link-token", workflow: "preview-invite" },
    ]

    it.each(doors)("preserves invalid and missing credential refusals for %p", async (metadata) => {
        for (const raw of ["invalid", ""]) {
            const { authenticator, keys, runs, tools, posting, offers, interviews, invites } = await build()
            const refusal = new IdentityError({ code: IdentityErrorCode.Unauthenticated })
            keys.verifyCredential.mockRejectedValue(refusal)
            runs.verifyRun.mockRejectedValue(refusal)
            tools.authenticateBearer.mockImplementation(() => {
                throw refusal
            })
            posting.requireOpen.mockRejectedValue(refusal)
            offers.authenticateLink.mockRejectedValue(refusal)
            interviews.authenticateLink.mockRejectedValue(refusal)
            invites.authenticateLink.mockRejectedValue(refusal)
            await expect(authenticator.authenticate(metadata, raw)).rejects.toBe(refusal)
        }
    })
})
