/** How far the back end trusts who sent an event; it selects the limits of the turn. An adapter declares it, code never infers it. */
export type InboundTrust = "outsider" | "member" | "manager" | "system"

/** What started a turn: the event type a trigger node of the graph matches on. A new trigger is an adapter that declares a new type. */
export type IntentTrigger = string & Record<never, never>

/** Where a business value of a contract came from. Its members fit the sources of a graph node. */
export type IntentSource =
    | { readonly kind: "brain"; readonly factId: string; readonly passage: string; readonly valueHash: string }
    | { readonly kind: "chat"; readonly messageId: string; readonly quote: string }
    | { readonly kind: "owner"; readonly memberId: string }

/** One business limit the owner approved, and the turns it binds. */
export interface BusinessLimit {
    /** The limit, in the owner's language. */
    readonly text: string
    /** The triggers it binds; empty binds every trigger. */
    readonly triggers: ReadonlyArray<IntentTrigger>
    /** The trusts it binds; empty binds every trust. */
    readonly trusts: ReadonlyArray<InboundTrust>
    /** Where it came from. */
    readonly sources: ReadonlyArray<IntentSource>
}

/** The business half of a contract, frozen in a published graph version; the owner approves it and nothing writes it at runtime. */
export interface IntentBusiness {
    /** The intent, the action key of the graph. */
    readonly intent: string
    /** What this shop means by the work; empty leaves the frame's task alone. */
    readonly task: string
    /** The limits of this shop. */
    readonly limits: ReadonlyArray<BusinessLimit>
    /** Where the task came from. */
    readonly sources: ReadonlyArray<IntentSource>
}

/** The work the model found no intent for, in its own words. */
export interface IntentGapText {
    /** What was asked, in one short sentence. */
    readonly question: string
    /** What it is about. */
    readonly topic: string
}

/** A gap raised for the owner. */
export interface IntentGap extends IntentGapText {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The version the turn ran on. */
    readonly versionId: string
    /** The trigger of the turn. */
    readonly trigger: IntentTrigger
    /** For a rule of the setup text the graph does not hold: the sum it names, VND. Absent for any other gap. */
    readonly amountVnd?: number | undefined
}
