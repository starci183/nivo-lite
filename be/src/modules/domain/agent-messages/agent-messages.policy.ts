import type { MessageStamp } from "./agent-messages.contracts"

/** A send started without a durable acknowledgement; receipt reconciliation is required before another send. */
export const DELIVERY_OUTCOME_UNKNOWN = "delivery_outcome_unknown"

/** Messages of one millisecond are told apart by up to this many microseconds. */
const TIE_SLOTS = 1000

/** A number from a text that is the same for the same text: FNV-1a over its code points. */
const hashOf = (text: string): number =>
    [...text].reduce((hash, char) => Math.imul(hash ^ Number(char.codePointAt(0)), 16_777_619) >>> 0, 2_166_136_261)

/**
 * When a message the channel timed itself happened: that time, but never later than `now` (a clock that runs ahead must not put a message in the
 * future), with a tie-break from the channel's own id of the message, so messages of the same millisecond keep one stable order.
 */
export const messageStampOf = (sentAt: number, now: number, ref: string): MessageStamp => ({
    at: new Date(Math.min(sentAt, now)),
    tieMicros: hashOf(ref) % TIE_SLOTS,
})
