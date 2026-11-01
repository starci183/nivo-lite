/** A shared PostgreSQL fixed-window counter; consuming increments even when the request exceeds its limit. */
export interface RateLimitStore {
    /** Atomically counts one request and answers whether it fits in the window's limit. */
    consume(key: string, windowMs: number, limit: number): Promise<boolean>

    /** Forgets the window of a key, so the next request starts a fresh count; a key with no window is left alone. */
    clear(key: string): Promise<void>
}
