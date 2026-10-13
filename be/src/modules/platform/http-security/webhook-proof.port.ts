/** What a registered proof receives: the exact bytes and headers of one delivery, and the scope the route names (a connection id). */
export interface WebhookProofRequest {
    /** The scope the door names, for example the connection the provider was registered with. */
    readonly scope: string
    /** The unparsed request bytes. */
    readonly rawBody: Buffer | undefined
    /** The provider's signature or token header, when supplied. */
    readonly signature: string | undefined
    /** The provider's timestamp header, when it sends one. */
    readonly timestamp: string | undefined
}

/** The proof of one provider whose secret is not one value of the app but belongs to a scope stored in the database. */
export interface WebhookProof {
    /** The provider key the door names in `verify`. */
    readonly provider: string
    /** True only when the delivery proves the secret of its scope; a missing scope or secret is false, never a throw. */
    prove(request: WebhookProofRequest): Promise<boolean>
}

/** Where a domain module registers the proof of a provider whose secrets live in the database. */
export interface WebhookProofRegistry {
    /** Registers a proof; a second proof for the same provider is refused. */
    add(proof: WebhookProof): void
    /** The proof of a provider, or undefined when none was registered. */
    get(provider: string): WebhookProof | undefined
}
