/** Options of the Meta publishing integration: tunables only (the Page token and the ids are per connection). */
export interface MetaPublishingOptions {
    /** The Graph API origin and version, without a trailing slash (`https://graph.facebook.com/v27.0`; a test fake overrides it). */
    readonly graphBase: string
    /** How long one Graph call waits. */
    readonly timeoutMs: number
}
