"use client"

import { useMemo } from "react"
import { billingTone, billingWord, planWord } from "./admin.shared"
import type { AdminFactView, AdminFormat, AdminText, AdminWorkspaceDetail } from "./admin.shared"
import { useAdminFormat } from "./useAdminFormat"

/** The id and message key of each term, so the terms stay real text while the facts load. */
const BILLING_TERMS: ReadonlyArray<readonly [string, string]> = [
    ["status", "factStatus"],
    ["plan", "factPlan"],
    ["paid", "factPaidUntil"],
    ["credits", "factCredits"],
    ["cost", "factCost"],
]
const ACTIVITY_TERMS: ReadonlyArray<readonly [string, string]> = [
    ["members", "factMembers"],
    ["last", "factLastMessage"],
    ["msgs", "factMessages"],
    ["decisions", "factDecisions"],
    ["knowledge", "factKnowledge"],
]
/** The width of a value the skeleton draws while the facts load. */
const BLANK_VALUE = "000000000"
const BLANK_FACTS = (text: AdminText, terms: ReadonlyArray<readonly [string, string]>): ReadonlyArray<AdminFactView> =>
    terms.map(([id, key]) => ({ id, term: text(key), value: BLANK_VALUE }))

/** The overview terms of a workspace: billing on one side, activity on the other. */
const detailFacts = (
    detail: AdminWorkspaceDetail | undefined,
    format: AdminFormat,
    text: AdminText,
): { readonly billing: ReadonlyArray<AdminFactView>; readonly activity: ReadonlyArray<AdminFactView> } => {
    if (detail === undefined)
        return { billing: BLANK_FACTS(text, BILLING_TERMS), activity: BLANK_FACTS(text, ACTIVITY_TERMS) }
    const { workspace, credits, activity } = detail
    const used = format.count(Math.round(credits.used))
    const limit = typeof credits.limit === "number" ? format.count(credits.limit) : text("creditsNoLimit")
    return {
        billing: [
            {
                id: "status",
                term: text("factStatus"),
                value: billingWord(text, workspace.status),
                tone: billingTone(workspace.status),
            },
            {
                id: "plan",
                term: text("factPlan"),
                value: workspace.planCode === null ? text("empty") : planWord(text, workspace.planCode),
            },
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
export const useAdminDetailFacts = (
    detail: AdminWorkspaceDetail | undefined,
): { readonly billing: ReadonlyArray<AdminFactView>; readonly activity: ReadonlyArray<AdminFactView> } => {
    const { text, format } = useAdminFormat()
    return useMemo(() => detailFacts(detail, format, text), [detail, format, text])
}
