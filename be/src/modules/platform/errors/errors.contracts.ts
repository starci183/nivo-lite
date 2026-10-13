/** How a failure travels: the transport maps each kind to one HTTP status. */
export type ErrorKind =
    "invalid" | "unauthenticated" | "forbidden" | "not-found" | "conflict" | "rate-limited" | "unavailable" | "internal"

/** Values that fill the named placeholders of an error text and travel next to the code; never prose. */
export interface ErrorParams {
    readonly [name: string]: string | number
}

/** What a capability error is built from: its code, optional text parameters and the failure that caused it. */
export interface DomainErrorInit<C extends string> {
    /** The capability code, `<CAPABILITY>_<WHAT>`. */
    readonly code: C
    /** Values for the placeholders of the display text. */
    readonly params?: ErrorParams
    /** The failure that caused this one, kept for the log. */
    readonly cause?: unknown
}

/** One capability's exhaustive code to kind table, as its `<C>_ERROR_KINDS` constant declares it. */
export type ErrorKindTable = Readonly<Record<string, ErrorKind>>

/** Everything a transport needs to answer one failure: the stable code, the kind, the HTTP status and the parameters. */
export interface ErrorDescription {
    /** The stable machine code. */
    readonly code: string
    /** How the failure travels. */
    readonly kind: ErrorKind
    /** The HTTP status of the kind. */
    readonly status: number
    /** Values for the placeholders of the display text. */
    readonly params: ErrorParams
}

/** Where a failure happened: the workspace (or a connection that names it) and a few plain facts, never a request body or header. */
export interface ErrorReportContext {
    /** The workspace the failure belongs to, when the caller knows it. */
    readonly workspaceId?: string | null
    /** A connection whose workspace the failure belongs to (a webhook route), when the workspace itself is unknown. */
    readonly connectionId?: string | null
    /** Further plain facts (route, method, job, attempt). */
    readonly [fact: string]: unknown
}

/** The scope and context a transport describes a failure in, so an unhandled one is recorded where it happened. */
export interface FailureSite {
    /** `graphql`, `http`, `job.<queue>`. */
    readonly scope: string
    /** Where it happened. */
    readonly context?: ErrorReportContext
}
