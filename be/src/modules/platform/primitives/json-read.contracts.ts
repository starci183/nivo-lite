/** JSON text that parsed: the value, not yet trusted. */
export interface JsonReadOk {
    /** Discriminant of the parsed half. */
    readonly ok: true
    /** The parsed value; narrow it before reading any key. */
    readonly value: unknown
}

/** JSON text that did not parse: the parse error, kept as the cause of whatever the caller decides. */
export interface JsonReadFailed {
    /** Discriminant of the failed half. */
    readonly ok: false
    /** The error `JSON.parse` raised. */
    readonly cause: unknown
}

/** The result of reading untrusted JSON text: returned, never thrown. */
export type JsonRead = JsonReadOk | JsonReadFailed
