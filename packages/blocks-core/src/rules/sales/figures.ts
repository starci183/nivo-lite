import { CONFIRMED_STATUSES } from "./order-status"
import type { OrderStatus } from "./order-status"

/** The counts of customers by stage, as the counts of a list read gives them. */
export type StageCounts = Readonly<Record<string, number>>

/** The part of an order the figures add up. */
export interface FigureOrder {
    /** Where the order stands. */
    readonly status: OrderStatus
    /** The amount, VND, or null while unknown. */
    readonly amountVnd: number | null
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

const sumOf = (orders: ReadonlyArray<FigureOrder>): number =>
    orders.reduce((total, order) => total + (order.amountVnd ?? 0), 0)

/** The sales figures from the customers per stage and the orders. */
export const salesFiguresOf = (stages: StageCounts, orders: ReadonlyArray<FigureOrder>): SalesFigures => {
    const drafts = orders.filter((order) => order.status === "draft")
    const closed = orders.filter((order) => CONFIRMED_STATUSES.includes(order.status))
    const won = stages.won ?? 0
    const decided = won + (stages.lost ?? 0)
    return {
        openCount: OPEN_STAGES.reduce((total, stage) => total + (stages[stage] ?? 0), 0),
        proposalCount: drafts.length,
        proposalValueVnd: sumOf(drafts),
        closedCount: closed.length,
        closedValueVnd: sumOf(closed),
        conversion: decided === 0 ? 0 : won / decided,
    }
}
