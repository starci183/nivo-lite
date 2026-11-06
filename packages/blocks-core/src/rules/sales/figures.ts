import type { Message } from "../../rows/message-text"

/** The counts of customers by stage, as the counts of a list read gives them. */
export type StageCounts = Readonly<Record<string, number>>

/** What the orders add up to: the drafts and the confirmed ones, each as a count and a sum of the amounts, VND. */
export interface OrderTotals {
    /** The draft orders. */
    readonly draftCount: number
    /** What the draft orders add up to, VND. */
    readonly draftVnd: number
    /** The orders the shop confirmed. */
    readonly closedCount: number
    /** What the confirmed orders add up to, VND. */
    readonly closedVnd: number
}

/** The figures of the sales overview. */
export interface SalesFigures {
    /** The customers still being won: new, qualified or at proposal. */
    readonly openCount: number
    /** The draft orders, which are the value on offer. */
    readonly proposalCount: number
    /** What the draft orders add up to, VND. */
    readonly proposalValueVnd: number
    /** The orders the shop confirmed. */
    readonly closedCount: number
    /** What the confirmed orders add up to, VND. */
    readonly closedValueVnd: number
    /** The share of closed customers that were won, as a fraction; 0 while none is closed. */
    readonly conversion: number
    /** The line under the open count. */
    readonly openHint: Message
    /** The line under the value on offer: how many deals it is spread over. */
    readonly proposalHint: Message
    /** The line under the closed count: what they add up to, in millions of VND. */
    readonly closedHint: Message
    /** The line under the conversion. */
    readonly conversionHint: Message
}

/** The message keys of the hint lines under the figures. */
export interface FigureHintKeys {
    /** The hint under the open deals figure. */
    readonly open: string
    /** The hint under the proposed value figure. */
    readonly proposal: string
    /** The hint under the closed this month figure. */
    readonly closed: string
    /** The hint under the conversion figure. */
    readonly conversion: string
}

/** The hint line each figure carries. */
export const FIGURE_HINT_KEYS: FigureHintKeys = {
    open: "fig_open_hint",
    proposal: "fig_proposal_hint",
    closed: "fig_closed_hint",
    conversion: "fig_conversion_hint",
}

const MILLION = 1_000_000

const OPEN_STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal"]

/** The sales figures from the customers per stage and what the orders add up to. */
export const salesFiguresOf = (stages: StageCounts, totals: OrderTotals): SalesFigures => {
    const won = stages.won ?? 0
    const decided = won + (stages.lost ?? 0)
    return {
        openCount: OPEN_STAGES.reduce((total, stage) => total + (stages[stage] ?? 0), 0),
        proposalCount: totals.draftCount,
        proposalValueVnd: totals.draftVnd,
        closedCount: totals.closedCount,
        closedValueVnd: totals.closedVnd,
        conversion: decided === 0 ? 0 : won / decided,
        openHint: { key: FIGURE_HINT_KEYS.open },
        proposalHint: { key: FIGURE_HINT_KEYS.proposal, values: { count: totals.draftCount } },
        closedHint: { key: FIGURE_HINT_KEYS.closed, values: { amount: Math.round(totals.closedVnd / MILLION) } },
        conversionHint: { key: FIGURE_HINT_KEYS.conversion },
    }
}
