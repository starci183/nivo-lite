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
}

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
    }
}
