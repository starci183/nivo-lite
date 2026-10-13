import type { AdminWorkspaceDetail } from "@/modules/api"
import { billingTone } from "./admin.shared"
import type { AdminFactView, AdminFormat, AdminText } from "./admin.shared"

/** The overview terms of a workspace: billing on one side, activity on the other. */
export const detailFacts = (
    detail: AdminWorkspaceDetail,
    format: AdminFormat,
    text: AdminText,
): { readonly billing: ReadonlyArray<AdminFactView>; readonly activity: ReadonlyArray<AdminFactView> } => {
    const { workspace, credits, activity } = detail
    const used = format.count(Math.round(credits.used))
    const limit = credits.limit === null ? text("creditsNoLimit") : format.count(credits.limit)
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
