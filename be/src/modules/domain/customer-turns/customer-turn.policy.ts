import type { AgentWakeContext } from "@modules/domain/agent-work"
import type { ChatTranscriptLine } from "@modules/domain/chat-records"
import type { TurnRef } from "@modules/domain/conversations"

/** A paid invoice counts as "just confirmed" for a customer's late "I have paid" within this window. */
export const RECENTLY_PAID_MS: number = 14 * 86_400_000

/** Shortens a text to `max` characters with an ellipsis. */
export const clipText = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

/** True when a paid invoice was paid recently enough that the customer's claim is about it. */
export const isRecentlyPaid = (paidAt: string | null, now: Date): boolean =>
    paidAt !== null && now.getTime() - Date.parse(paidAt) < RECENTLY_PAID_MS

/** The customer's latest question in the transcript, else the message of the turn. */
export const latestQuestionOf = (transcript: ReadonlyArray<ChatTranscriptLine>, body: string): string =>
    transcript.findLast((line) => line.role === "user")?.body ?? body

/** The transcript a lead hand-off carries: the conversation and the reply about to leave, one line each. */
export const handoffTranscriptOf = (
    transcript: ReadonlyArray<ChatTranscriptLine>,
    reply: string,
    customer: string,
    agent: string,
): string =>
    [...transcript, { role: "agent" as const, body: reply }]
        .map((line) => `${line.role === "user" ? customer : agent}: ${line.body}`)
        .join("\n")

/** A customer wake older than this when its turn begins is not answered: the question was asked a long time ago. */
export const STALE_WAKE_MS: number = 10 * 60_000

/** How the reasons the drain and the executor give map to the ones the outcome handler knows. */
const HOLD_REASONS: Readonly<Record<string, string>> = {
    quota: "quota_exceeded",
    breaker: "openclaw_unavailable",
    openclaw_unavailable: "openclaw_unavailable",
    openclaw_not_configured: "openclaw_not_configured",
    killed: "installation_not_running",
    stale: "stale_wake",
}

/** True when a wake written at `createdAt` is too old to answer at `now`. */
export const isStaleWake = (createdAt: Date, now: Date): boolean => now.getTime() - createdAt.getTime() > STALE_WAKE_MS

/** The reason the outcome handler knows for a turn that could not run; a reason it already knows stays as it is. */
export const holdReasonOf = (reason: string): string => HOLD_REASONS[reason] ?? reason

/** The message a customer wake answers, or null when the wake does not carry one. */
export const turnRefOf = (context: AgentWakeContext): TurnRef | null =>
    context.conversationId === undefined || context.messageId === undefined || context.channelEventId === undefined
        ? null
        : {
              conversationId: context.conversationId,
              messageId: context.messageId,
              channelEventId: context.channelEventId,
              ...(context.mergedMessageIds === undefined
                  ? {}
                  : { mergedMessageIds: context.mergedMessageIds.split(",") }),
          }
