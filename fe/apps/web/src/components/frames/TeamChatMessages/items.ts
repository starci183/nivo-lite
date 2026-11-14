import type { TeamChatMessageRow } from "@/modules/types"

/** One thing the thread draws: its first message, and the identical notices folded into it (the one message when nothing folded). */
interface ThreadItem {
    readonly first: TeamChatMessageRow
    readonly rows: ReadonlyArray<TeamChatMessageRow>
}

/** A notice an agent or the system repeats: a line of theirs with nothing else on it (no card, no file, no answer to another). */
const isNotice = (row: TeamChatMessageRow): boolean =>
    row.side === "incoming" &&
    row.card === null &&
    row.stop == null &&
    row.backgroundStopped == null &&
    row.brainChange == null &&
    row.files.length === 0 &&
    row.replyTo === null &&
    row.forwardedFrom === null &&
    (row.kind === "system" || row.author?.kind === "agent")

/** The row repeats the notice that opens the run: same author, same words, same day. */
const repeats = (first: TeamChatMessageRow, row: TeamChatMessageRow): boolean =>
    isNotice(row) && row.dayLabel === null && row.authorName === first.authorName && row.body === first.body

/** The rows as the thread draws them: a run of identical notices folds into its first one when the thread may fold. */
export const itemsOf = (rows: ReadonlyArray<TeamChatMessageRow>, canFold: boolean): ReadonlyArray<ThreadItem> => {
    const items: ThreadItem[] = []
    for (const row of rows) {
        const last = items.at(-1)
        if (canFold && last !== undefined && isNotice(last.first) && repeats(last.first, row)) {
            items[items.length - 1] = { first: last.first, rows: [...last.rows, row] }
        } else {
            items.push({ first: row, rows: [row] })
        }
    }
    return items
}
