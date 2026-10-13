import type { TranscriptLine } from "@modules/domain/agent-messages"

/** A paid invoice counts as "just confirmed" for a customer's late "I have paid" within this window. */
export const RECENTLY_PAID_MS = 14 * 86_400_000

/** The order statuses that mean the order is still open (not paid, not cancelled). */
export const OPEN_ORDER_STATUSES: ReadonlySet<string> = new Set(["draft", "confirmed", "invoiced"])

/** Shortens a text to `max` characters with an ellipsis. */
export const clipText = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

/** The same item said twice is one item: case, spacing and Unicode form do not matter. */
export const sameItems = (a: string, b: string): boolean => {
    const norm = (text: string): string => text.normalize("NFC").toLowerCase().replace(/\s+/gu, " ").trim()
    return norm(a) === norm(b)
}

/** True when a paid invoice was paid recently enough that the customer's claim is about it. */
export const isRecentlyPaid = (paidAt: string | null, now: Date): boolean =>
    paidAt !== null && now.getTime() - Date.parse(paidAt) < RECENTLY_PAID_MS

/** The customer's latest question in the transcript, else the message of the turn. */
export const latestQuestionOf = (transcript: ReadonlyArray<TranscriptLine>, body: string): string =>
    transcript.filter((line) => line.role === "user").at(-1)?.body ?? body

/** The transcript a lead hand-off carries: the conversation and the reply about to leave, one line each. */
export const handoffTranscriptOf = (
    transcript: ReadonlyArray<TranscriptLine>,
    reply: string,
    customer: string,
    agent: string,
): string =>
    [...transcript, { role: "agent" as const, body: reply }]
        .map((line) => `${line.role === "user" ? customer : agent}: ${line.body}`)
        .join("\n")
