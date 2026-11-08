import type { DecisionQueueView, DecisionRowView } from "../../views/views.types"

/** The command id of taking a waiting conversation over. */
export const TAKE_OVER_COMMAND = "handoff"

/** The part of a conversation a decision row shows. */
export interface WaitingConversation {
    /** The conversation id. */
    readonly id: string
    /** The name the inbox shows; empty while unknown. */
    readonly name: string
    /** The channel code. */
    readonly channel: string
    /** What the customer last said. */
    readonly lastText: string
}

const rowOf = (conversation: WaitingConversation): DecisionRowView => ({
    id: conversation.id,
    title: conversation.name === "" ? conversation.channel : conversation.name,
    description: conversation.lastText,
    badges: [],
    reason: null,
    amount: null,
    proposal: conversation.lastText,
    trace: null,
    expiry: null,
    primary: { id: TAKE_OVER_COMMAND, label: TAKE_OVER_COMMAND },
    edit: null,
    menu: [],
    waitingFor: null,
})

/** The conversations that wait for a person as a decision queue; `total` counts every waiting conversation. */
export const chatDecisionQueueOf = (
    conversations: ReadonlyArray<WaitingConversation>,
    total: number,
): DecisionQueueView => ({
    count: total === 0 ? null : String(total),
    more: null,
    rows: conversations.map((conversation) => rowOf(conversation)),
})
