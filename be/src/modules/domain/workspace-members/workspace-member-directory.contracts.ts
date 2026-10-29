import type { WorkspaceRole } from "./workspace-members.contracts"

/** One member of a workspace as a directory, a mention list or a decision names them. */
export interface MemberDirectoryEntry {
    /** The membership id (the seat, not the account). */
    readonly id: string
    /** The name Office shows. */
    readonly displayName: string
    /** The workspace role. */
    readonly role: WorkspaceRole
}

/** A member of the directory, or null when there is none. */
export type OptionalMemberDirectoryEntry = MemberDirectoryEntry | null

/** An account id, or null when there is none. */
export type OptionalAccountId = string | null
