import type { CredentialPrincipal } from "@modules/domain/identity"

/** A link request paired with the principal established by credential admission. */
export type HiringLinkRequest<Request> = Request & {
    /** The stored link identity, supplied by the transport after authentication. */
    readonly credentialPrincipal: CredentialPrincipal
}
