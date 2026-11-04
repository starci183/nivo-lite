/** Whether a right reads or writes. */
export type DataAccess = "read" | "write"

/** `turn`: only records the turn's subject is linked to; `workspace`: any record of the kind. */
export type RightScope = "turn" | "workspace"

/** One right over a data kind: default deny, never a wildcard field. */
export interface DataRight {
    /** The kind of record the right covers. */
    readonly kind: string
    /** Whether the right reads the kind or writes it. */
    readonly access: DataAccess
    /** Which records of the kind the right reaches. */
    readonly scope: RightScope
    /** The fields the right covers, at least one and each named. */
    readonly fields: readonly [string, ...Array<string>]
}

/** What an agent holds: data, seeded per agent type. */
export interface RightsGrant {
    /** The rights the agent holds; any kind, access or field not listed is denied. */
    readonly rights: ReadonlyArray<DataRight>
}

/** A required right a grant does not cover, and what is missing. */
export interface RightGap {
    /** The required right the grant does not cover. */
    readonly right: DataRight
    /** What the grant lacks: the kind, the access, the scope, or the named fields. */
    readonly missing: "kind" | "access" | "scope" | ReadonlyArray<string>
}
