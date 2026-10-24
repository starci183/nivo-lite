/** A shared PostgreSQL fixed-window counter; consuming increments even when the request exceeds its limit. */
export interface RateLimitStore {
    /** Atomically counts one request and answers whether it fits in the window's limit. */
    consume(key: string, windowMs: number, limit: number): Promise<boolean>
}
