import type { GovFormat, GovTranslator } from "@/hooks/overviewGov"
import type { Governance } from "@/hooks/overviewFigures"

/** One status: what it is and what it rests on, then its figure and, for money, the record count. */
export interface GovStatusRow {
    readonly id: string
    readonly label: string
    readonly context: string
    readonly value: string
    readonly count: string | null
}

/** The money text of an amount of dong. */
const moneyOf = (format: GovFormat, amount: number): string =>
    format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })

interface StatusRowInput {
    id: string
    label: string
    context: string
    value: number
    count: number
    unit: string
    money: boolean
}

/** One status row; money rows show the record count under the amount. */
const statusRowOf = (t: GovTranslator, format: GovFormat, row: StatusRowInput): GovStatusRow => ({
    id: row.id,
    label: row.label,
    context: row.context,
    value: row.money ? moneyOf(format, row.value) : format.number(row.value),
    count: row.money ? t(row.unit, { n: format.number(row.count) }) : null,
})

/** The six status rows of the results block. */
export const statusRowsOf = (
    t: GovTranslator,
    format: GovFormat,
    governance: Governance,
): ReadonlyArray<GovStatusRow> => {
    const s = governance.status
    const make = (id: string, key: string, value: number, count: number, unit: string, money: boolean) =>
        statusRowOf(t, format, { id, label: t(key), context: t(`${key}Ctx`), value, count, unit, money })
    return [
        make("confirmed", "resultsConfirmed", s.confirmedOrders.vnd, s.confirmedOrders.count, "countOrders", true),
        make("invoiced", "resultsInvoiced", s.internalInvoices.vnd, s.internalInvoices.count, "countRecords", true),
        make("collected", "resultsCollected", s.matchedPayments.vnd, s.matchedPayments.count, "countPayments", true),
        make(
            "pending",
            "resultsPending",
            s.pendingVerification.vnd,
            s.pendingVerification.count,
            "countPayments",
            true,
        ),
        make("new", "resultsNew", s.newLeads7d, s.newLeads7d, "countLeads", false),
        make("won", "resultsWon", s.wonLeads, s.wonLeads, "countLeads", false),
    ]
}

/** The goal lines: the figure against the goal, or the words that the goal is not set. */
export const goalLinesOf = (
    t: GovTranslator,
    format: GovFormat,
    governance: Governance,
): ReadonlyArray<{ readonly id: string; readonly text: string; readonly isSet: boolean }> => {
    const { goals, status } = governance
    return [
        {
            id: "revenue",
            isSet: goals.revenueVnd !== null,
            text:
                goals.revenueVnd === null
                    ? t("goalRevenueNone")
                    : t("goalRevenue", {
                          value: moneyOf(format, status.matchedPayments.vnd),
                          goal: moneyOf(format, goals.revenueVnd),
                      }),
        },
        {
            id: "customers",
            isSet: goals.newCustomers !== null,
            text:
                goals.newCustomers === null
                    ? t("goalCustomersNone")
                    : t("goalCustomers", {
                          value: format.number(status.newLeads7d),
                          goal: format.number(goals.newCustomers),
                      }),
        },
    ]
}
