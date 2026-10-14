/** The operator's already serialized webhook delivery to the running api. */
export interface SimulationWebhookDelivery {
    /** The api address chosen by the operator. */
    readonly url: string
    /** The authentication and JSON content headers to send. */
    readonly headers: Readonly<Record<string, string>>
    /** The exact serialized webhook body. */
    readonly body: string
}

/** The status and unparsed response body returned by a simulated delivery. */
export interface SimulationWebhookReply {
    /** The HTTP status returned by the api, including a refused delivery. */
    readonly status: number
    /** The api's full response text, empty when its response body is empty. */
    readonly text: string
}
