/** Whether a right reads or writes. */
export type DataAccess = "read" | "write"

/** `turn`: only records the turn's subject is linked to; `workspace`: any record of the kind. */
export type RightScope = "turn" | "workspace"

/** One right over a data kind: default deny, never a wildcard field. */
export interface DataRight {
    readonly kind: string
    readonly access: DataAccess
    readonly scope: RightScope
    readonly fields: readonly [string, ...Array<string>]
}

/** What an agent holds: data, seeded per agent type. */
export interface RightsGrant {
    readonly rights: ReadonlyArray<DataRight>
    /** The NIVO MCP tools it may call, by name; none when absent (default deny). */
    readonly tools?: ReadonlyArray<string> | undefined
}

/** A required right a grant does not cover, and what is missing. */
export interface RightGap {
    readonly right: DataRight
    readonly missing: "kind" | "access" | "scope" | ReadonlyArray<string>
}
