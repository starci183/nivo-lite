/** Options of the MISA AMIS integration: tunables only (credentials are per connection, stored sealed). */
export interface MisaAmisOptions {
    /** How long one call waits, once an operation is built. */
    readonly timeoutMs: number
}
