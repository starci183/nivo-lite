import type { InjectionToken, Type } from "@nestjs/common"
import type { CredentialAuthenticator } from "./credential.contracts"
import type { VerifyAccessToken } from "./identity.contracts"
import type { IdentityAuthOptions } from "./identity-auth.options"

/** The verified identity source used by the default-deny guard, and optionally the sign-in side. */
export interface IdentityOptions {
    /** An optional app-owned verifier; credential doors fail closed when it is absent. */
    readonly credentialAuthenticator?: Type<CredentialAuthenticator>
    /** Cryptographically verifies an access token before it can become a principal. */
    readonly verifyAccessToken?: VerifyAccessToken
    /** The provider token of the access-token client (our passport tokens): when set, the guard verifies our own tokens through it. */
    readonly tokens?: InjectionToken
    /** The sign-in side (sessions, passwords, signup, accounts); absent in an app that only verifies tokens. */
    readonly auth?: IdentityAuthOptions
}
