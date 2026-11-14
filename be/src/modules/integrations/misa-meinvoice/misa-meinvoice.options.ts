/** Options of the MISA meInvoice integration: tunables only (credentials are per connection, stored sealed). */
export interface MisaMeinvoiceOptions {
    /** How long one call waits, once an operation is built. */
    readonly timeoutMs: number
}
