/** One member of the workspace as an approver group can name them. */
export interface ApproverDirectoryEntry {
    /** The member id (the seat, not the Auth account). */
    readonly memberId: string
    /** The display name. */
    readonly name: string
    /** The workspace role. */
    readonly role: string
    /** `active` or `disabled`. */
    readonly status: string
    /** The keys of the department rooms the member sits in. */
    readonly rooms: ReadonlyArray<string>
}
