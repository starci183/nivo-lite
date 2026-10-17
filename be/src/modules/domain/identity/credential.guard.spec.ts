import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { OperationRequest } from "@modules/platform/http-security"
import type { CredentialAuthenticator, CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { CredentialGuard } from "./credential.guard"
import { DomainError } from "@modules/platform/errors"
import { IdentityErrorCode } from "./errors/identity.error"
import { CREDENTIAL_AUTHENTICATOR, CREDENTIAL_KEY } from "./identity.decorators"

class Door {}
class CredentialRefusal extends DomainError<string> {}
const handler = (): void => undefined
const principal: CredentialPrincipal = { kind: "api-key", subject: "key-1", workspaceId: "ws-1" }

const build = async (metadata: CredentialMetadata | undefined, authorization?: string, id?: string) => {
    const reflector = mock<Reflector>()
    reflector.getAllAndOverride.mockReturnValue(metadata)
    const authenticator = mock<CredentialAuthenticator>()
    authenticator.authenticate.mockResolvedValue(principal)
    const request = mock<OperationRequest>({
        principal: undefined,
        headers: authorization === undefined ? {} : { authorization },
        params: id === undefined ? {} : { id },
    })
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(Door)
    context.switchToHttp.mockReturnValue(http)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CredentialGuard,
            { provide: Reflector, useValue: reflector },
            { provide: CREDENTIAL_AUTHENTICATOR, useValue: authenticator },
        ],
    }).compile()
    return { guard: moduleRef.get(CredentialGuard), context, reflector, authenticator, request }
}

describe("CredentialGuard", () => {
    it("passes an unmarked door without touching the request", async () => {
        const { guard, context, authenticator, request } = await build(undefined)
        request.credentialPrincipal = principal

        await expect(guard.canActivate(context)).resolves.toBe(true)
        expect(request.credentialPrincipal).toBe(principal)
        expect(context.switchToHttp).not.toHaveBeenCalled()
        expect(authenticator.authenticate).not.toHaveBeenCalled()
    })

    it("establishes a credential identity separately from a session principal", async () => {
        const { guard, context, reflector, authenticator, request } = await build(
            { kind: "api-key" },
            "Bearer key",
            "resource-1",
        )

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(CREDENTIAL_KEY, [handler, Door])
        expect(authenticator.authenticate).toHaveBeenCalledWith({ kind: "api-key" }, "Bearer key", "resource-1")
        expect(request.credentialPrincipal).toEqual(principal)
        expect(request.principal).toBeUndefined()
    })

    it("refuses a missing credential through the owning verifier", async () => {
        const { guard, context, authenticator, request } = await build({ kind: "api-key" })
        request.params = undefined
        const refusal = new Error("missing credential")
        authenticator.authenticate.mockRejectedValue(refusal)

        await expect(guard.canActivate(context)).rejects.toBe(refusal)
        expect(authenticator.authenticate).toHaveBeenCalledWith({ kind: "api-key" }, "", undefined)
    })

    it.each([{ input: { token: "secret-link" } }, { input: {} }, {}])(
        "hands the GraphQL link token to its authenticator (%p)",
        async (args) => {
            const { guard, context, authenticator, request } = await build({ kind: "link-token" }, "Bearer session")
            context.getType.mockReturnValue("graphql")
            context.getArgs.mockReturnValue([undefined, args, { req: request }, undefined])
            authenticator.authenticate.mockResolvedValue({ ...principal, kind: "link-token" })

            await expect(guard.canActivate(context)).resolves.toBe(true)
            expect(authenticator.authenticate).toHaveBeenCalledWith(
                { kind: "link-token" },
                args.input?.token ?? "",
                undefined,
            )
            expect(request.credentialPrincipal).toEqual({ ...principal, kind: "link-token" })
        },
    )

    it.each<CredentialPrincipal>([
        { ...principal, kind: "tool-token" },
        { ...principal, subject: "" },
        { ...principal, workspaceId: "" },
    ])("refuses an incomplete or foreign credential identity (%p)", async (answer) => {
        const { guard, context, authenticator, request } = await build({ kind: "api-key" })
        authenticator.authenticate.mockResolvedValue(answer)

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })
        expect(request.credentialPrincipal).toBeUndefined()
    })

    it("propagates a verifier refusal and clears any earlier credential identity", async () => {
        const { guard, context, authenticator, request } = await build({ kind: "api-key" })
        request.credentialPrincipal = principal
        const refusal = new Error("revoked credential")
        authenticator.authenticate.mockRejectedValue(refusal)

        await expect(guard.canActivate(context)).rejects.toBe(refusal)
        expect(request.credentialPrincipal).toBeUndefined()
    })
})

