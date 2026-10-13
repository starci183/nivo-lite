/** What the Meta login callback takes: the three query values Meta sends back. */
export interface MetaCallbackRequest {
    /** The signed state Meta echoed. */
    readonly state: string | undefined
    /** The login code. */
    readonly code: string | undefined
    /** The error Meta reported instead of a code. */
    readonly error: string | undefined
}
