"use client"

import { useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import {
    useAccountingOverview,
    useAccountingEvidence,
    useAccountingLedger,
    useAccountingQuestions,
    useAccountingDashboardView,
    moneyOf,
    type AccountingFormat,
    type AccountingTranslator,
} from "@/hooks/accounting"
import { useRequireActiveWorkspace } from "@/hooks/workspaces"
import { useQueryAccountingWorkbenchSwr, useQueryAgentDashboardSwr } from "@/hooks/swr"
import { agentDashboardOf } from "@/modules/utils"
import type { AccountingMeasure, AccountingWorkbenchData } from "@/modules/types"
import { AccountingWorkbenchOverviewBase } from "./component"

/** The tab initially selected by the server route. */
interface AccountingWorkbenchOverviewProps {
    readonly initialTab: string | null
}

/** Presents the backend-calculated monthly figures in the reader's locale. */
const figuresOf = (data: AccountingWorkbenchData, format: AccountingFormat, t: AccountingTranslator) => {
    const moneyItem = (
        id: string,
        term: string,
        measure: AccountingMeasure,
        unit: "countInvoices" | "countPayments",
    ) => ({
        id,
        term,
        description: moneyOf(format, measure.vnd.live),
        meta: [
            t(unit, { n: measure.count.live }),
            measure.count.simulated > 0 ? `${t("originSimulated")}: ${moneyOf(format, measure.vnd.simulated)}` : "",
        ]
            .filter(Boolean)
            .join(" · "),
    })
    const slots = [data.ageing.d0, data.ageing.d30, data.ageing.d60]
    const simulatedOpen = slots.reduce((sum, slot) => sum + slot.vnd.simulated, 0)
    return [
        moneyItem("income", t("mIncome"), data.periods.this.income, "countInvoices"),
        moneyItem("receivable", t("mReceivable"), data.periods.this.receivable, "countInvoices"),
        moneyItem("unmatched", t("mUnmatched"), data.periods.this.unmatched, "countPayments"),
        {
            id: "ageing",
            term: t("mAgeing"),
            description: slots.map((slot) => slot.count.live).join(" / "),
            meta: [
                slots.map((slot) => moneyOf(format, slot.vnd.live)).join(" · "),
                simulatedOpen > 0 ? `${t("originSimulated")}: ${moneyOf(format, simulatedOpen)}` : "",
            ]
                .filter(Boolean)
                .join(" · "),
        },
    ]
}

const tabOf = (value: string | null): string =>
    value === "evidence" || value === "questions" || value === "ledger" ? value : "overview"

/** Fetches the accounting read model and settles the dashboard's view before rendering the pure twin. */
export const AccountingWorkbenchOverview = (props: AccountingWorkbenchOverviewProps) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const { activeWorkspaceId } = useRequireActiveWorkspace()
    const workbench = useQueryAccountingWorkbenchSwr(activeWorkspaceId)
    const dashboard = useQueryAgentDashboardSwr(activeWorkspaceId, { module: "accounting" })
    const view = useAccountingDashboardView(
        dashboard.data === undefined ? undefined : agentDashboardOf(dashboard.data, "accounting"),
    )
    const [selectedTab, setSelectedTab] = useState(() => tabOf(props.initialTab))
    const isLoading = !activeWorkspaceId || workbench.isLoading || dashboard.isLoading
    const data = workbench.data
    const overview = useAccountingOverview(data)
    const evidence = useAccountingEvidence(data)
    const ledger = useAccountingLedger(data)
    const questions = useAccountingQuestions(data?.questions ?? [], data?.ownerName ?? "")
    const questionsLabel =
        data && data.questions.length > 0 ? `${t("tabQuestions")} (${data.questions.length})` : t("tabQuestions")
    return (
        <AccountingWorkbenchOverviewBase
            state={{ isLoading, figuresFailed: !isLoading && !data, selectedTab }}
            props={{
                view,
                overview: overview.props,
                evidence: evidence.props,
                ledger: ledger.props,
                questions: questions.props,
                figures: data
                    ? figuresOf(data, format, t)
                    : [
                          { id: "income", term: t("mIncome"), description: "" },
                          { id: "receivable", term: t("mReceivable"), description: "" },
                          { id: "unmatched", term: t("mUnmatched"), description: "" },
                          { id: "ageing", term: t("mAgeing"), description: "" },
                      ],
                tabs: [
                    { id: "overview", label: t("tabOverview") },
                    { id: "evidence", label: t("tabEvidence") },
                    { id: "questions", label: questionsLabel },
                    { id: "ledger", label: t("tabLedger") },
                ],
                loadFailedTitle: t("loadFailedTitle"),
                loadFailedBody: t("loadFailedBody"),
            }}
            on={{
                approveQuestion: questions.on.approve,
                rejectQuestion: questions.on.reject,
                toggleQuestionEdit: questions.on.toggleEdit,
                changeQuestionDraft: questions.on.changeDraft,
                changeQuestionAmount: questions.on.changeAmount,
                changeQuestionBasis: questions.on.changeBasis,
                changeQuestionCandidate: questions.on.changeCandidate,
                changeQuestionField: questions.on.changeField,
                selectPeriod: overview.on.selectPeriod,
                openEvidence: evidence.on.openForm,
                closeEvidence: evidence.on.closeForm,
                changeEvidenceField: evidence.on.changeField,
                submitEvidence: evidence.on.submitForm,
                selectLedgerFilter: ledger.on.selectFilter,
                openLedgerEntry: ledger.on.openEntry,
                closeLedgerDrawer: ledger.on.closeDrawer,
                startAdjust: ledger.on.startAdjust,
                cancelAdjust: ledger.on.cancelAdjust,
                changeAdjustNote: ledger.on.changeNote,
                changeAdjustAmount: ledger.on.changeAmount,
                submitAdjust: ledger.on.submitAdjust,
                retry: () => {
                    void Promise.all([workbench.mutate(), dashboard.mutate()])
                },
                selectTab: (id) => {
                    setSelectedTab(tabOf(id))
                    const url = new URL(window.location.href)
                    url.searchParams.set("tab", id)
                    window.history.replaceState(null, "", url)
                },
            }}
        />
    )
}
