import type { RuleUnit } from "@modules/domain/authority-rules"
import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** A concrete person of a workspace, as a request for approval names them. `roomId` is the key of the department room they sit in. */
export interface ApproverRef {
    /** The member id (the seat, not the Auth account). */
    readonly memberId: string
    /** The display name. */
    readonly name: string
    /** The workspace role. */
    readonly role: WorkspaceRole
    /** The key of the department room the member sits in (the first, in room order); null when in none. */
    readonly roomId: string | null
}

/** A member of the workspace with everything an approver group is resolved from. */
export interface DirectoryMember extends ApproverRef {
    /** A disabled member keeps the seat but loses access, so cannot approve. */
    readonly status: "active" | "disabled"
    /** The keys of every department room the member sits in. */
    readonly rooms: ReadonlyArray<string>
}

/** What one member may approve for one action. */
export interface MemberGrant {
    /** The grant id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The member. */
    readonly member_id: string
    /** The action key. */
    readonly action: string
    /** What the limit is counted in: the unit of the rule when the grant was saved. */
    readonly unit: RuleUnit
    /** The largest amount the member may approve (inclusive); null means no limit. */
    readonly max_amount: number | null
    /** When it was saved last, ISO 8601. */
    readonly updated_at: string
}

/** One member's limit for an action. */
export interface MemberGrantChange {
    /** The member. */
    readonly memberId: string
    /** The largest amount the member may approve (inclusive); null means no limit. */
    readonly maxAmount: number | null
}

/** Why a member of an approver group cannot approve this request. */
export type ExclusionReason = "inactive" | "no_grant" | "over_limit"

/** What a request needs of an approver: the unit of its action and the amount, when it has one. */
export interface GrantNeed {
    /** The unit the action is counted in. */
    readonly unit: RuleUnit
    /** The amount of the request in that unit; null when it carries none. */
    readonly amount: number | null
}

/** Whether a member's grants cover a request. */
export type Coverage = { readonly covered: true } | { readonly covered: false; readonly reason: ExclusionReason }
