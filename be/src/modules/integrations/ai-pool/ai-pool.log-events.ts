/** Log events of the AI pool. Fields name providers, key aliases, models and error classes; never a key or a prompt. */
export enum AiPoolLogEvent {
    /** One attempt failed; the router tries another key, provider or model when the class allows it. */
    AttemptFailed = "ai_pool.attempt.failed",
    /** One attempt was refused with 429; the lane cools down and the next key is tried. */
    RateLimited = "ai_pool.rate_limited",
    /** A call succeeded on another lane than its first, or on a fallback model. */
    FellBack = "ai_pool.fell_back",
    /** A key's or a provider's circuit breaker changed state. */
    BreakerChanged = "ai_pool.breaker.changed",
    /** A key was taken out of the pool (it answered 401/403, or it is empty). */
    KeyDisabled = "ai_pool.key.disabled",
    /** A chat call failed on every lane it could try; the caller falls back. */
    ChatFailed = "ai_pool.chat.failed",
    /** A chat call answered no text. */
    ChatEmpty = "ai_pool.chat.empty",
    /** An embeddings call failed on every lane it could try; the passages are stored without vectors. */
    EmbeddingFailed = "ai_pool.embedding.failed",
    /** The embeddings provider answered vectors of another count or size; the passages are stored without vectors. */
    EmbeddingUnexpected = "ai_pool.embedding.unexpected",
}
