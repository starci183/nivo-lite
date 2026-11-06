import type { ChatMessageStamp } from "./chat-records.contracts"

/** Messages of one millisecond are told apart by up to this many microseconds. */
const TIE_SLOTS = 1000

/** Digits of the microsecond tail of a stamped time. */
const TIE_DIGITS = 3

/** A number from a text that is the same for the same text: FNV-1a over its code points. */
const hashOf = (text: string): number =>
    [...text].reduce((hash, char) => Math.imul(hash ^ Number(char.codePointAt(0)), 16_777_619) >>> 0, 2_166_136_261)

/**
 * When a message the channel timed itself happened: that time, but never later than `now` (a clock that runs ahead must not put a message in the
 * future), with a tie-break from the channel's own id of the message, so messages of the same millisecond keep one stable order.
 */
export const chatStampOf = (sentAt: number, now: number, ref: string): ChatMessageStamp => ({
    at: new Date(Math.min(sentAt, now)),
    tieMicros: hashOf(ref) % TIE_SLOTS,
})

/** The ISO 8601 text a line is stored at: the stamp's time with its microsecond tail, or the time it was stored when the channel gave none. */
export const sentAtOf = (stamp: ChatMessageStamp | null, now: Date): string => {
    if (stamp === null) return now.toISOString()
    const micros = String(stamp.tieMicros).padStart(TIE_DIGITS, "0")
    return stamp.at.toISOString().replace("Z", `${micros}Z`)
}
