import { REASON_CODES, figureOf, isTestRunName, medianOf, splitCount, sumOf } from "@/hooks/overviewFigures"
import type { Governance, ReasonCode, WaitingWork } from "@/hooks/overviewFigures"
import type { DashboardType } from "@/modules/api"
import { MODULE_KEYS, MODULE_REGISTRY } from "@/modules/catalog"

/** The dashboard as the back end answers it. */
type Dashboard = DashboardType

/** The governance rows of the dashboard. */
type GovernanceRows = Dashboard["governance"]

/** A decision row as far as the test-run rule reads it. */
interface DecisionLinks {
    readonly workItemId?: string | null
    readonly leadId?: string | null
}

/** A payment row as far as the evidence rule reads it. */
interface PaymentEvidence {
    readonly status: string
    readonly invoiceId?: string | null
}

/** A governance enum as the back end names it ("WaitingDecision") in the snake_case the figures compare with ("waiting_decision"). */
const wire = (value: string | null | undefined): string =>
    (value ?? "").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()

const MINUTE_MS = 60_000
const RECENT_LIMIT = 5

const reasonOf = (value: string | null | undefined): ReasonCode | null =>
    REASON_CODES.find((reason) => reason === wire(value)) ?? null

const has = (ids: ReadonlySet<string>, id: string | null | undefined): boolean =>
    id !== null && id !== undefined && ids.has(id)

const isEvidenced = (payment: PaymentEvidence): boolean =>
    payment.status === "matched" && payment.invoiceId !== null && payment.invoiceId !== undefined

/** The ids of the records that belong to a test run, propagated lead to order to invoice to payment and lead to work to decision. */
const testRunIds = (rows: GovernanceRows) => {
    const leads = new Set(rows.leads.filter((x) => isTestRunName(x.contactName, x.company)).map((x) => x.id))
    const orders = new Set(
        rows.orders.filter((x) => has(leads, x.leadId) || isTestRunName(x.items, x.orderNo)).map((x) => x.id),
    )
    const invoices = new Set(
        rows.invoices
            .filter((x) => has(leads, x.leadId) || has(orders, x.orderId) || isTestRunName(x.invoiceNo))
            .map((x) => x.id),
    )
    const work = new Set(
        rows.work
            .filter((x) => has(leads, x.leadId) || isTestRunName(x.summary, x.contact, x.customer))
            .map((x) => x.id),
    )
    return { leads, orders, invoices, work }
}

/** The departments that get a tile: the stable modules, and any other module once it has work. */
const departmentsOf = (work: GovernanceRows["work"], since7: string): Governance["departments"] =>
    MODULE_KEYS.map((key) => MODULE_REGISTRY[key])
        .filter((module) => module.status === "stable" || work.some((x) => x.department === module.key))
        .map((module) => {
            const mine = work.filter((x) => x.department === module.key)
            return {
                department: module.key,
                done7d: mine.filter((x) => wire(x.status) === "done" && (x.completedAt ?? "") >= since7).length,
                waiting: mine.filter((x) => wire(x.status) === "waiting_decision").length,
                lastActivityAt: mine.reduce<string | null>(
                    (latest, x) => (latest === null || x.updatedAt > latest ? x.updatedAt : latest),
                    null,
                ),
            }
        })

/** The exception counts of the open work, by reason and failed. */
const exceptionsOf = (work: GovernanceRows["work"]): Governance["exceptions"] => {
    const counts: Governance["exceptions"] = {
        routine: 0,
        missing_data: 0,
        over_authority: 0,
        unclear_outcome: 0,
        not_allowed: 0,
        failed: 0,
    }
    for (const x of work) {
        const reason = reasonOf(x.reason)
        if (wire(x.status) === "failed") counts.failed += 1
        else if (wire(x.status) === "waiting_decision" && reason !== null) counts[reason] += 1
    }
    return counts
}

