import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toPaymentOrder, toPlan, toReviewTransaction, toWorkspaceStatus } from "./billing.mapper"
import type { BillingWorkspace, PaymentOrder, Plan, ReviewTransaction } from "./billing.mapper"

/** How many payment orders a list shows. */
const ORDER_LIST_SIZE = 50

/** The active plans of the catalogue in display order (any signed-in person reads them). */
export const readPlans = async (): Promise<DbOutcome<ReadonlyArray<Plan>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(await client.from("plans").select("*").eq("active", true).order("sort").limit(50))
    return result.kind === "ok" ? dbOk(result.value.map(toPlan)) : result
}

/** One active plan by its code. */
export const readPlan = async (code: string): Promise<DbOutcome<Plan>> => {
    const client = await createServerDbClient()
    const result = toOutcome(await client.from("plans").select("*").eq("code", code).eq("active", true).maybeSingle())
    return result.kind === "ok" ? dbOk(toPlan(result.value)) : result
}

/** The signed-in person's workspaces with their billing state and role in each, newest first (RLS limits them to the person's own). */
export const readBillingWorkspaces = async (userId: string): Promise<DbOutcome<ReadonlyArray<BillingWorkspace>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("workspace_members")
            .select("role, workspace:workspaces(id, name, status, plan_code, paid_until, created_at)")
            .eq("user_id", userId)
            .eq("status", "active")
            .limit(200),
    )
    if (result.kind !== "ok") return result
    const rows = result.value.flatMap((member) => {
        const workspace = Array.isArray(member.workspace) ? member.workspace[0] : member.workspace
        return workspace === undefined || workspace === null ? [] : [{ member, workspace }]
    })
    return dbOk(
        rows
            .sort((left, right) => right.workspace.created_at.localeCompare(left.workspace.created_at))
            .map(({ member, workspace }) => ({
                id: workspace.id,
                name: workspace.name,
                status: toWorkspaceStatus(workspace.status),
                plan_code: workspace.plan_code,
                paid_until: workspace.paid_until,
                role: member.role,
            })),
    )
}

/** One workspace of the person with the person's role in it, or a refusal when the person is not an active member. */
export const readBillingWorkspace = async (
    userId: string,
    workspaceId: string,
): Promise<DbOutcome<BillingWorkspace>> => {
    const workspaces = await readBillingWorkspaces(userId)
    if (workspaces.kind !== "ok") return workspaces
    const found = workspaces.value.find((workspace) => workspace.id === workspaceId)
    return found === undefined ? dbFailure("not-found", "workspace") : dbOk(found)
}

/** The latest payment orders of a workspace, newest first (RLS: members read their workspace's orders). */
export const readPaymentOrders = async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<PaymentOrder>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("payment_orders")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(ORDER_LIST_SIZE),
    )
    return result.kind === "ok" ? dbOk(result.value.map(toPaymentOrder)) : result
}

/** One payment order by its id; a pending order past its time reads as expired. */
export const readPaymentOrder = async (orderId: string, now: Date): Promise<DbOutcome<PaymentOrder>> => {
    const client = await createServerDbClient()
    const result = toOutcome(await client.from("payment_orders").select("*").eq("id", orderId).maybeSingle())
    if (result.kind !== "ok") return result
    const order = toPaymentOrder(result.value)
    const lapsed = order.status === "pending" && new Date(order.expires_at).getTime() < now.getTime()
    return dbOk(lapsed ? { ...order, status: "expired" } : order)
}

/** The newest plan payment (not an upgrade or a top-up) of a workspace that can still be paid. */
export const readOpenPlanOrder = async (workspaceId: string, now: Date): Promise<DbOutcome<PaymentOrder>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("payment_orders")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("status", "pending")
            .eq("kind", "plan")
            .gt("expires_at", now.toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    )
    return result.kind === "ok" ? dbOk(toPaymentOrder(result.value)) : result
}

/** Transfers tied to the given orders that need a manager's look (underpaid, expired or unmatched). */
export const readReviewTransactions = async (
    orderIds: ReadonlyArray<string>,
): Promise<DbOutcome<ReadonlyArray<ReviewTransaction>>> => {
    if (orderIds.length === 0) return dbOk([])
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("sepay_transactions")
            .select("id, status, transfer_amount, received_at, content")
            .in("matched_order_id", [...orderIds])
            .in("status", ["underpaid", "expired", "unmatched"])
            .order("received_at", { ascending: false })
            .limit(ORDER_LIST_SIZE),
    )
    return result.kind === "ok" ? dbOk(result.value.map(toReviewTransaction)) : result
}
