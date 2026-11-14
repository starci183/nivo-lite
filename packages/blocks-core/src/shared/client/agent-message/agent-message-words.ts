import type { AgentMessageIntent } from "../../agent-message/agent-message-item"
import type { AgentMessageState } from "@nivo-lite/agent-sdk/team-chat"
import type { ApprovalRowWords } from "../../agent-message/agent-message-approval"

/** The words the kinds of the message draw in their bodies: the key/value rows of an order and the way to the connections. */
export interface AgentMessageKindWords {
    /** The total of an order. */
    readonly total: string
    /** The customer of an order. */
    readonly customer: string
    /** Where an order is delivered. */
    readonly deliver: string
    /** The way to the connections, when the agent needs one to go on. */
    readonly openConnections: string
}

/** Every word the card draws, in the viewer's language; the caller resolves them, so the card holds no copy. */
export interface AgentMessageWords {
    /** The primary command that approves what the agent proposes. */
    readonly approve: string
    /** The command that changes the proposal before it is approved. */
    readonly edit: string
    /** The secondary command that refuses the proposal. */
    readonly reject: string
    /** The command that approves the proposal in the words the person changed. */
    readonly sendEdited: string
    /** The command that leaves the editor with nothing changed. */
    readonly cancel: string
    /** The heading of the list that tells why a person is asked. */
    readonly why: string
    /** The word that leads a piece of evidence of that list. */
    readonly evidence: string
    /** The word that leads a rule of that list. */
    readonly rule: string
    /** The command that opens the source record of a message of a kind nobody registered. */
    readonly openDetail: string
    /** The word that opens the related work: it leads the work's name (`Open` + `order`). */
    readonly openWork: string
    /** The word before the agent that sent the message. */
    readonly from: string
    /** The word before who the message is for. */
    readonly to: string
    /** The word before the connection the content goes out through. */
    readonly via: string
    /** The word before the customer who gets the content. */
    readonly outboundTo: string
    /** The accessible name of the field the proposal is edited in. */
    readonly editLabel: string
    /** The chip of each state of a message that asks for something. */
    readonly states: Readonly<Record<AgentMessageState, string>>
    /** The chip of a message that asks for nothing (a notice, a report): its intent in words. An intent with no word draws no chip. */
    readonly intents?: Partial<Record<AgentMessageIntent, string>> | undefined
    /** The words the kinds draw in their bodies. */
    readonly kinds: AgentMessageKindWords
    /**
     * The folds of the facts an engine message carries: `details` over the worded facts, `technical` over the raw ones
     * inside it (a fold within the details fold). Absent, the card draws the worded facts as rows and never a technical one.
     */
    readonly facts?: { readonly details: string; readonly technical: string } | undefined
    /** The names of the rows of an approval card (the step, the account) and of its technical rows (the tool, the node). */
    readonly approval?: ApprovalRowWords | undefined
}

/** The values an edited payload is approved with. */
export type AgentMessageEdits = Readonly<Record<string, string>>
