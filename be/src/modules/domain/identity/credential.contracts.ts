/** Credential material read from GraphQL arguments before the validation pipe runs. */
export interface CredentialInput {
    /** The opaque proof carried by a link. */
    readonly token?: string
    /** The workspace slug of an anonymous posting submission. */
    readonly ws?: unknown
    /** The job slug of an anonymous posting submission. */
    readonly job?: unknown
}

/** The GraphQL argument envelope shared by credential doors. */
export interface CredentialArgumentsInput {
    /** The operation's input, if it was supplied. */
    readonly input?: CredentialInput
}

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
