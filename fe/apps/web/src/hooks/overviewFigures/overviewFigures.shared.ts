import type { ReasonCode } from "@/modules/types"
/** Every reason, to narrow a text from the wire. */
export const REASON_CODES: ReadonlyArray<ReasonCode> = [
    "routine",
    "missing_data",
    "over_authority",
    "unclear_outcome",
    "not_allowed",
]

/** Amounts or counts split by where the records came from. `unlabelled` = rows with no origin (older seed or legacy leads). */
export interface OriginSplit {
    live: number
    simulated: number
    unlabelled: number
}

/** One status figure: money and record count, each split by origin. Never summed into one headline. */
export interface StatusFigure {
    vnd: OriginSplit
    count: OriginSplit
}

/** Results reported by status, each with the evidence it rests on, test runs excluded. */
export interface StatusResults {
    /** Orders confirmed by NIVO or a person (status confirmed, invoiced or paid). */
    confirmedOrders: StatusFigure
    /** Internal payment records (invoices issued or paid). No e-invoice is issued by this build. */
    internalInvoices: StatusFigure
    /** Payments matched to an internal invoice. */
    matchedPayments: StatusFigure
    /** Money received but not verified yet: unmatched, needs review, or matched without an invoice link. */
    pendingVerification: StatusFigure
    newLeads7d: OriginSplit
    wonLeads: OriginSplit
    /** Records dropped by the test-run rule (leads, orders, invoices, payments, work items). */
    excludedTestRecords: number
}

/** One decision of the history. */
export interface GovDecisionRow {
    readonly id: string
    readonly action: string
    readonly department: string
    readonly decidedBy: string
    readonly deciderKind: string
    readonly outcome: string
    readonly leadName: string | null
    readonly createdAt: string
}

/** The owner governance figures: goals vs results by status, auto vs asked, pending decisions, exceptions, departments. */
export interface Governance {
    goals: { revenueVnd: number | null; newCustomers: number | null; firstReplyMinutes: number | null }
    results: {
        confirmedVnd: number
        invoicedVnd: number
        collectedVnd: number
        ordersConfirmed: number
        newCustomers7d: number
        wonCustomers: number
        simulated: number
        total: number
    }
    status: StatusResults
    efficiency: { autoDone7d: number; askedHuman7d: number; medianDecisionMinutes: number | null }
    pendingDecisions: number
    exceptions: Record<ReasonCode | "failed", number>
    departments: Array<{ department: string; done7d: number; waiting: number; lastActivityAt: string | null }>
    recentDecisions: Array<GovDecisionRow>
}

/** A work item waiting for the owner, as the overview lists it. */
export interface WaitingWork {
    readonly id: string
    readonly action: string
    readonly department: string
    readonly reason: ReasonCode | null
    readonly isSimulated: boolean
    readonly summary: string | null
    readonly leadName: string | null
}

/**
 * TEST-RUN RULE. A record is test data when a name it carries matches /UAT|DBG/: the UAT scripts tag every sender, payer,
 * reference and item with "UAT-xxxx"; debug runs use "DBG". Records linked to a test lead, order, invoice or work item
 * inherit the flag, and test records are excluded from every dashboard figure. Case-sensitive on purpose.
 */
const TEST_RUN_PATTERN = /UAT|DBG/

/** True when any of the given names marks a test run. */
export const isTestRunName = (...names: ReadonlyArray<string | null | undefined>): boolean =>
    names.some((name) => typeof name === "string" && TEST_RUN_PATTERN.test(name))

type Nullable<Value> = Value | null | undefined

/** A record that carries an origin and an amount. */
export interface MoneyRow {
    readonly origin?: string | null
    readonly amountVnd?: number | null
}

const emptySplit = (): OriginSplit => ({ live: 0, simulated: 0, unlabelled: 0 })

const originKey = (origin: Nullable<string>): keyof OriginSplit => {
    if (origin === "live") return "live"
    return origin === "simulated" ? "simulated" : "unlabelled"
}

/** Counts rows by origin. */
export const splitCount = (rows: ReadonlyArray<MoneyRow>): OriginSplit => {
    const split = emptySplit()
    for (const row of rows) split[originKey(row.origin)] += 1
    return split
}

/** Money and count of rows, each split by origin. */
export const figureOf = (rows: ReadonlyArray<MoneyRow>): StatusFigure => {
    const vnd = emptySplit()
    for (const row of rows) vnd[originKey(row.origin)] += row.amountVnd ?? 0
    return { vnd, count: splitCount(rows) }
}

/** The total amount of rows. */
export const sumOf = (rows: ReadonlyArray<MoneyRow>): number =>
    rows.reduce((total, row) => total + (row.amountVnd ?? 0), 0)

/** The median of the numbers, or null when there are none. */
export const medianOf = (values: ReadonlyArray<number>): number | null => {
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    const upper = sorted[middle]
    const lower = sorted[middle - 1]
    if (upper === undefined) return null
    return sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper
}
