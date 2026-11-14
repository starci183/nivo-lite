/** One webhook call of an inbound case as it leaves: the path of the provider's route on NIVO, the body, the headers incl. the sandbox key. */
export interface SandboxWebhookPost {
    readonly path: string
    readonly body: unknown
    readonly headers: Readonly<Record<string, string>>
}

/** What NIVO's own route answered one call: its HTTP status and body (an error body names the refusal). */
export interface SandboxWebhookReply {
    readonly status: number
    readonly body: unknown
}

/**
 * How an inbound case reaches the provider's OWN webhook route on NIVO (R58/R62): over HTTP to this api's listener, so the call runs the
 * route's whole road (raw body, rate limit, the sandbox-key guard, the controller, intake, translate, deliver) exactly as the provider's.
 */
export interface SandboxWebhookPoster {
    post(call: SandboxWebhookPost): Promise<SandboxWebhookReply>
}
