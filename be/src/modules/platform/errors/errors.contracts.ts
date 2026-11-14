import type { ErrorKind, ErrorParams } from "@starci/common"

/** The error base's own types (`@starci/common`, BE-ERROR-1): how a failure travels, its text parameters and what a coded error is built from. */
export type { DomainErrorInit, ErrorKind, ErrorParams } from "@starci/common"

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
