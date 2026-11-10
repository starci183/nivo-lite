import type { StepJson } from "../agent-runs.contracts"

/** The channels a customer writes from: a run that serves one of their conversations is a chat run. */
export const CUSTOMER_CHANNELS: ReadonlyArray<string> = ["zalo", "telegram", "facebook", "instagram", "website", "web"]

/**
 * The pauses before each machine resume of a parked chat run, seconds: about a minute, then five, then half an hour for every resume
 * after, still bounded by the most resumes. A customer who wrote waits minutes, not the half hour of a back-office run.
 */
export const CHAT_PARK_LADDER_SECONDS: readonly [number, ...Array<number>] = [60, 300, 1800]

/** What the pause of a parked run is read from. */
export interface ParkPauseFacts {
    /** The run serves a customer conversation. */
    readonly chat: boolean
    /** The times the machine resumed it so far. */
    readonly resumes: number
    /** The app's pause for any other run, seconds. */
    readonly baseSeconds: number
}

/** The members of a run's trigger that say which conversation it serves, and on which channel. */
export interface RunConversation {
    /** The conversation, when the trigger names one. */
    readonly conversationId?: unknown
    /** The channel of the conversation, when the trigger names one. */
    readonly channel?: unknown
    /** The customer message a channel wake answers, when the trigger names one. */
    readonly messageId?: unknown
}

const named = (value: unknown): boolean => typeof value === "string" && value !== ""

/**
 * Whether a run's trigger serves a customer conversation: it names the conversation and a customer channel, or, as the context of a
 * channel wake is stored (the conversation and the customer message, no channel), the conversation and the customer message it answers.
 * A run stored that way was once read as a back-office run: it waited the flat pause, was never superseded, and a resume half an hour
 * later answered the customer's old words again (the consult opened again after the order and its QR).
 */
export const servesCustomer = (context: RunConversation): boolean => {
    const { conversationId, channel, messageId } = context
    if (!named(conversationId)) return false
    if (typeof channel === "string" && CUSTOMER_CHANNELS.includes(channel)) return true
    return (channel === undefined || channel === null) && named(messageId)
}

/** The rung of the chat ladder after `resumes` machine resumes; the last rung holds for every resume past the ladder. */
export const chatRungSeconds = (resumes: number): number => {
    const at = Math.min(Math.max(0, Math.trunc(resumes)), CHAT_PARK_LADDER_SECONDS.length - 1)
    return CHAT_PARK_LADDER_SECONDS[at] ?? CHAT_PARK_LADDER_SECONDS[0]
}

/** How long a run must have been parked before the sweep resumes it: the chat rung, else the app's flat pause. */
export const parkAgeSeconds = (facts: ParkPauseFacts): number =>
    facts.chat ? chatRungSeconds(facts.resumes) : facts.baseSeconds

/** The pause written after a machine resume before the next one may start: the next chat rung, else the app's doubling pause. */
export const resumeGapSeconds = (facts: ParkPauseFacts): number =>
    facts.chat ? chatRungSeconds(facts.resumes + 1) : facts.baseSeconds * 2 ** Math.max(0, facts.resumes)

/** What the supersede check reads of a run. */
export interface SupersedeRun {
    /** The run. */
    readonly id: string
    /** The agent it works for. */
    readonly agentId: string
    /** Where it stands. */
    readonly status: string
    /** Its trigger. */
    readonly context: StepJson
    /** When it started, or null. */
    readonly startedAt: Date | null
}

/**
 * Whether a parked chat run is superseded: a newer run of the same agent in the same customer conversation finished. That run read every
 * message the customer sent since the agent last answered, the parked run's own among them, so a machine resume of the old one would
 * answer the customer a second time, from older words. A person may still resume it.
 */
export const supersededBy = (run: SupersedeRun, others: ReadonlyArray<SupersedeRun>): boolean => {
    if (!servesCustomer(run.context) || run.startedAt === null) return false
    const started = run.startedAt.getTime()
    return others.some(
        (other) =>
            other.id !== run.id &&
            other.agentId === run.agentId &&
            other.status === "done" &&
            other.context.conversationId === run.context.conversationId &&
            other.startedAt !== null &&
            other.startedAt.getTime() > started,
    )
}
