/** One thing a platform admin viewed or changed. */
export interface AuditEntry {
    /** The admin's Auth user id. */
    readonly actorId: string
    /** The admin's email. */
    readonly actorEmail: string
    /** What happened, for example `view.workspaces` or `workspace.extend`. */
    readonly action: string
    /** The workspace it concerned, when any. */
    readonly workspaceId: string | null
    /** What changed (from and to), when anything did. */
    readonly data: Readonly<Record<string, unknown>>
}

/** One audit row as the health page lists it. */
export interface AuditSummary {
    /** The row id. */
    readonly id: string
    /** The admin's email. */
    readonly actorEmail: string
    /** What happened. */
    readonly action: string
    /** The workspace it concerned, when any. */
    readonly workspaceId: string | null
    /** When it happened, ISO 8601. */
    readonly createdAt: string
}
