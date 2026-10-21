import type { WorkspaceMember } from "@modules/domain/workspace-members"

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

/** A workspace together with the caller's membership in it. */
export interface WorkspaceMembership {
    /** The workspace. */
    readonly workspace: WorkspaceSummary
    /** The caller's membership. */
    readonly member: WorkspaceMember
}

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

/** One draft waiting for approval. */
export interface ShellApproval {
    /** The execution id. */
    readonly id: string
    /** The drafted text. */
    readonly draft: string
    /** What happens next, when known. */
    readonly nextAction: string | null
    /** The customer the draft belongs to. */
    readonly leadId: string | null
    /** The customer name. */
    readonly contactName: string | null
}

/** One exception with no approval card of its own. */
export interface ShellException {
    /** The work item id. */
    readonly id: string
    /** The customer the item belongs to. */
    readonly leadId: string | null
    /** The customer name. */
    readonly contactName: string | null
    /** The proposal summary. */
    readonly summary: string | null
    /** The failure, when the item failed. */
    readonly error: string | null
}

/** The counts and lists the console frame needs. */
export interface ShellFacts {
    /** How many customers the workspace has. */
    readonly leadCount: number
    /** How many responsibilities are still open. */
    readonly openResponsibilityCount: number
    /** The installed agents. */
    readonly agents: ReadonlyArray<ShellAgent>
    /** Whether a chatbot agent is installed. */
    readonly hasChatbot: boolean
    /** Whether the workspace bought a module inside the founding window. */
    readonly isFoundingMember: boolean
    /** Drafts waiting for approval, newest first. */
    readonly approvals: ReadonlyArray<ShellApproval>
    /** Work items waiting or failed without an approval card. */
    readonly exceptions: ReadonlyArray<ShellException>
    /** Decisions waiting on a person. */
    readonly pendingDecisions: number
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
