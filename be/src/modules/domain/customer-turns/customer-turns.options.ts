/** The public api origin as the connections options parsed it (PUBLIC_API_URL), or undefined when it is not set. */
export type PublicApiUrl = string | undefined

/** What the customer-turns capability needs from the app root. */
export interface CustomerTurnsOptions {
    /** Where the agents call NIVO's tools during a turn (the public api origin plus the tool door path), https or loopback http. */
    readonly toolsBaseUrl: string
}
