/** A field-level problem the back end reported for a request. */
export interface ApiIssue {
    readonly path: string
    readonly code: string
}

/** What the back end said about a refusal: its error code (the key of the message) and the text in the request language. */
export interface ApiFault {
    /** The back end error code from the response body, or the HTTP status text when the body carried none. */
    readonly code: string
    /** The back end message in the request language, when the body carried one. */
    readonly message?: string
}

/** The one result vocabulary of the back end api: a status is never collapsed, 401 and 403 are refused. */
export type Outcome<T> =
    | { readonly kind: "ok"; readonly value: T }
    | { readonly kind: "refused"; readonly status: 401 | 403; readonly fault: ApiFault }
    | { readonly kind: "invalid"; readonly issues: ReadonlyArray<ApiIssue>; readonly fault: ApiFault }
    | { readonly kind: "not-found"; readonly fault: ApiFault }
    | { readonly kind: "unavailable"; readonly fault: ApiFault; readonly retryable: boolean }
