/** Which public fact of a connection names the stream the connection reads (the account at the provider). */
export interface AccountStreamIdentity {
    /** The `connections.public_meta` keys whose values name the stream; two accounts with an equal value read the same stream. */
    readonly metaKeys: ReadonlyArray<string>
}

/** The stream identity of one provider's connections. */
export interface AccountStream {
    /** The provider, as `connections.provider` names it. */
    readonly provider: string
    /** The public facts that name its stream. */
    readonly streamIdentity: AccountStreamIdentity
}

/** A provider that declares no stream identity, and why. */
export interface AccountStreamExemption {
    /** The provider. */
    readonly provider: string
    /** Why no public fact names its stream. */
    readonly reason: string
}
