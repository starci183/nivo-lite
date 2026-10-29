import { IdentityModule } from "@modules/domain/identity"
import type { CredentialAuthenticator, CredentialPrincipal, VerifyAccessToken } from "@modules/domain/identity"

/** A credential verifier selected through the module's public configuration. */
class Verifier implements CredentialAuthenticator {
    authenticate(): Promise<CredentialPrincipal> {
        return Promise.resolve({ kind: "api-key", subject: "key-1", workspaceId: "ws-1" })
    }
}

/** Each composition owns its external session-verification callback. */
export const identityComposition = (configured: boolean) => {
    const verify = jest.fn<ReturnType<VerifyAccessToken>, Parameters<VerifyAccessToken>>()
    const modules = [
        IdentityModule.register({
            verifyAccessToken: verify,
            ...(configured ? { credentialAuthenticator: Verifier } : {}),
        }),
    ]
    return { modules, verify }
}
