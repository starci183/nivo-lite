/** What saving a staff row takes. */
export interface SaveStaffRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The staff id when updating; null or absent inserts a row. */
    readonly id: string | null | undefined
    /** The display name. */
    readonly name: string
    /** The role label. */
    readonly role: string
    /** The contact email, or null when there is none. */
    readonly email: string | null | undefined
    /** Whether the person is active; null or absent keeps the stored value on update. */
    readonly active: boolean | null | undefined
}
