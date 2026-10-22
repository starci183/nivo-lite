/** Where a thread stands: open, waiting for an approval, done, or stopped and sent back to an owner. */
export type ThreadStatus = "open" | "waiting" | "done" | "stopped"

/** A lead id to narrow a thread read to, or null for no narrowing. */
export type WorkThreadLeadFilter = string | null

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
