/** What the leave dialog says about the member who is leaving. */
export interface WorkspaceLeaveView {
    readonly workspaceName: string
    /** The member role, translated. */
    readonly role: string
    /** What the member has in hand, already worded (for example "3 customers, 1 appointment"); null hides the row. */
    readonly workInHand: string | null
    readonly isPending: boolean
}

/** What the last-owner dialog needs: the workspace that cannot be left yet. */
export interface WorkspaceLeaveOwnerView {
    readonly workspaceName: string
}

/** One thing the deletion changes: what it is, and what happens to it, both already translated. */
export interface WorkspaceDeleteImpactRow {
    readonly label: string
    readonly value: string
}

/** What the delete dialog shows: the impact, the restore window and the typed confirmation the container checked. */
export interface WorkspaceDeleteView {
    readonly workspaceName: string
    readonly impact: ReadonlyArray<WorkspaceDeleteImpactRow>
    /** Days the workspace can be restored after deletion; null hides the restore line. */
    readonly restoreDays: number | null
    /** What the person has typed so far. */
    readonly typed: string
    /** The typed value equals the workspace name. */
    readonly canConfirm: boolean
    readonly isPending: boolean
}
