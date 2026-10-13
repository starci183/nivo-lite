"use client"

import { useMemo } from "react"
import { billingTone } from "./admin.shared"
import type { AdminFactView, AdminFormat, AdminText, AdminWorkspaceDetail } from "./admin.shared"
import { useAdminFormat } from "./useAdminFormat"

/** The overview terms of a workspace: billing on one side, activity on the other. */
const detailFacts = (
    detail: AdminWorkspaceDetail,
    format: AdminFormat,
    text: AdminText,
): { readonly billing: ReadonlyArray<AdminFactView>; readonly activity: ReadonlyArray<AdminFactView> } => {
    const { workspace, credits, activity } = detail
    const used = format.count(Math.round(credits.used))
    const limit = typeof credits.limit === "number" ? format.count(credits.limit) : text("creditsNoLimit")
    return {
        billing: [
            { id: "status", term: text("factStatus"), value: workspace.status, tone: billingTone(workspace.status) },
            { id: "plan", term: text("factPlan"), value: workspace.planCode ?? text("empty") },
            { id: "paid", term: text("factPaidUntil"), value: format.date(workspace.paidUntil) },
            {
                id: "credits",
                term: text("factCredits"),
                value: text(credits.ownLimit === null ? "creditsValue" : "creditsValueOwn", { used, limit }),
            },
            { id: "cost", term: text("factCost"), value: format.usd(credits.costUsd) },
        ],
        activity: [
            {
                id: "members",
                term: text("factMembers"),
                value: String(detail.members.filter((member) => member.status === "active").length),
            },
            { id: "last", term: text("factLastMessage"), value: format.ago(activity.lastCustomerMessageAt) },
            { id: "msgs", term: text("factMessages"), value: String(activity.messages7d) },
            { id: "decisions", term: text("factDecisions"), value: String(activity.openDecisions) },
            { id: "knowledge", term: text("factKnowledge"), value: String(detail.knowledgeTotal) },
        ],
    }
}

/** The billing and activity facts of a workspace overview, worded and formatted in the reader's locale. */
export const useAdminDetailFacts = (detail: AdminWorkspaceDetail | undefined) => {
    const { text, format } = useAdminFormat()
    return useMemo(() => (detail === undefined ? undefined : detailFacts(detail, format, text)), [detail, format, text])
}
