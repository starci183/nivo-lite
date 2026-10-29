/** One workspace with its footprint; the footprint is null for a kept workspace, which is never counted. */
export interface WorkspaceFootprintRow {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
    /** The row count of each cascading table (jsonb), or null when the workspace is kept. */
    readonly footprint: unknown
}

/** What deleting one account would do to the data that survives the cleanup. */
export interface UserReferenceRow {
    /** The Auth user id. */
    readonly user_id: string
    /** `{ cascade: { "<table>.<column>": n }, block: { ... } }` (jsonb). */
    readonly refs: unknown
}
