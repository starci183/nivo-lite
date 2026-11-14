import type { ChatMark } from "./conversation-status"

/** The conversations per stored mark, as the counts of the threads list give them. */
export type StatusCounts = Readonly<Partial<Record<ChatMark, number>>>

/**
 * The figures of the inbox overview. Who holds a thread is the engine's route hold (ruling R43), not a stored mark the list can count: the
 * held figure is the ENGINE's count of the routes a member holds now (`platform.route-holds` `held`, ruling R45); the marks count each chat
 * by its open question (`needs` or the AI's), a held one included.
 */
export interface ChatFigures {
    /** Every conversation. */
    readonly total: number
    /** The conversations no customer waits a person on, as a share of all (a fraction); 0 while there is none. */
    readonly aiShare: number
    /** The customers who wait for a person. */
    readonly needsCount: number
    /** The conversations a member of the shop holds now (the engine's route holds of the workspace). */
    readonly heldCount: number
}

/** The inbox figures from the conversations per stored mark and the engine's count of held routes. */
export const chatFiguresOf = (counts: StatusCounts, heldCount: number): ChatFigures => {
    const ai = counts.ai ?? 0
    const needs = counts.needs ?? 0
    const total = ai + needs
    return { total, aiShare: total === 0 ? 0 : ai / total, needsCount: needs, heldCount }
}
