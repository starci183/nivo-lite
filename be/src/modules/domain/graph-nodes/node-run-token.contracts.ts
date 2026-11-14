/** Who a run acts for: a customer of a channel, the owner or a staff member behind a turn, or the system (a tag, a schedule, an event). */
export type RunOrigin = "customer" | "owner" | "staff" | "system"

/** What a run reads: public knowledge only (a customer's turn), or the workspace. */
export type TurnScope = "public" | "workspace"

/**
 * The workflow step a call is made in: the node of the graph, the version the run is pinned to and the workflow it belongs to. The host
 * knows it when it runs the node; it names where a call came from (the audit, the node-level rights), and decides nothing by itself.
 */
export interface NodeStepRef {
    /** The key of the node within its graph (`GraphSpecNode.key`). */
    readonly nodeKey: string
    /** The version the run is pinned to: the agent graph version of a primary workflow, the workflow version of any other. */
    readonly versionId: string
    /** The workflow the run is pinned to, or null for a run of the agent's own graph that no workflow took. */
    readonly workflowId: string | null
    /**
     * The part the run plays for the provider trigger that started it: `decider` (the one agent that decides what the event means for
     * the platform's records) or `notice` (an agent that is only told). Absent for a run no provider trigger started, and in a token
     * signed before this member existed: such a run is no notice run.
     */
    readonly triggerRole?: "decider" | "notice" | undefined
}

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
    /** The workflow step the call is made in, when the host ran a node of a pinned version; absent for any other call. */
    readonly step?: NodeStepRef | undefined
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
export interface NodeToolArgs {
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
    readonly args: NodeToolArgs
    /** The replay key of the call. */
    readonly key: string
    /** The person's approval this call replays, or null. */
    readonly approval: NodeToolApproval | null
    /** The connected account the runner handed the call, when it acts on one; absent, the provider's adapter picks as before. */
    readonly account?: NodeToolAccount | undefined
    /**
     * How a BUSINESS refusal of the tool comes back (a refusal its source classes `business`, or the outside system's own refusal of an
     * operation): absent, as the door always answered it (a native refusal thrown as the typed error, an outside refusal as the value:
     * the `defineNode` road); `answer`, as the refusal fact `{ kind: "refused", id, facts }` (a template node's `ok: false`). An
     * infrastructure refusal or failure is thrown either way.
     */
    readonly refusals?: "answer" | undefined
}

/** How the account of a call was chosen: by the owner of its data (the conversation's connection), by the node's order, or by a fallback. */
export type NodeAccountChoice = "data_owner" | "order" | "fallback"

/** The connected account the runner hands one call: its provider, its connection, which try of the call it is and how it was chosen. */
export interface NodeToolAccount {
    /** The provider key. */
    readonly provider: string
    /** The connection. */
    readonly connectionId: string
    /** Which try of the call this is, from 1. */
    readonly attempt: number
    /** How the account was chosen. */
    readonly chosenBy: NodeAccountChoice
}
