/** A delivery whose secret belongs to a scope kept in the database (one connection of one workspace), proven by the provider's registered proof. */
export interface ScopedWebhookDelivery {
    /** The provider whose registered proof judges this delivery. */
    readonly provider: string
    /** The scope the route names, for example a connection id. */
    readonly scope: string
    /** The unparsed request bytes covered by the signature. */
    readonly rawBody: Buffer | undefined
    /** The provider signature or token header, when supplied. */
    readonly signature: string | undefined
    /** The provider timestamp header, when it sends one. */
    readonly timestamp: string | undefined
}
