/** Whether a right reads or writes. */
export type DataAccess = "read" | "write"

/** `turn`: only records the turn's subject is linked to; `workspace`: any record of the kind. */
export type RightScope = "turn" | "workspace"

/** One right over a data kind: default deny, never a wildcard field. */
export interface DataRight {
    /** The data kind the right is over, in kebab-case. */
    readonly kind: string
    /** Whether the right lets the holder read or write. */
    readonly access: DataAccess
    /** Whether the right reaches only the turn's linked records or any record of the kind. */
    readonly scope: RightScope
    /** The fields the right covers; at least one, never a wildcard. */
    readonly fields: readonly [string, ...Array<string>]
}

/** What an agent holds: data, seeded per agent type. */
export interface RightsGrant {
    /** The data rights the agent holds. */
    readonly rights: ReadonlyArray<DataRight>
    /** The NIVO MCP tools it may call, by name; none when absent (default deny). */
    readonly tools?: ReadonlyArray<string> | undefined
}

/** A required right a grant does not cover, and what is missing. */
export interface RightGap {
    /** The right that was asked for. */
    readonly right: DataRight
    /** What the grant lacks for it: the kind, the access, the scope, or the fields not covered. */
    readonly missing: "kind" | "access" | "scope" | ReadonlyArray<string>
}
