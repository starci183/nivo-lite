import type { MemberStatus, WorkspaceRole } from "./workspace-members.contracts"

/** One member as a room lists its seat: the member row, the account, the name and when the member joined (sortable text). */
export interface MemberSeat {
    /** The member row id, the second ordering key. */
    readonly seat_id: string
    /** The account id. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** When the member joined: digits only, fixed width, microsecond exact, so text order is time order. */
    readonly at: string
}

/** The display name of one account of a workspace. */
export interface MemberName {
    /** The account id. */
    readonly userId: string
    /** The name Office shows. */
    readonly displayName: string
}

/** One member of the workspace directory. */
export interface MemberRow {
    /** The member row id (the seat, not the account). */
    readonly id: string
    /** The account id. */
    readonly user_id: string
    /** The display name. */
    readonly display_name: string
    /** The workspace role. */
    readonly role: WorkspaceRole
    /** Whether the member can sign in. */
    readonly status: MemberStatus
}
