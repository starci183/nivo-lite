import type { CredentialPrincipal } from "@modules/domain/identity"

/** What preview invite takes. */
export interface PreviewInviteRequest {
    /** The token inside the invitation link. */
    readonly token: string
}

/** A preview request bound to the invitation resolved during admission. */
export interface CredentialPreviewInviteRequest extends PreviewInviteRequest {
    /** The stored invitation identity supplied by the credential guard. */
    readonly credentialPrincipal: CredentialPrincipal
}
