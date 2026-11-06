import type { AggregateRow, EntityApi, EntityQuery, MeasureValue, PageRow } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { OrderBy } from "@nivo-lite/agent-sdk/query"
import type {
    AdjustmentRecord,
    AdjustmentTarget,
    BookEntryKind,
    BookEntryRecord,
    ClaimRecord,
    InvoiceRecord,
    OrderRecord,
    TransactionRecord,
} from "../../rules/accounting/accounting.types"
import type { KindTotal, Measure, OpenInvoice } from "../../rules/accounting/figures"
import type { DayRange, InstantRange, TargetStores } from "./accounting.types"
import {
    CLAIM_FIELDS,
    INVOICE_FIELDS,
    LEAD_NAME_FIELDS,
    ORDER_FIELDS,
    adjustmentOf,
    bookEntryOf,
    claimOf,
    invoiceOf,
    leadNameOf,
    openInvoiceOf,
    orderOf,
    transactionOf,
} from "./accounting-records"

/** The most corrections one record carries that a lineage lists. */
export const ADJUSTMENTS_MAX = 100

/** The rows of one page the paged reads ask for: the engine's largest. */
const PAGE_SIZE = 100

/** The most pages of conversations a lookup of a customer's last conversation reads. */
export const CONVERSATION_PAGES_MAX = 5

/** The fields of a correction a query selects. */
const ADJUSTMENT_FIELDS: ReadonlyArray<string> = ["targetType", "targetId", "note", "correctedAmountVnd", "createdBy"]

/** The order of a query of one record: by its id. */
const BY_ID: OrderBy = [["id", "asc"]]

/** The query of one record by id, with the fields and the toOne records joined in. */
const oneOf = (
    id: string,
    select: ReadonlyArray<string>,
    join: Readonly<Record<string, ReadonlyArray<string>>>,
): EntityQuery => ({ select, join, where: q.eq("id", id), order: BY_ID, page: { size: 1 } })

/** The first row of a page of one record. */
const firstOf = (rows: ReadonlyArray<PageRow>): PageRow | null => rows[0] ?? null

