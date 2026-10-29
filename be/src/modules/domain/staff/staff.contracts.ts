/** A display name, or null when the staff row is not in the workspace. */
export type OptionalStaffName = string | null

/** What saving a staff row takes. The caller has already proved they may manage the workspace. */
export interface StaffWrite {
    /** The workspace. */
    readonly workspaceId: string
    /** The staff id when updating; null or absent inserts a row. */
    readonly id: string | null | undefined
    /** The display name. */
    readonly name: string
    /** The role label. */
    readonly role: string
    /** The contact email, or null when there is none. */
    readonly email: string | null | undefined
    /** Whether the person is active; null or absent keeps the stored value on update and means active on insert. */
    readonly active: boolean | null | undefined
}

/** The staff choice and assigned person's name shown by a workbench. */
export interface StaffRecord {
    /** The staff id. */
    readonly id: string
    /** The staff member's display name. */
    readonly name: string
}

/** A staff record of one workspace, used by the accounting assignment picker. */
export interface StaffRow {
    /** The staff id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The display name. */
    readonly name: string
    /** The staff role. */
    readonly role: string
    /** The optional contact email. */
    readonly email: string | null
    /** Whether this staff member is active. */
    readonly active: boolean
    /** The creation time, ISO text. */
    readonly created_at: string
}
