/** What the decision log is narrowed to; a null filter does not narrow. */
export interface DecisionLogFilter {
    /** The deciders to keep (`policy`, `owner`, `staff`). */
    readonly deciders: ReadonlyArray<string> | null
    /** The outcome to keep. */
    readonly outcome: string | null
    /** The module to keep. */
    readonly department: string | null
    /** The most lines. */
    readonly limit: number
}
