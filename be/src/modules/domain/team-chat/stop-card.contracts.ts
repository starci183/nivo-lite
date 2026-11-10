/**
 * The typed part of the `workflow.stopped` card (DESIGN item D.2, package 1-7): the one thing the founder sees for a stop. The card's
 * common content (workflow, step, reason, question, facts, suggestions) keeps the blocks-core payload; this part says which of the three
 * stops it is, where it stands, what the engine needs to go on, and every reply the founder gave, so ONE message per stop is rewritten
 * in place for its whole life. The fourth thing the founder receives, an ordinary agent message, is not a stop and has no such part.
 */

/** Which stop the card is: the AI reports with intent, NIVO reports the AI failed (3 tries), or a call waits for permission. */
export const STOP_CARD_KINDS = ["ai_report", "ai_error", "approval"] as const

/** Which stop the card is. */
export type StopCardKind = (typeof STOP_CARD_KINDS)[number]

/**
 * Where the stop stands. `open`: it waits for the founder. `answered`: the founder replied (words or a button); while `resolvedAt` is null
 * the step is running again, once set the run went on. `skipped`: the founder skipped the step (the run ended). `timed_out`: a NIVO
 * deadline answered for the founder. `resolved`: the run went on or was closed with no decision of the founder.
 */
export const STOP_CARD_STATES = ["open", "answered", "skipped", "timed_out", "resolved"] as const

/** Where the stop stands. */
export type StopCardState = (typeof STOP_CARD_STATES)[number]

/** The buttons of a stop the engine accepts now (the web owns their labels). */
export const STOP_CARD_DECISIONS = ["retry", "take_over", "skip"] as const

/** One button of a stop. */
export type StopCardDecision = (typeof STOP_CARD_DECISIONS)[number]

/** The verdicts of a permission request (the web owns their labels). */
export const STOP_CARD_VERDICTS = ["approve", "refuse"] as const

/** One verdict of a permission request. */
export type StopCardVerdict = (typeof STOP_CARD_VERDICTS)[number]

/** What a reply on the card was: the founder's words, a button, a verdict, or a NIVO deadline. */
export const STOP_CARD_REPLY_KINDS = ["answer", "retry", "take_over", "skip", "timeout", "approve", "refuse"] as const

/** What a reply was. */
export type StopCardReplyKind = (typeof STOP_CARD_REPLY_KINDS)[number]

/** Who a reply is from when no person gave it. */
export const STOP_CARD_DEADLINE = "deadline"

/** What the engine needs to go on: the founder's words, and/or one of the buttons, and/or a verdict. Empty everywhere: nothing. */
export interface StopCardNeeds {
    /** Whether a free-text answer (a reply to the card, or its box) moves the run. */
    readonly answer: boolean
    /** The buttons the engine accepts now. */
    readonly decisions: ReadonlyArray<StopCardDecision>
    /** The verdicts the engine accepts now (a permission request only). */
    readonly verdicts: ReadonlyArray<StopCardVerdict>
}

/** One reply the stop received, as stored on the card: what, the words (null for a button), who (a user id, or `deadline`), when. */
export interface StopCardReply {
    /** What the reply was. */
    readonly kind: StopCardReplyKind
    /** The founder's words; null for a button, a verdict or a deadline. */
    readonly text: string | null
    /** The user who replied, or `deadline`. */
    readonly by: string
    /** When, ISO. */
    readonly at: string
}

/** The typed part of a stop's card, stored under `stop` in the card payload. Written by the engine only. */
export interface StopCardSection {
    /** The shape of this part; 1 today. */
    readonly version: 1
    /** The stop record (`agent.run-stop`); null on a card the old engine posted. */
    readonly stopId: string | null
    /** The run. */
    readonly runId: string
    /** The step that stopped. */
    readonly stepKey: string
    /** Which stop it is. */
    readonly kind: StopCardKind
    /** Where it stands. */
    readonly state: StopCardState
    /** The short common heading of the card in the team's language (engine words, never a code). */
    readonly headline: string
    /** What the engine needs to go on; nothing once the stop is not open. */
    readonly needs: StopCardNeeds
    /** Every reply the stop received, oldest first: the trace the card keeps. */
    readonly replies: ReadonlyArray<StopCardReply>
    /** How many times this step of this run stopped. */
    readonly repeats: number
    /** When the step last stopped, ISO. */
    readonly stoppedAt: string
    /** When the stop resolved, ISO; null while it is open or the step runs again. */
    readonly resolvedAt: string | null
    /** How many times the card was written; the web compares it to see a rewrite. Set by the team chat. */
    readonly revision: number
}

/** The section as the engine hands it to the team chat: the revision is the team chat's to count. */
export type StopCardSectionGiven = Omit<StopCardSection, "revision">

/** One reply as a screen shows it: the section's reply with the name of the person (empty when unknown or a deadline). */
export interface StopCardReplyView extends StopCardReply {
    /** The person's name; empty for a deadline or a member that left. */
    readonly byName: string
}

/** The typed stop of a card as a screen shows it, the common content of the card included. */
export interface StopCardView {
    /** The stop record; null on a card of the old engine. */
    readonly stopId: string | null
    /** The run. */
    readonly runId: string
    /** The step that stopped. */
    readonly stepKey: string
    /** The step in the team's words. */
    readonly stepTitle: string
    /** The workflow in the team's words. */
    readonly workflowTitle: string
    /** The module of the workflow. */
    readonly moduleKey: string
    /** The customer, when the run names one. */
    readonly leadId: string | null
    /** The conversation, when the run has one. */
    readonly conversationId: string | null
    /** Which stop it is. */
    readonly kind: StopCardKind
    /** `ai`: the AI worded the reason; `engine`: NIVO did (the AI failed). */
    readonly by: "ai" | "engine"
    /** Where it stands. */
    readonly state: StopCardState
    /** The short common heading. */
    readonly headline: string
    /** The reason, in the AI's words or the engine's. */
    readonly message: string
    /** The question for the founder, or null. */
    readonly question: string | null
    /** The AI's suggested ways on; none once the stop is not open. */
    readonly suggestions: ReadonlyArray<{ readonly text: string; readonly handledBy: "workflow" | "person" }>
    /** The engine's true facts, by name. */
    readonly facts: ReadonlyArray<{ readonly name: string; readonly value: string }>
    /** What the engine needs to go on. */
    readonly needs: StopCardNeeds
    /** The founder's replies, oldest first. */
    readonly replies: ReadonlyArray<StopCardReplyView>
    /** How many times the step stopped. */
    readonly repeats: number
    /** When it first stopped, ISO. */
    readonly firstAt: string
    /** When it last stopped, ISO. */
    readonly stoppedAt: string
    /** When it resolved, ISO, or null. */
    readonly resolvedAt: string | null
    /** How many times the card was written (0 on an old-engine card). */
    readonly revision: number
}
