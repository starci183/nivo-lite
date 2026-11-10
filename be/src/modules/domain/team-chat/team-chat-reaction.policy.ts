import type { ChatMemberRef } from "./team-chat.contracts"
import type { ReactionHeld, ReactionRow, ReactionView } from "./team-chat-reaction.contracts"

/** The reactions of the picker, in the order it shows them: heart, thumbs up, laughing, surprised, crying, angry. */
export const REACTION_EMOJI: ReadonlyArray<string> = [
    "\u2764\uFE0F",
    "\u{1F44D}",
    "\u{1F606}",
    "\u{1F62E}",
    "\u{1F622}",
    "\u{1F621}",
]

/** The most taps one call carries: a client batches the taps of a burst and sends them as one call. */
export const TIMES_MAX = 30

/** The most times one member taps one emoji on one message; the database check holds the same bound. */
export const COUNT_MAX = 999

/** The least milliseconds between two calls of one member on one emoji of one message; a faster call is refused. */
export const MIN_GAP_MS = 100

/** How many taps a human can mean per second: a call that follows an earlier one is trusted with this many taps for each second between them. */
export const TAPS_PER_SECOND = 12

/** The longest quote of a reply, in characters. */
export const QUOTE_MAX = 140

const VARIATION_SELECTOR = /\uFE0F/gu

/** The emoji as the picker spells it when it is one of the picker, else null: a heart with or without the variation selector is the same heart. */
export const canonicalEmojiOf = (raw: string): string | null => {
    const bare = raw.replaceAll(VARIATION_SELECTOR, "")
    return REACTION_EMOJI.find((emoji) => emoji.replaceAll(VARIATION_SELECTOR, "") === bare) ?? null
}

/** How many taps a call asks for: a whole number from one to the bound of a call; a missing or odd count is one tap. */
export const timesOf = (raw: number | null | undefined): number => {
    const whole = Math.trunc(raw ?? 1)
    return Number.isFinite(whole) ? Math.min(TIMES_MAX, Math.max(1, whole)) : 1
}

/**
 * How many of the asked taps are counted. The first call on an emoji counts up to the bound of a call; a later one is refused (0)
 * when it follows the last within the minimum gap, else it counts about what a human can tap in the time between the two calls
 * (never fewer than one); the total of a member on one emoji never passes the bound, and what is over is dropped.
 */
export const tapsAcceptedOf = (times: number, held: ReactionHeld | null): number => {
    const left = COUNT_MAX - (held?.count ?? 0)
    if (left <= 0) return 0
    if (held === null) return Math.min(times, TIMES_MAX, left)
    if (held.idleMs < MIN_GAP_MS) return 0
    const budget = Math.min(TIMES_MAX, 1 + Math.floor((held.idleMs * TAPS_PER_SECOND) / 1000))
    return Math.min(times, budget, left)
}

const orderOf = (emoji: string): number => {
    const index = REACTION_EMOJI.indexOf(emoji)
    return index === -1 ? REACTION_EMOJI.length : index
}

/** The emoji of one message summed over the members: the most tapped first, ties in the order of the picker; `mine` is the viewer's own taps. */
export const reactionsOf = (rows: ReadonlyArray<ReactionRow>, viewer: ChatMemberRef): Array<ReactionView> => {
    const sums = new Map<string, { count: number; mineCount: number }>()
    for (const row of rows) {
        const sum = sums.get(row.emoji) ?? { count: 0, mineCount: 0 }
        const isViewer = row.memberKind === viewer.memberKind && row.memberId === viewer.memberId
        sums.set(row.emoji, {
            count: sum.count + row.count,
            mineCount: sum.mineCount + (isViewer ? row.count : 0),
        })
    }
    return [...sums.entries()]
        .map(([emoji, sum]) => ({ emoji, count: sum.count, mine: sum.mineCount > 0, mineCount: sum.mineCount }))
        .toSorted((left, right) => right.count - left.count || orderOf(left.emoji) - orderOf(right.emoji))
}

/** The reactions of many messages, by message id; a message with none has no entry. */
export const reactionsByMessageOf = (
    rows: ReadonlyArray<ReactionRow>,
    viewer: ChatMemberRef,
): Map<string, Array<ReactionView>> => {
    const byMessage = new Map<string, Array<ReactionRow>>()
    for (const row of rows) byMessage.set(row.messageId, [...(byMessage.get(row.messageId) ?? []), row])
    return new Map([...byMessage.entries()].map(([id, held]) => [id, reactionsOf(held, viewer)]))
}

/** The words a reply quotes: the body on one line, cut to the bound with an ellipsis. */
export const quoteBodyOf = (body: string): string => {
    const line = body.replaceAll(/\s+/gu, " ").trim()
    return line.length <= QUOTE_MAX ? line : `${line.slice(0, QUOTE_MAX - 1)}\u2026`
}
