import type { EntityApi, MeasureValue } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { Measure } from "../../../rules/sales/ledger/figures"
import type { RecentPayment } from "../../../rules/sales/ledger/recent"
import type { InstantRange } from "./accounting.types"
import { TRANSACTION_FIELDS, transactionOf } from "./accounting-records"

/** The rows of one page: the largest the engine serves. */
const PAGE_SIZE = 100

/** A number the engine answered for a measure; zero when the group is empty or the value is no number. */
const numberOf = (value: MeasureValue | undefined): number => {
    const parsed = typeof value === "number" ? value : Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

/** The money in of a range of instants, and the part of it tied to what it paid. */
export interface CreditsIn {
    /** Every payment received, matched or not. */
    readonly received: Measure
    /** The payments tied to an order. */
    readonly matched: Measure
}

/** The payments received in a range (money in), counted and summed, with the matched ones apart. */
export const creditsIn = async (transactions: EntityApi, range: InstantRange): Promise<CreditsIn> => {
    const inRange = q.and(
        q.eq("direction", "credit"),
        q.gte("occurredAt", range.fromIso),
        q.lt("occurredAt", range.toIso),
    )
    const matched = q.and(inRange, q.eq("status", "matched"))
    const [row] = await transactions.aggregate({
        measures: {
            count: { kind: "count", where: inRange },
            vnd: { kind: "sum", field: "amountVnd", where: inRange },
            matchedCount: { kind: "count", where: matched },
            matchedVnd: { kind: "sum", field: "amountVnd", where: matched },
        },
        limit: 1,
    })
    const measures = row?.measures ?? {}
    return {
        received: { count: numberOf(measures["count"]), vnd: numberOf(measures["vnd"]) },
        matched: { count: numberOf(measures["matchedCount"]), vnd: numberOf(measures["matchedVnd"]) },
    }
}

/** The payments received lately with the account each came in on, newest first, at most `limit`. */
export const recentCredits = async (transactions: EntityApi, limit: number): Promise<ReadonlyArray<RecentPayment>> => {
    const page = await transactions.list({
        select: [...TRANSACTION_FIELDS, "account"],
        where: q.eq("direction", "credit"),
        order: [
            ["occurredAt", "desc"],
            ["id", "desc"],
        ],
        page: { size: Math.min(limit, PAGE_SIZE) },
    })
    return page.rows.flatMap((listed) => {
        const payment = transactionOf(listed.row)
        const account = listed.row.data["account"]
        return payment === null ? [] : [{ payment, account: typeof account === "string" ? account : null }]
    })
}
