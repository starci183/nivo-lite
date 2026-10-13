import type { GoogleCallbackResult } from "@modules/domain/google-connections"

/** What the Google consent callback takes: the three query values Google sends back. */
export interface GoogleCallbackRequest {
    /** The signed state Google echoed. */
    readonly state: string | undefined
    /** The consent code. */
    readonly code: string | undefined
    /** The error Google reported instead of a code. */
    readonly error: string | undefined
}

/** What the Google consent callback answers: where to send the browser. */
export type GoogleCallbackOutcome = GoogleCallbackResult
