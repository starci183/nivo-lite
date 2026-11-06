import type { InboxStatus } from "./conversation-status"

/** The conversations per inbox status, as the counts of the threads list give them. */
export type StatusCounts = Readonly<Partial<Record<InboxStatus, number>>>

/** The figures of the inbox overview. */
export interface ChatFigures {
    /** Every conversation. */
    readonly total: number
    /** The conversations the AI answers, as a share of all (a fraction); 0 while there is none. */
    readonly aiShare: number
    /** The customers who wait for a person. */
    readonly needsCount: number
    /** The conversations a person holds. */
    readonly handledCount: number
}

/** The inbox figures from the conversations per status. */
export const chatFiguresOf = (counts: StatusCounts): ChatFigures => {
    const ai = counts.ai ?? 0
    const needs = counts.needs ?? 0
    const handled = counts.handled ?? 0
    const total = ai + needs + handled
    return { total, aiShare: total === 0 ? 0 : ai / total, needsCount: needs, handledCount: handled }
}
