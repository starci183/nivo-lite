"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { translator } from "@/i18n/core"
import { workbenchSales } from "@/i18n/dict/workbenchSales"
import { logDecision, logEvidence } from "@/lib/core"
import { runWork, type EngineCtx } from "@/lib/engine"
import { drainAfter, engineCtx } from "@/lib/flow-ctx"
import type { Order, WorkItem } from "@/lib/flow-types"
import { deciderOf, requireDecide } from "@/lib/permissions"
import { emitEvent } from "@/lib/outbound-events"
import type { Outcome } from "@/lib/types"

/** The carrier and tracking code of a shipment. */
interface ShipInput {
    readonly carrier: string
    readonly trackingCode: string
}

/* Wave-3 shim: the Sales workbench commands that still run in the engine (retry, stop, hand to Accounting, mark shipped). Contracts are the back end own. */

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
    try {
        return { ok: true, data: await fn() }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null

/** The engine rows carry the same columns as the flow types; a row without an id and a status is no row. */
const isWorkItem = (value: unknown): value is WorkItem =>
    isRecord(value) && typeof value.id === "string" && typeof value.status === "string"

const isOrder = (value: unknown): value is Order =>
    isRecord(value) && typeof value.id === "string" && typeof value.order_no === "string"

const refresh = () => revalidatePath("/", "layout")
const W = (c: EngineCtx) => translator(workbenchSales, c.locale)

const loadItem = async (c: EngineCtx, id: string): Promise<WorkItem> => {
    const { data, error } = await c.db
        .from("work_items")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", c.ws)
        .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error(W(c)("errNotFound"))
    if (!isWorkItem(data)) throw new Error(W(c)("errNotFound"))
    return data
}

/**
 * Put a failed or stopped step back in the queue so the engine runs it again through the gate.
 * `updated_at = created_at` marks it as a fresh queued step for the queue drain.
 */
const requeue = async (c: EngineCtx, item: WorkItem, from: ReadonlyArray<WorkItem["status"]>): Promise<void> => {
    const { data, error } = await c.db
        .from("work_items")
        .update({ status: "queued", error: null, reason: null, reasons: [], updated_at: item.created_at })
        .eq("id", item.id)
        .eq("workspace_id", c.ws)
        .in("status", [...from])
        .select("id")
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Error(W(c)("errChanged"))
}

/** Try a failed step again. Only a person allowed to decide the item may do it. */
export const retryFailedStep = (workItemId: string): Promise<Outcome<{ id: string }>> =>
    run(async () => {
        const c = await engineCtx()
        const item = await loadItem(c, workItemId)
        await requireDecide(item, c.locale)
        if (item.status !== "failed") throw new Error(W(c)("errNotFailed"))
        await requeue(c, item, ["failed"])
        await logEvidence(c.db, c.ws, {
            lead_id: item.lead_id,
            work_item_id: item.id,
            kind: "work.retried",
            actor: c.actor,
            summary: W(c)("evRetried", { who: c.actor }),
            evidence: item.error,
        })
        drainAfter(c, 3)
        refresh()
        return { id: item.id }
    })

/** Stop a failed step for good: it is closed as rejected and recorded in the decision log with who stopped it. */
export const stopFailedStep = (workItemId: string): Promise<Outcome<{ id: string }>> =>
    run(async () => {
        const c = await engineCtx()
        const item = await loadItem(c, workItemId)
        const member = await requireDecide(item, c.locale)
        if (item.status !== "failed") throw new Error(W(c)("errNotFailed"))
        const { data, error } = await c.db
            .from("work_items")
            .update({
                status: "rejected",
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", item.id)
            .eq("workspace_id", c.ws)
            .eq("status", "failed")
            .select("id")
        if (error) throw new Error(error.message)
        if (!data?.length) throw new Error(W(c)("errChanged"))
        const by = deciderOf(member)
        await logDecision(c.db, c.ws, {
            work_item_id: item.id,
            lead_id: item.lead_id,
            department: item.department,
            action: item.action,
            decided_by: by.name,
            decider_kind: by.kind,
            outcome: "rejected",
            reason: item.reason,
            note: W(c)("stopNote"),
        })
        await logEvidence(c.db, c.ws, {
            lead_id: item.lead_id,
            work_item_id: item.id,
            kind: "work.stopped",
            actor: by.name,
            summary: W(c)("evStopped", { who: by.name }),
            evidence: item.error,
        })
        refresh()
        return { id: item.id }
    })

/**
 * "Hand to Accounting": a confirmed order with no invoice runs the existing issue_invoice work through the gate (the same dedupe key as the
 * automatic hand-off, so it can never double up). A step that failed or was stopped earlier is queued again.
 * The result says where it stands: done (invoice recorded), waiting_decision (Accounting asks for a decision), queued or failed.
 */
export const handoffToAccounting = (orderId: string): Promise<Outcome<{ status: WorkItem["status"] }>> =>
    run(async () => {
        const c = await engineCtx()
        const { data: orderRow, error } = await c.db
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .eq("workspace_id", c.ws)
            .maybeSingle()
        if (error) throw new Error(error.message)
        const order = isOrder(orderRow) ? orderRow : null
        if (!order) throw new Error(W(c)("errNotFound"))
        if (order.status !== "confirmed") throw new Error(W(c)("errNotConfirmed"))
        const inv = await c.db
            .from("invoices")
            .select("id, status")
            .eq("workspace_id", c.ws)
            .eq("order_id", order.id)
            .neq("status", "void")
            .limit(1)
        if (inv.error) throw new Error(inv.error.message)
        if (inv.data?.length) throw new Error(W(c)("errAlreadyInvoiced"))

        let item = await runWork(c, {
            action: "issue_invoice",
            subject_type: "order",
            subject_id: order.id,
            lead_id: order.lead_id,
            origin: order.origin,
            dedupeKey: `issue_invoice:order:${order.id}`,
            seed: { amount_vnd: order.amount_vnd, fields: {} },
        })
        if (item.status === "failed" || item.status === "rejected") {
            await requeue(c, item, ["failed", "rejected"])
            item = { ...item, status: "queued" }
        }
        await logEvidence(c.db, c.ws, {
            lead_id: order.lead_id,
            work_item_id: item.id,
            kind: "handoff.accounting",
            actor: c.actor,
            summary: W(c)("evHandoff", { who: c.actor, no: order.order_no }),
        })
        drainAfter(c, 3)
        refresh()
        return { status: item.status }
    })

/**
 * "Mark shipped": the order was handed to a carrier. Records shipped_at, carrier and tracking code once and announces `order.shipped`, which the
 * delivery-notice automation (when switched on) turns into a message to the customer through the authority gate. Any signed-in member may do it.
 */
export const markOrderShipped = (orderId: string, input: ShipInput): Promise<Outcome<{ orderNo: string }>> =>
    run(async () => {
        const c = await engineCtx()
        const carrier = input.carrier.trim().slice(0, 80)
        const trackingCode = input.trackingCode.trim().slice(0, 80)
        if (!carrier) throw new Error(W(c)("errCarrier"))
        if (!trackingCode) throw new Error(W(c)("errTracking"))
        const { data: orderRow, error } = await c.db
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .eq("workspace_id", c.ws)
            .maybeSingle()
        if (error) throw new Error(error.message)
        const order = isOrder(orderRow) ? orderRow : null
        if (!order) throw new Error(W(c)("errNotFound"))
        if (!["confirmed", "invoiced", "paid"].includes(order.status)) throw new Error(W(c)("errNotShippable"))
        if (order.shipped_at) throw new Error(W(c)("errAlreadyShipped"))
        const shippedAt = new Date().toISOString()
        const upd = await c.db
            .from("orders")
            .update({ shipped_at: shippedAt, carrier, tracking_code: trackingCode })
            .eq("id", order.id)
            .eq("workspace_id", c.ws)
            .is("shipped_at", null)
            .select("id")
        if (upd.error) throw new Error(upd.error.message)
        if (!upd.data?.length) throw new Error(W(c)("errAlreadyShipped"))
        await logEvidence(c.db, c.ws, {
            lead_id: order.lead_id,
            kind: "order.shipped",
            actor: c.actor,
            summary: W(c)("evShipped", { who: c.actor, no: order.order_no, carrier }),
            evidence: trackingCode,
        })
        await emitEvent(
            c.ws,
            "order.shipped",
            {
                order_id: order.id,
                order_no: order.order_no,
                lead_id: order.lead_id,
                carrier,
                tracking_code: trackingCode,
                shipped_at: shippedAt,
            },
            `order.shipped:${order.id}`,
        )
        refresh()
        return { orderNo: order.order_no }
    })
