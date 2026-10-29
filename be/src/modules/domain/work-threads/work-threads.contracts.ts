/** Where a thread stands: open, waiting for an approval, done, or stopped and sent back to an owner. */
export type ThreadStatus = "open" | "waiting" | "done" | "stopped"

/** A lead id to narrow a thread read to, or absent/null for no narrowing. */
export type WorkThreadLeadFilter = string | null | undefined

/** A thread, or null when the workspace has none by that id. */
export type OptionalWorkThread = WorkThread | null

/** One work thread. */
export interface WorkThread {
    /** The thread id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The title. */
    readonly title: string
    /** The lead the thread is about, or null. */
    readonly leadId: string | null
    /** The order the thread is about, or null. */
    readonly orderId: string | null
    /** Where the thread stands. */
    readonly status: ThreadStatus
    /** The member id of whoever opened it (`workspace_members.id`). */
    readonly createdBy: string
    /** When it opened, ISO 8601. */
    readonly createdAt: string
    /** When it last changed, ISO 8601. */
    readonly updatedAt: string
}

/** One thread as the reads select it. */
export interface WorkThreadRecord {
    /** The thread id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The title. */
    readonly title: string
    /** The lead, or null. */
    readonly lead_id: string | null
    /** The order, or null. */
    readonly order_id: string | null
    /** The status. */
    readonly status: string
    /** The member id of whoever opened it. */
    readonly created_by: string
    /** Creation instant as database text. */
    readonly created_at: string
    /** Last change instant as database text. */
    readonly updated_at: string
}

/** A member opens a thread. */
export interface NewMemberThread {
    /** The workspace. */
    readonly workspaceId: string
    /** The member id of whoever opens it (`workspace_members.id`). */
    readonly memberId: string
    /** The title. */
    readonly title: string
    /** The lead the thread is about, or null. */
    readonly leadId: string | null
    /** The order the thread is about, or null. */
    readonly orderId: string | null
}
