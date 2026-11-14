import { chatMarkOf, type ChatMark } from "./conversation-status"

/** What a conversation stores that the next change of its open question starts from. */
export interface ConversationState {
    /** Whether the AI handed a question to a person that is not answered yet. */
    readonly waiting: boolean
}

/** The stored mark of a conversation that follows from its state: written with every change so the inbox filters and sorts on it. */
export interface ConversationMarks {
    /** The stored mark: a customer waits for a person, or not (who holds the thread is the engine's route, ruling R43). */
    readonly status: ChatMark
}

/** The fields a raised or answered question changes on its conversation. */
export interface WaitingPatch extends ConversationMarks {
    /** Whether a question for a person is open now. */
    readonly waiting: boolean
}

/** The marks of a state. */
export const marksOf = (state: ConversationState): ConversationMarks => ({ status: chatMarkOf(state.waiting) })

/** What raising or answering a question for a person changes. */
export const patchAfterWaiting = (state: ConversationState, waiting: boolean): WaitingPatch => ({
    waiting,
    ...marksOf({ ...state, waiting }),
})
