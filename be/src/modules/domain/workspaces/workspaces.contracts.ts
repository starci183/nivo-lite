import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** The business type a workspace names at onboarding: a known key the knowledge ideas read (`spa`, `retail`, `cafe`, `technology`...) or the owner's own words; none leaves it unset. */
export type NamedBusinessType = string | null

/** One workspace as a member sees it. */
export interface WorkspaceSummary {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
    /** `active`, `pending_payment` or `cancelled`. */
    readonly status: string
    /** The Auth user who owns it. */
    readonly ownerId: string
    /** When it was created, ISO 8601. */
    readonly createdAt: string
    /** The business type chosen at onboarding. */
    readonly businessType: string | null
}

/** The id and name of a workspace. */
export interface WorkspaceName {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
}

/** A workspace together with the caller's membership in it. */
export interface WorkspaceMembership {
    /** The workspace. */
    readonly workspace: WorkspaceSummary
    /** The caller's membership. */
    readonly member: WorkspaceMember
    /** What the workspaces lobby shows beside it. */
    readonly lobby: WorkspaceLobbyFacts
}

/** What the workspaces lobby shows of one workspace: its plan, its people and when the caller last opened it. */
export interface WorkspaceLobbyFacts {
    /** The plan code, or null before the first payment. */
    readonly planCode: string | null
    /** The paid seats of a per-seat plan, or null when the plan's own seats hold. */
    readonly seatCount: number | null
    /** The active members. */
    readonly memberCount: number
    /** The active owners: one means the only owner cannot leave. */
    readonly ownerCount: number
    /** When the caller last opened the workspace, ISO 8601; null until the first open. */
    readonly lastOpenedAt: string | null
    /** When its owner deleted it, ISO 8601; null while it lives. Only its owners see a deleted workspace. */
    readonly deletedAt: string | null
    /** Until when its owner may restore it, ISO 8601; null while it lives. */
    readonly restoreBefore: string | null
    /** When the caller's seat was switched off by a person, ISO 8601; null while it is on. */
    readonly disabledAt: string | null
    /** The name of who switched the caller's seat off, when known. */
    readonly disabledByName: string | null
    /** The role of who switched the caller's seat off, when known. */
    readonly disabledByRole: string | null
    /** The note left when the caller's seat was switched off. */
    readonly disabledNote: string | null
}

/** How many days the owner of a deleted workspace has to restore it; after that the operator's prune removes it. */
export const RESTORE_DAYS = 30

/** The id of a workspace that was just created. */
export interface CreatedWorkspace {
    /** The new workspace. */
    readonly id: string
}

/** The first workspace of a person: its id, or null when none was created (signup is off, or they already belong somewhere). */
export interface FirstWorkspace {
    /** The new workspace, or null. */
    readonly id: string | null
}

/** The billing statuses support can set by hand. */
export type SupportStatus = "active" | "past_due"

/** The enterprise identifier of a workspace (`nivo-web`); null for an ordinary workspace, known by its uuid alone. */
export type EnterpriseKey = string | null

/** A change of a workspace enterprise identifier: what it was and what it is. */
export interface EnterpriseKeyChange {
    /** The identifier before. */
    readonly from: EnterpriseKey
    /** The identifier now. */
    readonly to: EnterpriseKey
}

/** What the enterprise filter reads of a listed module: its key. */
export interface KeyedModule {
    /** The module key. */
    readonly key: string
}

/** An account id, or null when there is none. */
export type OptionalAccountId = string | null

/** A plan the capability that owns plans proved active, or null when the plan is unknown or retired. */
export type OptionalActivePlan = ActivePlan | null

/** An active plan, as the capability that owns plans proved it. */
export interface ActivePlan {
    /** The plan code. */
    readonly code: string
}

/** A support change to a billing fact: what it was and what it is now. */
export interface BillingChange {
    /** The value before, null when there was none. */
    readonly from: string | null
    /** The value now. */
    readonly to: string
}

/** The workspace every prune keeps unless told not to. */
export const NIVO_WORKSPACE_ID = "403f4a6e-306a-4ad0-9363-d304da760d50"

/** The word the operator types to confirm a deletion. */
export const CONFIRMATION_WORD = "DELETE"

/** What the command line gives a prune, as parsed: every field may be absent. */
export interface PruneRequest {
    /** Workspace ids to keep besides the built-in one. */
    readonly keep?: ReadonlyArray<string>
    /** False (from `--no-default`) drops the built-in workspace from the kept ones, for a database where it does not exist. */
    readonly default?: boolean
    /** True skips the confirmation question. */
    readonly yes?: boolean
}

/** One workspace as the prune lists it. */
export interface WorkspaceBrief {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The plan code. */
    readonly plan_code: string | null
    /** The status. */
    readonly status: string
}

/** How a prune ended. */
export type PruneStatus = "nothing-to-delete" | "cancelled" | "deleted"

/** What a prune answers. */
export interface PruneReport {
    /** The status. */
    readonly status: PruneStatus
    /** The workspaces kept. */
    readonly kept: ReadonlyArray<WorkspaceBrief>
    /** The workspaces that were to be deleted. */
    readonly doomed: ReadonlyArray<WorkspaceBrief>
    /** How many workspaces are left. */
    readonly left: number
}

/** The operator's terminal: the only place a prune talks to a person. */
export interface PruneConsole {
    /** Writes one line. */
    print(line: string): void
    /** Asks a question and answers what was typed. */
    ask(question: string): Promise<string>
}

/** One installed agent, as the console menus draw it. */
export interface ShellAgent {
    /** The agent id. */
    readonly id: string
    /** The agent name. */
    readonly name: string
    /** The module the agent belongs to. */
    readonly module: string
    /** `active` or `paused`. */
    readonly status: "active" | "paused"
}

/** What the console frame needs. */
export interface ShellFacts {
    /** The installed agents. */
    readonly agents: ReadonlyArray<ShellAgent>
    /** Whether the workspace bought a module inside the founding window. */
    readonly isFoundingMember: boolean
}

/** The Founding window the shell evaluates membership against. */
export interface ShellWindow {
    /** Start of the window, ISO 8601. */
    readonly from: string
    /** End of the window, ISO 8601. */
    readonly to: string
}

/** The brand a workspace shows in the console header and the Hub. */
export interface WorkspaceBrand {
    /** The brand name; the workspace name stays its identity. */
    readonly displayName: string
    /** The logo: an app-relative path or an https URL. */
    readonly logoUrl: string
}

/** The billing columns of a workspace, as the billing capability reads them. */
export interface WorkspaceBillingFacts {
    /** The workspace status. */
    readonly status: string
    /** The plan code, or null before the first payment. */
    readonly planCode: string | null
    /** The end of the paid period, or null. */
    readonly paidUntil: Date | null
    /** The picked monthly allowance, or null. */
    readonly tierCredits: number | null
    /** The paid seats, or null. */
    readonly seatCount: number | null
    /** The billing cycle, or null. */
    readonly billingCycle: "monthly" | "annual" | null
    /** The full monthly price of what was bought, or null. */
    readonly billedMonthlyVnd: number | null
}

/** The billing columns of a workspace, or null when there is no such workspace. */
export type OptionalBillingFacts = WorkspaceBillingFacts | null
