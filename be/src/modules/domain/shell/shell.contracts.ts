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
