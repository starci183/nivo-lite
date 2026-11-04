import type { GraphEvidence } from "@modules/domain/work-items"
import type { InboundTrust, IntentGap, IntentTrigger } from "@modules/domain/intent-contracts"
import type { FactSpec, FactValues } from "./agent-graphs.contracts"
import type { GraphIntent, IntentNodeKeys, OptionalTurnContracts } from "./agent-graph-brief.contracts"

/** The subject a fact is read about: the record the work item names, and the work item itself. */
export interface FactSubject {
    /** The type. */
    readonly type: string
    /** The id of the record, or an empty text when the work item names none. */
    readonly id: string
    /** The work item the decision is about, for a fact that lives in what the item proposes and not in a record of its own. */
    readonly workItemId: string
    /** The amount in dong the work item proposes, for the facts that are the amount of the work itself (an order, a quote, a discount). */
    readonly amountVnd?: number | null | undefined
    /** The text that would really leave, or null when the work sends none. */
    readonly text?: string | null | undefined
    /** The customer the work names, or null when it names none. */
    readonly leadId?: string | null | undefined
    /** What the turn knows, as far as the trigger of the graph accepts it; absent on a road that has none. */
    readonly evidence?: ReadonlyArray<GraphEvidence> | undefined
    /** What the road knows about the call, by fact key: the tool it is about to run, the agent it is about to hand to. */
    readonly attributes?: Readonly<Record<string, string>> | undefined
}

/**
 * One module's reader of the facts a decide point reads from real records (the amount of the supplier payment, not the amount the
 * model wrote). It only reads, in the agent's view, and a fact it cannot read is absent from its answer.
 */
export interface GraphFactReader {
    /** The facts it declares, with their type, unit and allowed values. */
    readonly facts: ReadonlyArray<FactSpec>
    /** Reads the named facts of one subject; a fact that could not be read is left out. */
    read(workspaceId: string, subject: FactSubject, facts: ReadonlyArray<string>): Promise<FactValues>
}

/** What the action graph lets an agent ask for (owner: the action graph, bound at the app root). */
export interface AgentGraphBrief {
    /** The intents the active version of the agent's graph allows; none for an agent with no graph. */
    intentsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<GraphIntent>>
    /**
     * The contracts the published version holds for a trigger and an trust, or null: no graph, a graph in shadow, no active version, or
     * a reachable intent with no frame. Null leaves the turn on the prompt it had before contracts.
     */
    contractsOf(
        workspaceId: string,
        agentId: string,
        trigger: IntentTrigger,
        trust: InboundTrust,
        source?: string,
    ): Promise<OptionalTurnContracts>
    /** The node keys of the active version the steps of a turn stand for. */
    nodeKeysOf(workspaceId: string, agentId: string, trigger?: IntentTrigger, source?: string): Promise<IntentNodeKeys>
    /** Raises the gap a turn found as a proposal for the owner, once per agent and question; false when it was already raised. */
    raiseGap(gap: IntentGap): Promise<boolean>
}

/** A file a customer sent with a message, as a node reads it: a short-lived address, never the bytes. */
export interface FlowTriggerFile {
    /** The file. */
    readonly id: string
    /** Its name. */
    readonly name: string
    /** Its type. */
    readonly contentType: string
    /** A short-lived address. */
    readonly url: string
}

/** One customer message a node graph's run answers. */
export interface FlowTriggerMessage {
    /** The message. */
    readonly id: string
    /** What the customer said. */
    readonly text: string
    /** When they said it, ISO. */
    readonly at: string
    /** The files they sent with it. */
    readonly attachments: ReadonlyArray<FlowTriggerFile>
}

/** The conversation a channel wake belongs to, as a trigger reads it: the customer it is with and the channel it runs on. */
export interface FlowTriggerConversation {
    /** The customer, or null when none is known yet. */
    readonly leadId: string | null
    /** The channel. */
    readonly channel: string
}

/**
 * The customer messages a run answers, read from the store: a channel wake carries ids only, never the words. The capability that owns
 * the conversations binds it; without it a channel wake's trigger holds no words.
 */
export interface FlowTriggerMessages {
    /** The customer's messages among the ids, in the order they were said, with their files. */
    messagesOf(
        workspaceId: string,
        conversationId: string,
        messageIds: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<FlowTriggerMessage>>
    /** The conversation's customer and channel, or null when it is gone. */
    conversationOf(conversationId: string): Promise<FlowTriggerConversation | null>
}