/** The governance figures from the dashboard rows; `since7` is the start of the 7-day window they were read with. Test runs are excluded. */
export const governanceFrom = (rows: GovernanceRows, since7: string): Governance => {
    const test = testRunIds(rows)
    const leads = rows.leads.filter((x) => !test.leads.has(x.id))
    const orders = rows.orders.filter((x) => !test.orders.has(x.id))
    const invoices = rows.invoices.filter((x) => !test.invoices.has(x.id))
    const payments = rows.transactions.filter(
        (x) => !has(test.invoices, x.invoiceId) && !isTestRunName(x.payer, x.reference),
    )
    const matched = payments.filter(isEvidenced)
    const newLeads = leads.filter((x) => x.createdAt >= since7)
    const work = rows.work.filter((x) => !test.work.has(x.id))
    const isTestDecision = (d: DecisionLinks) => has(test.leads, d.leadId) || has(test.work, d.workItemId)
    const decisions = rows.decisions7.filter((d) => !isTestDecision(d))
    const createdByItem = new Map(work.map((x) => [x.id, x.createdAt]))
    const waits = decisions.flatMap((d) => {
        const created = d.workItemId ? createdByItem.get(d.workItemId) : undefined
        return wire(d.deciderKind) !== "policy" && created !== undefined
            ? [(Date.parse(d.createdAt) - Date.parse(created)) / MINUTE_MS]
            : []
    })
    const median = medianOf(waits)
    const won = leads.filter((x) => x.stage === "won")
    const everything = [...orders, ...invoices, ...matched, ...newLeads]
    const authority = rows.authority
    return {
        goals: {
            revenueVnd: authority?.goalRevenueVnd ?? null,
            newCustomers: authority?.goalNewCustomers ?? null,
            firstReplyMinutes: authority?.goalFirstReplyMinutes ?? null,
        },
        results: {
            confirmedVnd: sumOf(orders),
            invoicedVnd: sumOf(invoices),
            collectedVnd: sumOf(matched),
            ordersConfirmed: orders.length,
            newCustomers7d: newLeads.length,
            wonCustomers: won.length,
            simulated: everything.filter((x) => x.origin === "simulated").length,
            total: everything.length,
        },
        status: {
            confirmedOrders: figureOf(orders),
            internalInvoices: figureOf(invoices),
            matchedPayments: figureOf(matched),
            pendingVerification: figureOf(payments.filter((x) => !isEvidenced(x))),
            newLeads7d: splitCount(newLeads),
            wonLeads: splitCount(won),
            excludedTestRecords:
                test.leads.size +
                test.orders.size +
                test.invoices.size +
                (rows.transactions.length - payments.length) +
                test.work.size,
        },
        efficiency: {
            autoDone7d: decisions.filter((d) => wire(d.deciderKind) === "policy" && wire(d.outcome) === "auto_done")
                .length,
            askedHuman7d: work.filter(
                (x) =>
                    x.createdAt >= since7 && (wire(x.decidedPath) === "human" || wire(x.status) === "waiting_decision"),
            ).length,
            medianDecisionMinutes: median === null ? null : Math.round(median),
        },
        // Counted once: waiting work items (test runs excluded) + legacy pending approvals that have no work item.
        pendingDecisions: work.filter((x) => wire(x.status) === "waiting_decision").length + rows.pendingWithoutWork,
        exceptions: exceptionsOf(work),
        departments: departmentsOf(work, since7),
        recentDecisions: rows.recent
            .filter((d) => !isTestDecision(d) && !isTestRunName(d.leadName))
            .slice(0, RECENT_LIMIT)
            .map((d) => ({
                id: d.id,
                action: d.action,
                department: d.department,
                decidedBy: d.decidedBy,
                deciderKind: d.deciderKind,
                outcome: d.outcome,
                leadName: d.leadName ?? null,
                createdAt: d.createdAt,
            })),
    }
}

/** The work items waiting for a decision, oldest first, test runs left out. */
export const waitingWorkFrom = (exceptions: Dashboard["exceptions"]): Array<WaitingWork> =>
    exceptions
        .filter(
            (x) =>
                wire(x.status) === "waiting_decision" &&
                !isTestRunName(x.lead?.contactName, x.lead?.company, x.summary, x.contact, x.customer),
        )
        .map((x) => ({
            id: x.id,
            action: x.action,
            department: x.department,
            reason: reasonOf(x.reason),
            isSimulated: x.origin === "simulated",
            summary: x.summary ?? null,
            leadName: x.lead?.contactName ?? null,
        }))
