import type {
    CredentialAuthenticator,
    CredentialPrincipal,
    VerifyAccessToken,
    IdentityErrorCode,
} from "@modules/domain/identity"
import { IdentityModule } from "@modules/domain/identity"
import type { DynamicModule } from "@nestjs/common"
import type { Outcome } from "@modules/platform/primitives"
import type { Principal } from "@modules/platform/cqrs"

/** A credential verifier selected through the module's public configuration. */
class Verifier implements CredentialAuthenticator {
    authenticate(): Promise<CredentialPrincipal> {
        return Promise.resolve({ kind: "api-key", subject: "key-1", workspaceId: "ws-1" })
    }
}

type IdentityCompositionResultShape = {
    modules: Array<DynamicModule>
    verify: jest.Mock<Promise<Outcome<Principal, IdentityErrorCode>>, [token: string]>
}

/** Each composition owns its external session-verification callback. */
export const identityComposition = (configured: boolean): IdentityCompositionResultShape => {
    const verify = jest.fn<ReturnType<VerifyAccessToken>, Parameters<VerifyAccessToken>>()
    const modules = [
        IdentityModule.register({
            verifyAccessToken: verify,
            ...(configured ? { credentialAuthenticator: Verifier } : {}),
        }),
    ]
    return { modules, verify }
}
