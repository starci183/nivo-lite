import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { IdentityModule } from "@modules/domain/identity"
import type { CredentialAuthenticator, CredentialPrincipal } from "@modules/domain/identity"

/** A credential verifier selected through the module's public configuration. */
class Verifier implements CredentialAuthenticator {
    authenticate(): Promise<CredentialPrincipal> {
        return Promise.resolve({ kind: "api-key", subject: "key-1", workspaceId: "ws-1" })
    }
}

/** Each composition owns its external session-verification callback. */
export const identityComposition = (configured: boolean) => {
    const verify = jest.fn<ReturnType<VerifySupabaseAccessToken>, Parameters<VerifySupabaseAccessToken>>()
    const modules = [
        IdentityModule.register({
            verifyAccessToken: verify,
            ...(configured ? { credentialAuthenticator: Verifier } : {}),
        }),
    ]
    return { modules, verify }
}
