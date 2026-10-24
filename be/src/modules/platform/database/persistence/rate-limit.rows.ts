/** The shared counter's admission result, computed in PostgreSQL without converting its bigint count. */
export interface RateLimitRow {
    /** Whether the counted request fits in its tier's fixed-window limit. */
    readonly allowed: boolean
}
