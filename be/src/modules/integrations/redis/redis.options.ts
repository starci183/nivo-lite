/** What the Redis integration needs from its environment. */
export interface RedisOptions {
    /** How long a new connection may take to reach the server, in milliseconds. */
    readonly connectTimeoutMs: number
}
