import { InvoiceEntity } from "@modules/domain/invoices"
import { InboundEventEntity } from "@modules/domain/inbound-events"
import { ContractEntity } from "@modules/domain/contracts"
import { LeadEntity } from "@modules/domain/leads"
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm"
import type {
    ExpiringItemFacts,
    RenewalCashFacts,
    RenewalInvoiceItemFacts,
    RenewalPaidItemFacts,
    UnmatchedItemFacts,
    UnpaidItemFacts,
} from "./renewal-cash.contracts"

/** What the reader is asked: the window in Vietnam, the first day and horizon day, and how many items each list holds. */
export interface RenewalCashQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** Start of the window. */
    readonly from: Date
    /** End of the window, exclusive. */
    readonly to: Date
    /** The first day, `yyyy-mm-dd`. */
    readonly day: string
    /** The horizon day, `yyyy-mm-dd`. */
    readonly horizonDay: string
    /** How many items each list holds. */
    readonly bound: number
}

/** The count and the total of one part of the story. */
interface Tally {
    readonly count: number
    readonly total: number
}

/** One part of the story: every row counted and totalled, and the first rows listed. */
interface Part<T> {
    readonly tally: Tally
    readonly items: Array<T>
}

/** A statement over the invoices, contracts, leads and inbound events of the workspace, tables other capabilities own. */
type Statement = SelectQueryBuilder<ObjectLiteral>

const VN_ZONE = "Asia/Ho_Chi_Minh"

/** The count and the total of every row `rows` selects, whatever the list bound. */
const tallyOf = async (rows: Statement, amount: string): Promise<Tally> => {
    const tally = await rows
        .select("count(*)::int", "count")
        .addSelect(`coalesce(sum(${amount}), 0)::float8`, "total")
        .getRawOne<Tally>()
    return tally ?? { count: 0, total: 0 }
}

const invoicesOf = (manager: EntityManager, query: RenewalCashQuery): Statement =>
    manager
        .createQueryBuilder(InvoiceEntity, "i")
        .where("i.workspace_id = :workspaceId", { workspaceId: query.workspaceId })

const renewalsOf = (manager: EntityManager, query: RenewalCashQuery): Statement =>
    invoicesOf(manager, query).innerJoin(
        ContractEntity,
        "c",
        "c.id = i.contract_id AND c.workspace_id = i.workspace_id",
    )

/** The renewal invoices issued in the window. */
const issuedOf = async (manager: EntityManager, query: RenewalCashQuery): Promise<Part<RenewalInvoiceItemFacts>> => {
    const issued = (): Statement =>
        renewalsOf(manager, query)
            .andWhere("i.status <> 'cancelled'")
            .andWhere("i.issued_at >= :from AND i.issued_at < :to", { from: query.from, to: query.to })
    const tally = await tallyOf(issued(), "i.amount_vnd")
    const items = await issued()
        .select([
            "i.invoice_no AS invoice_no",
            "i.amount_vnd::float8 AS amount_vnd",
            "c.customer_name AS customer_name",
        ])
        .orderBy("i.issued_at", "ASC")
        .addOrderBy("i.invoice_no", "ASC")
        .limit(query.bound)
        .getRawMany<RenewalInvoiceItemFacts>()
    return { tally, items }
}

/** The renewal invoices paid in the window, with the contract end date now. */
const paidOf = async (manager: EntityManager, query: RenewalCashQuery): Promise<Part<RenewalPaidItemFacts>> => {
    const paid = (): Statement =>
        renewalsOf(manager, query)
            .andWhere("i.status = 'paid'")
            .andWhere("i.paid_at >= :from AND i.paid_at < :to", { from: query.from, to: query.to })
    const tally = await tallyOf(paid(), "i.amount_vnd")
    const items = await paid()
        .select([
            "i.invoice_no AS invoice_no",
            "i.amount_vnd::float8 AS amount_vnd",
            "c.customer_name AS customer_name",
            "c.ends_on::text AS ends_on",
            "(c.ends_on > i.period_ends_on) AS extended",
        ])
        .orderBy("i.paid_at", "ASC")
        .addOrderBy("i.invoice_no", "ASC")
        .limit(query.bound)
        .getRawMany<RenewalPaidItemFacts>()
    return { tally, items }
}

