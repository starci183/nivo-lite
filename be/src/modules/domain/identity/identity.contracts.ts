import type { CredentialPrincipal } from "./credential.contracts"
import type { Principal } from "@modules/platform/cqrs"
import type { Outcome } from "@modules/platform/primitives"
import type { IdentityErrorCode } from "./errors/identity.error"

declare module "express-serve-static-core" {
    /** The request carries the principal established by the default-deny auth guard. */
    interface Request {
        /** The authenticated caller, when the door is not public. */
        principal?: Principal | undefined
        /** The alternate credential, never a session principal. */
        credentialPrincipal?: CredentialPrincipal | undefined
    }
}

/** Why a door is open to anonymous callers; the vocabulary is closed. */
export enum PublicReason {
    /** Liveness and readiness probes. */
    Health = "health",
    /** OAuth and other authentication handshakes. */
    AuthHandshake = "auth-handshake",
    /** A webhook whose signature is verified before its domain intake runs. */
    SignedWebhook = "signed-webhook",
    /** A published catalog page (booking page, loyalty check) read without a session; always rate limited. */
    CatalogRead = "catalog-read",
}

/** The metadata `@Public` attaches to a door. */
export interface PublicMetadata {
    /** Why the door is anonymous. */
    readonly reason: PublicReason
}

/** What identity admission returns to the guard. */
export type IdentityAdmission = Principal | PublicReason

/** Verifies one bearer token and returns the principal only when every cryptographic and semantic check passed. */
export type VerifyAccessToken = (token: string) => Promise<Outcome<Principal, IdentityErrorCode>>