/** A number the engine answered for a measure: a count, or a sum that may travel as text; zero when the group is empty. */
const numberOf = (value: MeasureValue | undefined): number => {
    const parsed = typeof value === "number" ? value : Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

/** One payment; null when there is none or it is not one. */
export const transactionById = async (transactions: EntityApi, id: string): Promise<TransactionRecord | null> => {
    const found = await transactions.get(id)
    return found === null ? null : transactionOf(found)
}

/** One order with the id of its lead; null when there is none. */
export const orderById = async (orders: EntityApi, id: string): Promise<OrderRecord | null> => {
    const page = await orders.list(oneOf(id, ORDER_FIELDS, { lead: LEAD_NAME_FIELDS }))
    const found = firstOf(page.rows)
    return found === null ? null : orderOf(found)
}

/** One claim with the ids of its order and conversation; null when there is none. */
export const claimById = async (claims: EntityApi, id: string): Promise<ClaimRecord | null> => {
    const page = await claims.list(oneOf(id, CLAIM_FIELDS, { order: ["orderNo"], conversation: ["name"] }))
    const found = firstOf(page.rows)
    return found === null ? null : claimOf(found)
}

/** One invoice with its customer's name; null when there is none. */
export const invoiceById = async (invoices: EntityApi, id: string): Promise<InvoiceRecord | null> => {
    const page = await invoices.list(oneOf(id, INVOICE_FIELDS, { lead: LEAD_NAME_FIELDS }))
    const found = firstOf(page.rows)
    return found === null ? null : invoiceOf(found)
}

/** One correction; null when there is none. */
export const adjustmentById = async (adjustments: EntityApi, id: string): Promise<AdjustmentRecord | null> => {
    const found = await adjustments.get(id)
    return found === null ? null : adjustmentOf(found)
}

/** One book entry; null when there is none. */
export const bookEntryById = async (book: EntityApi, id: string): Promise<BookEntryRecord | null> => {
    const found = await book.get(id)
    return found === null ? null : bookEntryOf(found)
}

/** The name of a customer; null when the lead is gone or has none. */
export const leadNameById = async (leads: EntityApi, id: string): Promise<string | null> => {
    const found = await leads.get(id)
    return found === null ? null : leadNameOf(found)
}

/** The corrections that point at a record, oldest first. */
export const adjustmentsOf = async (
    adjustments: EntityApi,
    type: AdjustmentTarget,
    id: string,
): Promise<ReadonlyArray<AdjustmentRecord>> => {
    const page = await adjustments.list({
        select: ADJUSTMENT_FIELDS,
        where: q.and(q.eq("targetType", type), q.eq("targetId", id)),
        order: [
            ["createdAt", "asc"],
            ["id", "asc"],
        ],
        page: { size: ADJUSTMENTS_MAX },
    })
    return page.rows.flatMap((listed) => {
        const record = adjustmentOf(listed.row)
        return record === null ? [] : [record]
    })
}

/** Whether the invoice or payment a correction points at exists. */
export const targetExists = async (stores: TargetStores, type: AdjustmentTarget, id: string): Promise<boolean> =>
    (await (type === "invoice" ? stores.invoices : stores.transactions).get(id)) !== null

/** The payments of a range that are unmatched or wait for review, counted and summed. */
export const unmatchedIn = async (transactions: EntityApi, range: InstantRange): Promise<Measure> => {
    const [row] = await transactions.aggregate({
        where: q.and(
            q.in("status", ["unmatched", "needs_review"]),
            q.gte("occurredAt", range.fromIso),
            q.lt("occurredAt", range.toIso),
        ),
        measures: { count: { kind: "count" }, vnd: { kind: "sum", field: "amountVnd" } },
        limit: 1,
    })
    return { count: numberOf(row?.measures["count"]), vnd: numberOf(row?.measures["vnd"]) }
}

/** Whether a payment settled the invoice. */
export const settlesInvoice = async (transactions: EntityApi, invoiceId: string): Promise<boolean> => {
    const page = await transactions.list({
        select: ["status"],
        where: q.eq("invoiceId", invoiceId),
        order: [["id", "desc"]],
        page: { size: 1 },
    })
    return page.rows.length > 0
}

/** The pages of open invoices from the one `after` names on, until `limit` rows are read or the pages end. */
const openPagesFrom = async (
    invoices: EntityApi,
    limit: number,
    after: string | undefined,
    read: ReadonlyArray<OpenInvoice>,
): Promise<ReadonlyArray<OpenInvoice>> => {
    const size = Math.min(PAGE_SIZE, limit - read.length)
    const page = await invoices.list({
        select: INVOICE_FIELDS,
        where: q.eq("status", "issued"),
        order: [
            ["createdAt", "desc"],
            ["id", "desc"],
        ],
        page: after === undefined ? { size } : { size, after },
    })
    const rows = [...read, ...page.rows.flatMap((listed) => openInvoiceOf(listed.row) ?? [])]
    return page.next === null || rows.length >= limit ? rows : openPagesFrom(invoices, limit, page.next, rows)
}

/** The invoices that are issued and not paid, newest first, at most `limit`. */
export const openInvoices = (invoices: EntityApi, limit: number): Promise<ReadonlyArray<OpenInvoice>> =>
    openPagesFrom(invoices, limit, undefined, [])

/** The kind of entry a group of the totals is for; null for a group the books do not know. */
const kindOf = (row: AggregateRow): BookEntryKind | null => {
    const kind = row.groups["kind"]
    return kind === "income" || kind === "invoice" || kind === "adjustment" ? kind : null
}

/** The sums of the book entries of a range of days, by kind; a kind with no entry is absent. */
export const bookTotals = async (book: EntityApi, range: DayRange): Promise<ReadonlyArray<KindTotal>> => {
    const rows = await book.aggregate({
        where: q.and(q.gte("entryDate", range.fromDay), q.lt("entryDate", range.toDay)),
        groupBy: ["kind"],
        measures: { vnd: { kind: "sum", field: "amountVnd" }, count: { kind: "count" } },
        limit: 10,
    })
    return rows.flatMap((row) => {
        const kind = kindOf(row)
        return kind === null
            ? []
            : [{ kind, vnd: numberOf(row.measures["vnd"]), count: numberOf(row.measures["count"]) }]
    })
}

/** How many payment claims wait for the owner: the ones the graph could not settle and escalated. */
export const escalatedClaims = async (claims: EntityApi): Promise<number> => {
    const [row] = await claims.aggregate({
        where: q.eq("status", "escalated"),
        measures: { count: { kind: "count" } },
        limit: 1,
    })
    return numberOf(row?.measures["count"])
}

/** The conversations from the page `after` names on, newest activity first, until one is the customer's or the pages are spent. */
const conversationPagesFrom = async (
    conversations: EntityApi,
    leadId: string,
    after: string | undefined,
    pages: number,
): Promise<string | null> => {
    const page = await conversations.list({
        select: ["lastAt"],
        join: { lead: LEAD_NAME_FIELDS },
        order: [
            ["lastAt", "desc"],
            ["id", "desc"],
        ],
        page: after === undefined ? { size: PAGE_SIZE } : { size: PAGE_SIZE, after },
    })
    const found = page.rows.find((listed) => listed.joined["lead"]?.id === leadId)
    if (found !== undefined) return found.row.id
    return page.next === null || pages <= 1 ? null : conversationPagesFrom(conversations, leadId, page.next, pages - 1)
}

/** The conversation a customer wrote in last among the newest conversations of the workspace; null when none of them is theirs. */
export const latestConversationOfLead = (conversations: EntityApi, leadId: string): Promise<string | null> =>
    conversationPagesFrom(conversations, leadId, undefined, CONVERSATION_PAGES_MAX)
