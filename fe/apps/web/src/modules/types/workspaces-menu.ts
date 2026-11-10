/** What the workspace row menu shows: every label already translated, and which commands the person may give. */
export interface WorkspaceMenuView {
    /** The accessible name of the trigger button. */
    readonly menuLabel: string
    readonly openLabel: string
    readonly billingLabel: string
    readonly renameLabel: string
    readonly copyLinkLabel: string
    readonly leaveLabel: string
    readonly deleteLabel: string
    /** The note under the delete entry, shown when it is disabled for a non-owner. */
    readonly deleteNote: string
    readonly canRename: boolean
    readonly canInvite: boolean
    readonly canLeave: boolean
    readonly canDelete: boolean
}

/** What the rename dialog shows: words resolved, the typed value and the length error the container computed. */
export interface WorkspaceRenameView {
    /** The current workspace name, used for the field identity. */
    readonly name: string
    readonly title: string
    readonly description: string
    readonly fieldLabel: string
    readonly hint: string
    readonly cancelLabel: string
    readonly saveLabel: string
    readonly value: string
    readonly error: string | undefined
    readonly isPending: boolean
}
