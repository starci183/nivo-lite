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
