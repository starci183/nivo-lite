import "server-only"

import { cache } from "react"
import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import type { AccountingBook } from "./accounting.mapper"

const INVOICE_LIMIT = 1000
const TRANSACTION_LIMIT = 1000
const ORDER_LIMIT = 500
const WORK_LIMIT = 500
const DECISION_LIMIT = 500
const ADJUSTMENT_LIMIT = 500

/**
 * Reads the records the Accounting workbench is derived from, newest first, for one workspace, under the caller's RLS.
 * A failure of any core table fails the read; only the adjustments table may be missing (its migration not applied yet),
 * and that is reported as `adjustmentsReady: false`, never as an empty list.
 */
export const readAccountingBook = cache(async (workspaceId: string): Promise<DbOutcome<AccountingBook>> => {
    const client = await createServerDbClient()
    const [invoices, transactions, orders, works, decisions, adjustments] = await Promise.all([
        client
            .from("invoices")
            .select("*, order:orders(order_no, items, amount_vnd, status), lead:leads(contact_name, company)")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(INVOICE_LIMIT),
        client
            .from("transactions")
            .select("*, inbound:inbound_events(channel, event_id, body, sender_name)")
            .eq("workspace_id", workspaceId)
            .order("occurred_at", { ascending: false })
            .limit(TRANSACTION_LIMIT),
        client
            .from("orders")
            .select("*, lead:leads(contact_name, company)")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(ORDER_LIMIT),
        client
            .from("work_items")
            .select("id, action, status, subject_type, subject_id, created_at")
            .eq("workspace_id", workspaceId)
            .eq("department", "accounting")
            .order("created_at", { ascending: false })
            .limit(WORK_LIMIT),
        client
            .from("decisions")
            .select("id, work_item_id, action, decided_by, decider_kind, outcome, note, created_at")
            .eq("workspace_id", workspaceId)
            .eq("department", "accounting")
            .order("created_at", { ascending: false })
            .limit(DECISION_LIMIT),
        client
            .from("accounting_adjustments")
            .select("id, target_type, target_id, note, corrected_amount_vnd, created_by, created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(ADJUSTMENT_LIMIT),
    ])
    const invoiceRows = toOutcome(invoices)
    if (invoiceRows.kind !== "ok") return invoiceRows
    const transactionRows = toOutcome(transactions)
    if (transactionRows.kind !== "ok") return transactionRows
    const orderRows = toOutcome(orders)
    if (orderRows.kind !== "ok") return orderRows
    const workRows = toOutcome(works)
    if (workRows.kind !== "ok") return workRows
    const decisionRows = toOutcome(decisions)
    if (decisionRows.kind !== "ok") return decisionRows
    const adjustmentRows = toOutcome(adjustments)
    return dbOk({
        invoices: invoiceRows.value,
        transactions: transactionRows.value,
        orders: orderRows.value,
        works: workRows.value,
        decisions: decisionRows.value,
        adjustments: adjustmentRows.kind === "ok" ? adjustmentRows.value : [],
        adjustmentsReady: adjustmentRows.kind === "ok",
    })
})
