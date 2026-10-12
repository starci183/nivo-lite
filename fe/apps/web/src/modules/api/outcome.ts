/** A field-level problem the back end reported for a request. */
export interface ApiIssue {
    readonly path: string
    readonly code: string
}

/** The one result vocabulary of the back end api: a status is never collapsed, 401 and 403 are refused. */
export type Outcome<T> =
    | { readonly kind: "ok"; readonly value: T }
    | { readonly kind: "refused"; readonly status: 401 | 403; readonly code: string }
    | { readonly kind: "invalid"; readonly issues: ReadonlyArray<ApiIssue> }
    | { readonly kind: "not-found" }
    | { readonly kind: "unavailable"; readonly code: string; readonly retryable: boolean }
