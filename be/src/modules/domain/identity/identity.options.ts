import type { Type } from "@nestjs/common"
import type { CredentialAuthenticator } from "./credential.contracts"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"

/** The verified identity source used by the default-deny guard. */
export interface IdentityOptions {
    /** An optional app-owned verifier; credential doors fail closed when it is absent. */
    readonly credentialAuthenticator?: Type<CredentialAuthenticator>
    /** Cryptographically verifies a Supabase access token before it can become a principal. */
    readonly verifyAccessToken: VerifySupabaseAccessToken
}
