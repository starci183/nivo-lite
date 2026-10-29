import type { WorkspaceRole } from "./workspace-members.contracts"

/** One member of a workspace as a directory, a mention list or a decision names them. */
export interface DirectoryMember {
    /** The membership id (the seat, not the account). */
    readonly id: string
    /** The name Office shows. */
    readonly displayName: string
    /** The workspace role. */
    readonly role: WorkspaceRole
}
