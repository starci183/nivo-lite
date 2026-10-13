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
