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
    /**
     * What may be logged of a refused delivery besides the provider and scope (for example the event name), read without trusting the
     * body. Short plain values only: never the body, a secret, a signature or a token.
     */
    facts?(request: WebhookProofRequest): Readonly<Record<string, string>>
}

/** Where a domain module registers the proof of a provider whose secrets live in the database. */
export interface WebhookProofRegistry {
    /** Registers a proof; a second proof for the same provider is refused. */
    add(proof: WebhookProof): void
    /** Refuses unless the provider's registered proof accepts the delivery; an unregistered provider is unknown. */
    verify(provider: string, request: WebhookProofRequest): Promise<void>
}
