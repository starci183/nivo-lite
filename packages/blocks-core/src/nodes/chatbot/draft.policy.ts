import type { NodeModelRequest } from "@nivo-lite/agent-sdk/node"
import { REPLY_MAX } from "../../rules/chatbot/reply"
import type { DraftReplyInput } from "./draft.types"

/** The short tag the model call is metered under. */
export const DRAFT_PURPOSE = "chatbot-draft-reply"

const DRAFT_INSTRUCTIONS = [
    "You write a reply to a customer for the shop owner to approve before it is sent.",
    "Answer in the language the customer wrote in, in a polite, short and warm voice, in one message.",
    "Use only the grounded answer when one is given; never promise a price, a discount, a booking or an action it does not state.",
    "When nothing is grounded, ask the customer one short clarifying question instead of guessing.",
    "Answer with the reply text alone: no quotes, no notes to the owner.",
].join(" ")

/** What the model is asked: the instructions, and the question with the grounded answer as data. */
export const draftAsk = (given: DraftReplyInput): NodeModelRequest => ({
    purpose: DRAFT_PURPOSE,
    instructions: DRAFT_INSTRUCTIONS,
    input: { question: given.question, grounded: given.grounded },
})

/**
 * The words to store as the draft: what the model wrote, else the grounded answer, cut to the longest reply a person may send. Nothing
 * when both are empty, so a draft with no words is never put in front of the owner.
 */
export const draftTextOf = (written: string, grounded: string | null): string | null => {
    const text = written.trim() === "" ? (grounded ?? "").trim() : written.trim()
    return text === "" ? null : text.slice(0, REPLY_MAX)
}

/** The key that makes a draft once per turn and conversation: a retry of the step stores nothing twice. */
export const draftKeyOf = (turnId: string, conversationId: string): string => `draft:${turnId}:${conversationId}`

/** The key that makes sending an approved line once, whatever path approved it: the id of the stored line. */
export const approvedKeyOf = (messageId: string): string => `approved:${messageId}`
