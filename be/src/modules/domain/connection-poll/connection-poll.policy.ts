import type { PollPage } from "./connection-poll.contracts"

/** The public fact of a connection that remembers how far the poll has read. */
export const POLL_CURSOR_KEY = "poll_seen_at"

/** How far back the first poll of a connection reads. */
export const POLL_BACKFILL_MS = 7 * 86_400_000

/** How much of the already-read past a poll reads again, so a transaction booked late is still found; the inbox ignores the repeats. */
export const POLL_OVERLAP_MS = 3_600_000

/** The most rows one page holds. */
export const POLL_PAGE_SIZE = 200

/** The most pages one connection reads in one run. */
export const POLL_MAX_PAGES = 20

/** The pause between two calls to a provider. */
export const POLL_PAUSE_MS = 600

/** The newest instant the poll has read for a connection, or undefined when it never read one or the fact is unreadable. */
export const cursorOf = (meta: Readonly<Record<string, string>>): Date | undefined => {
    const text = meta[POLL_CURSOR_KEY]
    if (text === undefined) return undefined
    const at = new Date(text)
    return Number.isNaN(at.getTime()) ? undefined : at
}

/** Where a poll starts reading: a little before the cursor, never further back than the backfill window. */
export const windowStartOf = (cursor: Date | undefined, now: Date): Date => {
    const floor = now.getTime() - POLL_BACKFILL_MS
    return new Date(cursor === undefined ? floor : Math.max(floor, cursor.getTime() - POLL_OVERLAP_MS))
}

/** The later of two instants; undefined stands for no instant. */
export const laterOf = (left: Date | undefined, right: Date | undefined): Date | undefined => {
    if (left === undefined) return right
    if (right === undefined) return left
    return right.getTime() > left.getTime() ? right : left
}

/**
 * The end of the next, older page, or undefined when the run is done: a page that is not full is the last one, and a page that
 * did not reach further back than the end it was asked for would be asked again forever.
 */
export const olderPageEnd = (
    page: Extract<PollPage<unknown>, { kind: "page" }>,
    limit: number,
    asked: Date | undefined,
): Date | undefined => {
    if (page.fetched < limit || page.oldestAt === undefined) return undefined
    return asked !== undefined && page.oldestAt.getTime() >= asked.getTime() ? undefined : page.oldestAt
}

/** The public facts of a connection with the cursor moved to `seenAt`. */
export const metaWithCursor = (
    meta: Readonly<Record<string, string>>,
    seenAt: Date,
): Readonly<Record<string, string>> => ({
    ...meta,
    [POLL_CURSOR_KEY]: seenAt.toISOString(),
})
