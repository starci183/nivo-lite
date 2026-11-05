import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** The unit an office authority rule or grant measures in: VND, a percentage, or a count. */
export type OfficeAuthorityUnit = "vnd" | "percent" | "count"

/** Who may be asked to approve: by workspace role, by department room key, or by member id. */
export interface ResolvedApproverGroup {
    /** The workspace roles. */
    readonly roles: ReadonlyArray<WorkspaceRole>
    /** The department room keys. */
    readonly rooms: ReadonlyArray<string>
    /** The members (workspace_members.id). */
    readonly members: ReadonlyArray<string>
}

/** An authority rule of an office seed with every key resolved to the ids of the workspace. */
export interface ResolvedOfficeRule {
    /** The module the action belongs to. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** What the bands are measured in. */
    readonly unit: OfficeAuthorityUnit
    /** Up to and including this value the agent acts alone; null means never alone. */
    readonly auto_max: number | null
    /** Above `auto_max` and up to and including this value a person is asked; above it the action is never taken. */
    readonly ask_max: number
    /** Who is asked. */
    readonly approver_group: ResolvedApproverGroup
    /** How the group decides: any one, all of them, or one after another. */
    readonly approval_policy: "any" | "all" | "sequential"
    /** Minutes before an unanswered request goes to the agent's owner. */
    readonly timeout_minutes: number
    /** The agents the rule applies to. */
    readonly agents: ReadonlyArray<string>
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
    /** The note shown with the rule. */
    readonly note: string
}

/** One member's own approval limit for an action, the member resolved to their id. */
export interface ResolvedOfficeGrant {
    /** The member (workspace_members.id). */
    readonly member_id: string
    /** The action key. */
    readonly action: string
    /** What `limit` is measured in. */
    readonly unit: OfficeAuthorityUnit
    /** The largest value they may approve alone. */
    readonly limit: number
}

/** What the office authority port is handed. */
export interface ResolvedOfficeAuthority {
    /** The rules. */
    readonly rules: ReadonlyArray<ResolvedOfficeRule>
    /** The grants. */
    readonly grants: ReadonlyArray<ResolvedOfficeGrant>
}
