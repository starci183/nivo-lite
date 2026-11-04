/** Who a run acts for: a customer of a channel, the owner or a staff member behind a turn, or the system (a tag, a schedule, an event). */
export type RunOrigin = "customer" | "owner" | "staff" | "system"

/** What a run reads: public knowledge only (a customer's turn), or the workspace. */
export type TurnScope = "public" | "workspace"

/** The claims of a run token: who the run is and what it may reach, as the host minted them; never what a caller says. */
export interface NodeRunClaims {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent the run is. */
    readonly agentId: string
    /** The run. */
    readonly runId: string
    /** The customer conversation the run serves, or null. */
    readonly conversationId: string | null
    /** Who the run acts for. */
    readonly origin: RunOrigin
    /** The member behind the turn, when a person is; null otherwise. */
    readonly memberId: string | null
    /** What the run may read. */
    readonly scope: TurnScope
    /** When the token stops being valid, epoch milliseconds. */
    readonly expiresAt: number
}

/** The claims of a valid run token, or null for a token that is forged, malformed or expired. */
export type OptionalRunClaims = NodeRunClaims | null

/** A person's approval of one tool call: who approved and the fingerprint of the exact tool and arguments they saw. */
export interface NodeToolApproval {
    /** The member who approved. */
    readonly by: string
    /** The fingerprint of the tool and its arguments, as the approval item showed them. */
    readonly fingerprint: string
}

/** The arguments of one tool call: business data only, never a destination, an account or a credential. */
export interface ToolArgs {
    /** One argument by name. */
    readonly [name: string]: unknown
}

/** One tool call of a node, as the host hands it to the door. */
export interface NodeToolCall {
    /** The run token the host minted for this run. */
    readonly token: string
    /** The capability tool. */
    readonly tool: string
    /** Its arguments: business data only. */
    readonly args: ToolArgs
    /** The replay key of the call. */
    readonly key: string
    /** The person's approval this call replays, or null. */
    readonly approval: NodeToolApproval | null
}
