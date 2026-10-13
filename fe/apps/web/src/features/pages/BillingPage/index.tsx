import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { TIME_ZONE } from "@/i18n/core"
import { getAuthUser } from "@/lib/supabase/auth-user"
import {
    readBillingWorkspace,
    readPaymentOrders,
    readPlan,
    readReviewTransactions,
    readUsageSummary,
} from "@/modules/db"
import { BillingPageBase } from "./component"

/** The document title of the page. */
export const billingMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("billing")
    return { title: t("pageTitle") }
}

/** /workspaces/[id]/billing (owner | manager): the plan, payments, transfers to review and this month's AI usage, all under RLS. */
export const BillingPage = async ({ workspaceId }: { readonly workspaceId: string }) => {
    const user = await getAuthUser()
    if (!user) redirect("/login")
    const workspace = await readBillingWorkspace(user.id, workspaceId)
    if (workspace.kind !== "ok") notFound()
    if (workspace.value.role !== "owner" && workspace.value.role !== "manager") redirect("/workspaces")
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date())
    const [plan, orders, usage] = await Promise.all([
        workspace.value.plan_code === null ? Promise.resolve(null) : readPlan(workspace.value.plan_code),
        readPaymentOrders(workspaceId),
        readUsageSummary(workspaceId, today),
    ])
    if (orders.kind !== "ok") throw new Error(`billing: orders ${orders.kind} ${orders.code}`)
    if (usage.kind !== "ok") throw new Error(`billing: usage ${usage.kind} ${usage.code}`)
    const review = await readReviewTransactions(orders.value.map((order) => order.id))
    return (
        <BillingPageBase
            workspaceId={workspaceId}
            plan={plan?.kind === "ok" ? plan.value : null}
            status={workspace.value.status}
            paidUntil={workspace.value.paid_until}
            orders={orders.value}
            review={review.kind === "ok" ? review.value : []}
            usage={usage.value}
        />
    )
}
