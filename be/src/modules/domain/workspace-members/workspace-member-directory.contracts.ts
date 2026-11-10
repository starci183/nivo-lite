import type { WorkspaceMember, WorkspaceRole } from "./workspace-members.contracts"

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

/** One seat of a person as the workspaces lobby lists it: the membership and when the person last opened the workspace. */
export interface LobbySeat extends WorkspaceMember {
    /** When the person last opened the workspace, ISO 8601; null until the first open. */
    readonly lastOpenedAt: string | null
    /** When the seat was switched off, ISO 8601; null while it is on or when the deletion of the workspace switched it off. */
    readonly disabledAt: string | null
    /** Who switched the seat off, when the workspace still knows them. */
    readonly disabledBy: SeatDisabler | null
    /** The note left when the seat was switched off. */
    readonly disabledNote: string | null
    /** The deletion of the workspace switched the seat off. */
    readonly disabledByDeletion: boolean
}

/** The member who switched a seat off, as the lobby names them. */
export interface SeatDisabler {
    /** Their name in the workspace. */
    readonly displayName: string
    /** Their role in the workspace. */
    readonly role: WorkspaceRole
}

/** How many active members one workspace has. */
export interface ActiveMemberCount {
    /** The workspace. */
    readonly workspaceId: string
    /** Its active members. */
    readonly count: number
    /** Its active owners. */
    readonly owners: number
}
