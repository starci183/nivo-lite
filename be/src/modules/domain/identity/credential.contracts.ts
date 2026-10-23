/** Alternate credentials accepted only by explicitly marked doors. */
export interface CredentialMetadata {
    /** The credential family this door accepts. */
    readonly kind: "api-key" | "run-token" | "tool-token" | "link-token" | "posting"
    /** The workflow or operation this credential must admit. */
    readonly workflow?: string | undefined
}

/** A credential identity is deliberately separate from a signed-in user's principal. */
export interface CredentialPrincipal {
    /** The credential family that established this identity. */
    readonly kind: CredentialMetadata["kind"]
    /** The key, job, run or stored record that the credential identifies. */
    readonly subject: string
    /** The only workspace this credential can act for. */
    readonly workspaceId: string
}

/** The app binds credential verification to the owning capabilities. */
export interface CredentialAuthenticator {
    /** Authenticates the actual credential, throwing the owning domain's refusal on failure. */
    authenticate(metadata: CredentialMetadata, authorization: string, resourceId?: string): Promise<CredentialPrincipal>
}

/** The optional resource binding carried by a run credential door. */
export type CredentialResourceId = string | undefined
