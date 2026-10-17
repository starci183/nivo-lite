import type { ExecutionContext } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { AuthGuard, Credential, CredentialGuard } from "@modules/domain/identity"
import type { OperationRequest } from "@modules/platform/http-security"
import type { LiteWorld } from "../../world/lite-world.service"
import { useTestWorld } from "../../world/use-test-world"
import { identityComposition } from "../../world/identity-composition.options"

@Credential({ kind: "api-key" })
class CredentialDoor {}
class SessionDoor {}

const buildComposedGuard = (world: LiteWorld) => {
    const request = mock<OperationRequest>({ headers: {}, principal: undefined })
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(() => undefined)
    context.getClass.mockReturnValue(CredentialDoor)
    context.switchToHttp.mockReturnValue(http)
    const credentialGuard = world.resolve(CredentialGuard)
    const authGuard = world.resolve(AuthGuard)
    /** The app registers CredentialGuard before AuthGuard; the chain stops at the first rejection. */
    const guard = {
        canActivate: async (executionContext: ExecutionContext): Promise<boolean> =>
            (await credentialGuard.canActivate(executionContext)) && authGuard.canActivate(executionContext),
    }
    return { guard, request, context }
}

describe("CredentialGuard unconfigured module composition", () => {
    const composition = identityComposition(false)
    const world = useTestWorld({ modules: composition.modules })
    it("fails closed when the composition supplies no credential verifier", async () => {
        const { guard, context, request } = buildComposedGuard(world)

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: "IDENTITY_UNAUTHENTICATED" })
        expect(request.credentialPrincipal).toBeUndefined()
        expect(composition.verify).not.toHaveBeenCalled()
    })
})

describe("CredentialGuard configured module composition", () => {
    const composition = identityComposition(true)
    const world = useTestWorld({ modules: composition.modules })
    it("admits the selected credential without making it usable at session-only doors", async () => {
        const { guard, context, request } = buildComposedGuard(world)

        await expect(guard.canActivate(context)).resolves.toBe(true)
        expect(request.credentialPrincipal).toEqual({ kind: "api-key", subject: "key-1", workspaceId: "ws-1" })
        expect(request.principal).toBeUndefined()

        context.getClass.mockReturnValue(SessionDoor)

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: "IDENTITY_UNAUTHENTICATED" })
        expect(composition.verify).not.toHaveBeenCalled()
    })
})
