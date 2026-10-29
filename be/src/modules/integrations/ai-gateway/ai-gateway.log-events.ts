/** Log events of the AI gateway custody. Fields name providers, key aliases, models and error classes; never a key or a prompt. */
export enum AiGatewayLogEvent {
    /** One attempt failed; the router tries another key, provider or model when the class allows it. */
    AttemptFailed = "ai_gateway.attempt.failed",
    /** One attempt was refused with 429; the lane cools down and the next key is tried. */
    RateLimited = "ai_gateway.rate_limited",
    /** A call succeeded on another lane than its first, or on a fallback model. */
    FellBack = "ai_gateway.fell_back",
    /** A key or a provider circuit breaker changed state. */
    BreakerChanged = "ai_gateway.breaker.changed",
    /** A key was taken out of the pool (it answered 401/403, or it is empty). */
    KeyDisabled = "ai_gateway.key.disabled",
}
