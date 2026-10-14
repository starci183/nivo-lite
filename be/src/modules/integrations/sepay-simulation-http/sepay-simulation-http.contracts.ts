/** One simulated SePay delivery to send to the api. */
export interface SepaySimulationDelivery {
    /** The webhook url. */
    readonly url: string
    /** The request headers. */
    readonly headers: Readonly<Record<string, string>>
    /** The serialized JSON body, sent without another serialization. */
    readonly body: string
}

/** What the webhook answered. */
export interface SepaySimulationReply {
    /** The HTTP status. */
    readonly status: number
    /** The response body as text. */
    readonly text: string
}

/** The delivery callback the cli composes into the simulation. */
export type SepaySimulationPost = (delivery: SepaySimulationDelivery) => Promise<SepaySimulationReply>
