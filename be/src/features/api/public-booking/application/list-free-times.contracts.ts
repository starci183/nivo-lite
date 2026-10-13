/** What list-free-times takes. */
export interface ListFreeTimesRequest {
    /** The slug. */
    readonly slug: string
    /** The service. */
    readonly service: string
    /** The date. */
    readonly date: string
    /** The party. */
    readonly party: number
}

/** What list-free-times answers. */
export interface ListFreeTimesResult {
    /** The times. */
    readonly times: ReadonlyArray<string>
}