/** The invoices still unpaid that fall due before the horizon. */
const unpaidOf = async (manager: EntityManager, query: RenewalCashQuery): Promise<Part<UnpaidItemFacts>> => {
    const unpaid = (): Statement =>
        invoicesOf(manager, query)
            .leftJoin(ContractEntity, "c", "c.id = i.contract_id AND c.workspace_id = i.workspace_id")
            .leftJoin(LeadEntity, "l", "l.id = i.lead_id AND l.workspace_id = i.workspace_id")
            .andWhere("i.status = 'issued' AND i.due_at IS NOT NULL")
            .andWhere(`i.due_at < (:horizonDay::date + 1)::timestamp AT TIME ZONE '${VN_ZONE}'`, {
                horizonDay: query.horizonDay,
            })
    const tally = await tallyOf(unpaid(), "i.amount_vnd")
    const items = await unpaid()
        .select([
            "i.invoice_no AS invoice_no",
            "i.amount_vnd::float8 AS amount_vnd",
            "coalesce(c.customer_name, l.contact_name) AS customer_name",
            `to_char(i.due_at AT TIME ZONE '${VN_ZONE}', 'YYYY-MM-DD') AS due_on`,
        ])
        .orderBy("i.due_at", "ASC")
        .addOrderBy("i.invoice_no", "ASC")
        .limit(query.bound)
        .getRawMany<UnpaidItemFacts>()
    return { tally, items }
}

/** The active contracts ending before the horizon with no renewal invoice for their period. */
const expiringOf = async (manager: EntityManager, query: RenewalCashQuery): Promise<Part<ExpiringItemFacts>> => {
    const expiring = (): Statement =>
        manager
            .createQueryBuilder(ContractEntity, "c")
            .where("c.workspace_id = :workspaceId AND c.status = 'active'", { workspaceId: query.workspaceId })
            .andWhere("c.ends_on >= :day::date AND c.ends_on <= :horizonDay::date", {
                day: query.day,
                horizonDay: query.horizonDay,
            })
            .andWhere(
                (outer) =>
                    `NOT EXISTS ${outer
                        .subQuery()
                        .select("1")
                        .from(InvoiceEntity, "i")
                        .where(
                            "i.workspace_id = c.workspace_id AND i.contract_id = c.id AND i.period_ends_on = c.ends_on",
                        )
                        .andWhere("i.status <> 'cancelled'")
                        .getQuery()}`,
            )
    const tally = await tallyOf(expiring(), "c.amount_vnd")
    const items = await expiring()
        .select([
            "c.customer_name AS customer_name",
            "c.plan AS plan",
            "c.ends_on::text AS ends_on",
            "c.amount_vnd::float8 AS amount_vnd",
        ])
        .orderBy("c.ends_on", "ASC")
        .addOrderBy("c.customer_name", "ASC")
        .limit(query.bound)
        .getRawMany<ExpiringItemFacts>()
    return { tally, items }
}

/** The payments received that still wait for a decision. */
const unmatchedOf = async (manager: EntityManager, query: RenewalCashQuery): Promise<Part<UnmatchedItemFacts>> => {
    const unmatched = (): Statement =>
        manager
            .createQueryBuilder(InboundEventEntity, "e")
            .where("e.workspace_id = :workspaceId AND e.kind = 'payment' AND e.status = 'needs_decision'", {
                workspaceId: query.workspaceId,
            })
    const tally = await tallyOf(unmatched(), "e.amount_vnd")
    const items = await unmatched()
        .select([
            "e.amount_vnd::float8 AS amount_vnd",
            "e.sender_name AS sender_name",
            "coalesce(e.external_ref, e.body) AS memo",
        ])
        .orderBy("e.created_at", "ASC")
        .limit(query.bound)
        .getRawMany<UnmatchedItemFacts>()
    return { tally, items }
}

/**
 * The renewal-to-cash story of a window, read only, in one snapshot: the renewal invoices issued in it, the renewal invoices paid
 * in it with the contract end date now, the invoices still unpaid that fall due before the horizon, the active contracts ending
 * before the horizon with no renewal invoice for their period, and the payments received that still wait for a decision. Each
 * list is bounded; the counts and totals cover every row.
 */
export const readRenewalCash = (entityManager: EntityManager, query: RenewalCashQuery): Promise<RenewalCashFacts> =>
    entityManager.transaction("REPEATABLE READ", async (manager) => {
        const issued = await issuedOf(manager, query)
        const paid = await paidOf(manager, query)
        const unpaid = await unpaidOf(manager, query)
        const expiring = await expiringOf(manager, query)
        const unmatched = await unmatchedOf(manager, query)
        return {
            issued_count: issued.tally.count,
            issued_total: issued.tally.total,
            issued: issued.items,
            paid_count: paid.tally.count,
            paid_total: paid.tally.total,
            paid: paid.items,
            unpaid_count: unpaid.tally.count,
            unpaid_total: unpaid.tally.total,
            unpaid: unpaid.items,
            expiring_count: expiring.tally.count,
            expiring_total: expiring.tally.total,
            expiring: expiring.items,
            unmatched_count: unmatched.tally.count,
            unmatched_total: unmatched.tally.total,
            unmatched: unmatched.items,
        }
    })
