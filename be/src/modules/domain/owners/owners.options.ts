/** What the owners capability needs from its app. */
export interface OwnersOptions {
    /** Where the one result line goes (the operator console). */
    readonly print: (line: string) => void
}
