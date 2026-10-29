import type { WorkspaceRole } from "./workspace-members.contracts"

/** One seat of a workspace as other capabilities read it: the seat, the account on it, its role and its state. */
export interface MemberSeatRecord {
    /** The seat id (workspace_members.id). */
    readonly memberId: string
    /** The account that holds the seat. */
    readonly userId: string
    /** The workspace role of the seat. */
    readonly role: WorkspaceRole
    /** The name Office shows for the seat. */
    readonly displayName: string
    /** Whether the seat can act now. */
    readonly status: "active" | "disabled"
}

/** The seat of an account in one workspace, or null when the account holds none (or none that is active). */
export type OptionalMemberSeatRecord = MemberSeatRecord | null

/** One active seat of an account: the workspace it sits in and the role it holds there. */
export interface UserSeatRecord {
    /** The workspace the seat belongs to. */
    readonly workspaceId: string
    /** The role the account holds in that workspace. */
    readonly role: WorkspaceRole
}

/** An active account of a workspace with the name its seat shows. */
export interface ActiveUserRecord {
    /** The account id. */
    readonly userId: string
    /** The name Office shows for the account's seat. */
    readonly displayName: string
}
