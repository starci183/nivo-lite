import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** The five people of the story, in the order they are seated; the private input gives their accounts. */
export const OFFICE_PERSON_KEYS = ["nam", "minh", "ha", "van", "lan"] as const

/** A person of the story, by the key the templates use. */
export type OfficePersonKey = (typeof OFFICE_PERSON_KEYS)[number]

/** The four agents of the story, in the order they are kept. */
export const OFFICE_AGENT_KEYS = ["sales", "accounting", "care", "marketing"] as const

/** An agent of the story, by the key the templates use. */
export type OfficeAgentKey = (typeof OFFICE_AGENT_KEYS)[number]

/** One person of the office: their seat and the department room they sit in. */
export interface OfficePerson {
    /** The workspace role the seat gets. */
    readonly role: WorkspaceRole
    /** The key of the department room they sit in. */
    readonly room: string
}

/** One agent of the office and everything v0.3.2 says about who answers for it. */
export interface OfficeAgent {
    /** The module (agent type). */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** The @handle, unique in the workspace; the idempotency key. */
    readonly handle: string
    /** The one-line role. */
    readonly role: string
    /** The owner-facing instructions. */
    readonly instructions: string
    /** The department room that is its home. */
    readonly room: string
    /** The person in charge of the agent. */
    readonly owner: OfficePersonKey
    /** The person who takes over when the owner left or is disabled. */
    readonly fallback: OfficePersonKey
    /** The workspace roles that may hand the agent work. */
    readonly assignableRoles: ReadonlyArray<WorkspaceRole>
    /** The department rooms whose members may hand the agent work. */
    readonly assignableRooms: ReadonlyArray<string>
    /** The agents it may pass work to. */
    readonly canTag: ReadonlyArray<OfficeAgentKey>
}

/** The story's workspace: five people, six department rooms, four agents. Configuration only, never business records. */
export interface OfficeProfile {
    /** The key given on the command line. */
    readonly key: string
    /** The workspace name the private seed input must name. */
    readonly workspaceName: string
    /** The people, by key. */
    readonly people: Readonly<Record<OfficePersonKey, OfficePerson>>
    /** The agents, by key. */
    readonly agents: Readonly<Record<OfficeAgentKey, OfficeAgent>>
}

/** The unit an authority rule measures in (v0.3.2: VND, a percentage, or a count). */
export type OfficeRuleUnit = "vnd" | "percent" | "count"

/** The approval policy of a group (v0.3.2: any one, all of them, or one after another). */
export type OfficeApprovalPolicy = "any" | "all" | "sequential"

/** Who may be asked to approve: by role, by department room, or by named person. */
export interface OfficeApproverGroup {
    /** The workspace roles. */
    readonly roles: ReadonlyArray<WorkspaceRole>
    /** The department room keys. */
    readonly rooms: ReadonlyArray<string>
    /** The named people. */
    readonly members: ReadonlyArray<OfficePersonKey>
}

/**
 * One authority rule as the authority capability of v0.3.2 takes it (plan 5.1: `unit`, `bands`, `approver_group`, `approval_policy`,
 * `timeout_minutes`, `agents`). Written against the contract names and applied through the office authority port.
 */
export interface OfficeRuleSeed {
    /** The module the action belongs to. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** What the bands are measured in. */
    readonly unit: OfficeRuleUnit
    /** Up to and including this value the agent acts alone; null means never alone. */
    readonly auto_max: number | null
    /** Above `auto_max` and up to and including this value a person is asked; above it the action is never taken. */
    readonly ask_max: number
    /** Who is asked. */
    readonly approver_group: OfficeApproverGroup
    /** How the group decides. */
    readonly approval_policy: OfficeApprovalPolicy
    /** Minutes before an unanswered request goes to the agent's owner. */
    readonly timeout_minutes: number
    /** The agents the rule applies to. */
    readonly agents: ReadonlyArray<OfficeAgentKey>
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
    /** The note shown with the rule. */
    readonly note: string
}

/** One person's own approval limit for an action (`member_grants`: anh Minh up to 15 percent, chi Ha up to 10). */
export interface OfficeGrantSeed {
    /** The person. */
    readonly member: OfficePersonKey
    /** The action key. */
    readonly action: string
    /** What `limit` is measured in. */
    readonly unit: OfficeRuleUnit
    /** The largest value they may approve alone. */
    readonly limit: number
}

/** The rules and grants of the story, for the authority capability. */
export interface OfficeAuthoritySeed {
    /** The rules. */
    readonly rules: ReadonlyArray<OfficeRuleSeed>
    /** The grants. */
    readonly grants: ReadonlyArray<OfficeGrantSeed>
}

/** An authority rule with every key resolved to the ids of the workspace. */
export interface ResolvedOfficeRule extends Omit<OfficeRuleSeed, "agents" | "approver_group"> {
    /** The agents the rule applies to. */
    readonly agents: ReadonlyArray<string>
    /** Who is asked, the named people as member ids. */
    readonly approver_group: Omit<OfficeApproverGroup, "members"> & { readonly members: ReadonlyArray<string> }
}

/** A grant with the person resolved to their member id. */
export interface ResolvedOfficeGrant extends Omit<OfficeGrantSeed, "member"> {
    /** The member (workspace_members.id). */
    readonly member_id: string
}

/** What the office authority port is handed. */
export interface ResolvedOfficeAuthority {
    /** The rules. */
    readonly rules: ReadonlyArray<ResolvedOfficeRule>
    /** The grants. */
    readonly grants: ReadonlyArray<ResolvedOfficeGrant>
}

/** What `seed-workspace office` is asked to do, as the command line parsed it: every option may be absent. */
export interface OfficeCommand {
    /** The owner email the private input must hold; absent matches no owner. */
    readonly owner?: string
    /** True writes; absent or false = dry run. */
    readonly execute?: boolean
}

/** One account of the private office input. */
export interface OfficeAccountInput {
    /** The sign-in email, lower case. */
    readonly email: string
    /** The display name. */
    readonly name: string
    /** The initial password, needed only for an account that does not exist yet. */
    readonly password?: string
}

/** The accounts of the two people the ensure input does not carry. */
export interface OfficeInput {
    /** Chi Ha's account. */
    readonly ha: OfficeAccountInput
    /** Van's account. */
    readonly van: OfficeAccountInput
}

/** The public receipt of an office run; it never holds credentials. */
export interface OfficeReport {
    /** The receipt protocol. */
    readonly schema: "nivo/workspace-office@1"
    /** The profile key. */
    readonly profile: string
    /** False for a dry run. */
    readonly executed: boolean
    /** The workspace; null in a dry run. */
    readonly workspaceId: string | null
    /** People in the profile (dry run) or seated. */
    readonly people: number
    /** Agents in the profile (dry run) or kept. */
    readonly agents: number
    /** Agents whose owner, fallback, assigners and tag list were written. */
    readonly ownership: number
    /** ready = department rooms ensured; absent = the Hub rooms function is not installed; planned = dry run. */
    readonly rooms: "ready" | "absent" | "planned"
    /** applied = rules and grants written by the authority capability; pending = none is bound yet (it activates when it lands); planned = dry run. */
    readonly authority: "applied" | "pending" | "planned"
}
