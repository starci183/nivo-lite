import { inboxStatusOf, unansweredOf } from "./conversation-status"
import type { InboxStatus } from "./conversation-status"
import { tailAfter } from "./conversation-tail"
import type { ConversationTail, TailLine } from "./conversation-tail"

/** What a conversation stores that the next change starts from. */
export interface ConversationState extends ConversationTail {
    /** Whether the AI handed a question to a person that is not answered yet. */
    readonly waiting: boolean
    /** The person who holds the conversation; null while the AI answers. */
    readonly handledBy: string | null
}

/** The stored marks of a conversation that follow from its state: written with every change so the inbox filters and sorts on them. */
export interface ConversationMarks {
    /** Where the conversation stands in the inbox. */
    readonly status: InboxStatus
    /** Whether the customer wrote last and a person is needed. */
    readonly unanswered: boolean
}

/** The fields a new line changes on its conversation. */
export type LinePatch = ConversationTail & ConversationMarks

/** The fields a take-over or a release changes on its conversation. */
export interface HandlingPatch extends ConversationMarks {
    /** The person who holds the conversation now; null once it is handed back to the AI. */
    readonly handledBy: string | null
}

/** The fields a raised or answered question changes on its conversation. */
export interface WaitingPatch extends ConversationMarks {
    /** Whether a question for a person is open now. */
    readonly waiting: boolean
}

/** The marks of a state. */
export const marksOf = (state: ConversationState): ConversationMarks => ({
    status: inboxStatusOf(state),
    unanswered: unansweredOf(state),
})

/** What storing one more line changes: the tail and the marks that follow from it. */
export const patchAfterLine = (state: ConversationState, line: TailLine): LinePatch => {
    const tail = tailAfter(state, line)
    return { ...tail, ...marksOf({ ...state, ...tail }) }
}

/** What a take-over (a name) or a release (null) changes. */
export const patchAfterHandling = (state: ConversationState, handledBy: string | null): HandlingPatch => ({
    handledBy,
    ...marksOf({ ...state, handledBy }),
})

/** What raising or answering a question for a person changes. */
export const patchAfterWaiting = (state: ConversationState, waiting: boolean): WaitingPatch => ({
    waiting,
    ...marksOf({ ...state, waiting }),
})
