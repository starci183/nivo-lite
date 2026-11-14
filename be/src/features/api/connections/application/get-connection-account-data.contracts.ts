/** What connectionAccountData takes. */
export interface GetConnectionAccountDataRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection whose stored data is counted. */
    readonly connectionId: string
}

/** What an account keeps of one declared type of its provider data. */
export interface ConnectionAccountDataTypeStats {
    /** The declared type. */
    readonly type: string
    /** The purpose tag the type declares, or null. */
    readonly purpose: string | null
    /** How many rows of the type the account keeps. */
    readonly rows: number
    /** When the newest row of the type happened, or null. */
    readonly newestAt: Date | null
}

/** What connectionAccountData answers: the account's rows per declared type (`AccountDataReadService.statsOf`). */
export interface ConnectionAccountDataStats {
    /** One entry per declared type the account keeps rows of. */
    readonly types: ReadonlyArray<ConnectionAccountDataTypeStats>
}
