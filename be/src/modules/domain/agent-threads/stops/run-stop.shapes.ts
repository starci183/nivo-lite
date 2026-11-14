import { z, type ZodType } from "zod"
import { APPROVAL_CARD_SHAPE, type ApprovalCard } from "../approval-card.policy"

/** The longest id the stop keeps (a run, a step key, a member). */
const MAX_ID = 200

/** The longest line (a suggestion, a fact's value). */
const MAX_LINE = 500

/** The longest text (a reason, a question, an answer, a customer line). */
const MAX_BODY = 20_000

/** The most suggestions, facts, lines and answers one stop keeps. */
const MAX_STOP_ENTRIES = 50

/** The longest moment text the engine writes. */
const MAX_TIME = 40

/** How a stop was answered: the founder's words, one of the three buttons, a take-over handed back, or a NIVO deadline. */
export const RUN_STOP_DECISIONS = ["answer", "retry", "take_over", "skip", "handed_back", "timeout"] as const

/** One suggested way on, from the AI core, and who would do it. */
export type RunStopSuggestion = {
    /** The suggested way on, in words. */
    readonly text: string
    /** Who would do it: a workflow or a person. */
    readonly handledBy: "workflow" | "person"
}

/** One true fact the engine attached to the stop, by name. */
export type RunStopFact = {
    /** The fact's name. */
    readonly name: string
    /** The fact's value, as text. */
    readonly value: string
}

/** What the AI core (or the engine) said about the stop besides the reason and the question. */
export type RunStopDetail = {
    /** The suggested ways on. */
    readonly suggestions: ReadonlyArray<RunStopSuggestion>
    /** The true facts the engine attached. */
    readonly facts: ReadonlyArray<RunStopFact>
    /** The approval card the engine built before the write (a stop of kind `approval` only), kept so every rewrite carries it. */
    readonly approvalCard?: ApprovalCard | undefined
}

/** One line the stopped step sent a customer while the stop was open: where, the words, when. */
export type RunStopCustomerLine = {
    /** The conversation the line went to. */
    readonly conversationId: string
    /** The words sent. */
    readonly text: string
    /** When it happened, as an ISO instant. */
    readonly at: string
}

/** The customer lines of a stop, in the order they went out. */
export type RunStopCustomerLines = {
    /** The lines, in the order they went out. */
    readonly lines: ReadonlyArray<RunStopCustomerLine>
}

/** One answer the stop received: the founder's words or a button, who gave it and when. */
export type RunStopAnswer = {
    /** How the stop was answered. */
    readonly kind: (typeof RUN_STOP_DECISIONS)[number]
    /** The founder's words, or null for a button or a deadline. */
    readonly text: string | null
    /** Who gave the answer. */
    readonly by: string
    /** When it happened, as an ISO instant. */
    readonly at: string
}

/** The answers of a stop, oldest first: the trace the card shows. */
export type RunStopAnswers = {
    /** The answers, oldest first. */
    readonly answers: ReadonlyArray<RunStopAnswer>
}

const suggestionShape = z.object({ text: z.string().min(1).max(MAX_LINE), handledBy: z.enum(["workflow", "person"]) })

const factShape = z.object({ name: z.string().max(MAX_ID), value: z.string().max(MAX_LINE) })

/** The shape of one answer: also the shape of a stop's `decision` column. */
export const RUN_STOP_ANSWER_SHAPE: ZodType<RunStopAnswer> = z.object({
    kind: z.enum(RUN_STOP_DECISIONS),
    text: z.string().max(MAX_BODY).nullable(),
    by: z.string().max(MAX_ID),
    at: z.string().max(MAX_TIME),
})

/** The shape of a stop's `detail` column. */
export const RUN_STOP_DETAIL_SHAPE: ZodType<RunStopDetail> = z.object({
    suggestions: z.array(suggestionShape).max(MAX_STOP_ENTRIES),
    facts: z.array(factShape).max(MAX_STOP_ENTRIES),
    approvalCard: APPROVAL_CARD_SHAPE.optional(),
})

/** The shape of a stop's `customer_lines` column. */
export const RUN_STOP_LINES_SHAPE: ZodType<RunStopCustomerLines> = z.object({
    lines: z
        .array(z.object({ conversationId: z.string().max(MAX_ID), text: z.string().max(MAX_BODY), at: z.string().max(MAX_TIME) }))
        .max(MAX_STOP_ENTRIES),
})

/** The shape of a stop's `answers` column. */
export const RUN_STOP_ANSWERS_SHAPE: ZodType<RunStopAnswers> = z.object({
    answers: z.array(RUN_STOP_ANSWER_SHAPE).max(MAX_STOP_ENTRIES),
})
