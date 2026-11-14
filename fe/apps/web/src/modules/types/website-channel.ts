/** The website channel as the Connections page shows it: the switches, the agent that takes the customers and the address of the hosted form. */
export interface WebsiteChannelView {
    /** The intake is on: the hosted form takes customers. */
    readonly isEnabled: boolean
    /** The site shows the chat button. */
    readonly chatOn: boolean
    /** The site shows the order form. */
    readonly formOn: boolean
    /** The site shows the price list. */
    readonly pricesOn: boolean
    /** The agent that takes the customers; null leaves it to the default agent. */
    readonly agentId: string | null
    /** The address of the hosted form: the link, and the source of the embed. */
    readonly formUrl: string
    /** The iframe that shows the hosted form inside the shop's own page. */
    readonly snippet: string
}

/** One agent the website's customers may be given to. */
export interface WebsiteChannelAgentView {
    readonly id: string
    readonly label: string
}

/** What one change of the website channel sends; a missing field keeps its value. */
export interface WebsiteChannelChange {
    readonly isEnabled?: boolean
    readonly chatEnabled?: boolean
    readonly formEnabled?: boolean
    readonly pricesEnabled?: boolean
    /** The agent that takes the customers; null leaves it to the default agent. */
    readonly agentId?: string | null
}