describe("CredentialGuard posting admission", () => {
    it.each([{ input: { ws: "shop", job: "cashier" } }, { input: { ws: 1, job: 2 } }, {}])(
        "extracts the posting resource before validation (%p)",
        async (args) => {
            const metadata: CredentialMetadata = { kind: "posting", workflow: "apply-to-hiring-job" }
            const { guard, context, authenticator, request } = await build(metadata, "Bearer session")
            context.getType.mockReturnValue("graphql")
            context.getArgs.mockReturnValue([undefined, args, { req: request }, undefined])
            const answer: CredentialPrincipal = { kind: "posting", subject: "job-1", workspaceId: "ws-1" }
            authenticator.authenticate.mockResolvedValue(answer)
            await expect(guard.canActivate(context)).resolves.toBe(true)
            expect(authenticator.authenticate).toHaveBeenCalledWith(
                metadata,
                typeof args.input?.ws === "string" ? args.input.ws : "",
                typeof args.input?.job === "string" ? args.input.job : "",
            )
            expect(request.credentialPrincipal).toEqual(answer)
        },
    )

    it.each<CredentialPrincipal>([
        principal,
        { kind: "posting", subject: "", workspaceId: "ws-1" },
        { kind: "posting", subject: "job-1", workspaceId: "" },
    ])("refuses incomplete posting identities (%p)", async (answer) => {
        const { guard, context, authenticator, request } = await build({ kind: "posting" })
        context.getType.mockReturnValue("graphql")
        context.getArgs.mockReturnValue([undefined, {}, { req: request }, undefined])
        authenticator.authenticate.mockResolvedValue(answer)
        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })
        expect(request.credentialPrincipal).toBeUndefined()
    })

    it("propagates posting refusal codes and never establishes a principal", async () => {
        const { guard, context, authenticator, request } = await build({ kind: "posting" })
        context.getType.mockReturnValue("graphql")
        context.getArgs.mockReturnValue([undefined, {}, { req: request }, undefined])
        const refusal = new CredentialRefusal({ code: "HIRING_JOB_NOT_OPEN" })
        authenticator.authenticate.mockRejectedValue(refusal)
        await expect(guard.canActivate(context)).rejects.toBe(refusal)
        expect(request.credentialPrincipal).toBeUndefined()
    })
})

describe("CredentialGuard credential owners", () => {
    const kinds: Array<CredentialMetadata["kind"]> = ["api-key", "run-token", "tool-token", "link-token", "posting"]

    it.each(kinds)("stamps a valid %s identity", async (kind) => {
        const { guard, context, request, authenticator } = await build({ kind }, "Bearer raw")
        context.getType.mockReturnValue("http")
        context.getArgs.mockReturnValue([undefined, { input: { token: "raw", ws: "shop", job: "job" } }])
        const answer: CredentialPrincipal = { kind, subject: "stored-id", workspaceId: "stored-ws" }
        authenticator.authenticate.mockResolvedValue(answer)
        await expect(guard.canActivate(context)).resolves.toBe(true)
        expect(request.credentialPrincipal).toBe(answer)
    })

    it.each(kinds)("preserves the exact invalid and missing %s refusals", async (kind) => {
        for (const authorization of ["invalid", undefined]) {
            const { guard, context, request, authenticator } = await build({ kind }, authorization)
            context.getArgs.mockReturnValue([undefined, { input: { token: authorization, ws: authorization } }])
            const refusal = new CredentialRefusal({ code: "HIRING_PUBLIC_NOT_FOUND" })
            request.credentialPrincipal = principal
            authenticator.authenticate.mockRejectedValue(refusal)
            await expect(guard.canActivate(context)).rejects.toBe(refusal)
            expect(request.credentialPrincipal).toBeUndefined()
            expect(authenticator.authenticate).toHaveBeenCalledWith(
                { kind },
                authorization ?? "",
                kind === "posting" ? "" : undefined,
            )
        }
    })
})

describe("CredentialGuard domain refusals", () => {
    it.each(["HIRING_PUBLIC_NOT_FOUND", "HIRING_JOB_NOT_OPEN", "HIRING_JOB_EXPIRED", "WORKSPACE_INVITES_INVALID"])(
        "preserves %s with its parameters and original cause",
        async (code) => {
            const { guard, context, authenticator } = await build({ kind: "api-key" })
            const cause = new Error("original")
            const refusal = new CredentialRefusal({ code, params: { detail: "retained" }, cause })
            authenticator.authenticate.mockRejectedValue(refusal)
            await expect(guard.canActivate(context)).rejects.toBe(refusal)
            expect(refusal.cause).toBe(cause)
            expect(refusal.params).toEqual({ detail: "retained" })
        },
    )
})
