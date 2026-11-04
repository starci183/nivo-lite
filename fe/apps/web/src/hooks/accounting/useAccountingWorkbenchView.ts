"use client"
import {
    ACCOUNTING_TABS,
    type AccountingWorkbenchActions,
    type AccountingWorkbenchData,
    type AccountingWorkbenchDataView,
    type DataSlot,
    type SlotLabels,
} from "@/modules/types"

import { useFormatter, useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { mapSlot, slotOfReads, useSlotLabels } from "@/hooks/slot"
import { accountingQuestionsPlaceholderOf } from "@/modules/utils"
import { accountingFiguresOf } from "./accounting.shared"
import { useAccountingEvidence } from "./useAccountingEvidence"
import { useAccountingLedger } from "./useAccountingLedger"
import { useAccountingOverview } from "./useAccountingOverview"
import { useAccountingQuestions } from "./useAccountingQuestions"
import { useAccountingUpcoming } from "./useAccountingUpcoming"
import { useAccountingWaiting } from "./useAccountingWaiting"
import { useAccountingWorkbench } from "./useAccountingWorkbench"

type AccountingTab = (typeof ACCOUNTING_TABS)[number]

/** Route identity and server-resolved names of the Accounting areas. */
interface AccountingWorkbenchViewInput {
    readonly installationId: string | null
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<AccountingTab, string>>
}

/** A resolved Accounting panel keeps its own read status and ready-shaped placeholder. */
const panelOf = <T>(slot: DataSlot<AccountingWorkbenchData>, view: T, labels: SlotLabels) => ({
    slot: mapSlot(slot, () => view),
    placeholder: view,
    labels,
})

/** The view `useAccountingWorkbenchView` returns. */
export interface AccountingWorkbenchViewShape {
    shape: "questions" | "ledger" | "overview" | "evidence" | "explanation"
    props: AccountingWorkbenchDataView
    on: AccountingWorkbenchActions
}

/** The Accounting world owns its cards, independent read status and formerly mounted editor scopes. */
export const useAccountingWorkbenchView = (input: AccountingWorkbenchViewInput): AccountingWorkbenchViewShape => {
    const t = useTranslations("workbenchAccounting")
    const dashboard = useTranslations("agentDashboard")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { activeWorkspaceId } = useActiveWorkspace()
    const scope = JSON.stringify([activeWorkspaceId, input.installationId])
    const tabs = useAgentWorkbenchTabs({ ids: ACCOUNTING_TABS, initialTab: input.initialTab })
    const frame = useAgentDashboardFrame({
        module: "accounting",
        installationId: input.installationId,
        hasOwnGaps: false,
    })
    const isOverview = frame.why.workItemId === null
    const workbench = useAccountingWorkbench(isOverview)
    const overview = useAccountingOverview(workbench.data, isOverview && tabs.selected === "overview", scope)
    const evidence = useAccountingEvidence(workbench.data, isOverview && tabs.selected === "evidence", scope)
    const ledger = useAccountingLedger(workbench.data, isOverview && tabs.selected === "ledger", scope)
    const questions = useAccountingQuestions(
        workbench.data.questions,
        workbench.data.ownerName,
        isOverview && tabs.selected === "questions",
        scope,
    )
    const upcoming = useAccountingUpcoming(workbench.data)
    const waiting = useAccountingWaiting(workbench.data, isOverview, scope)
    const items = accountingFiguresOf(workbench.data, format, t)
    return {
        shape: isOverview ? tabs.selected : ("explanation" as const),
        props: {
            why: frame.why,
            regions: frame.regions,
            selectedTab: tabs.selected,
            tabsLabel: frame.tabsLabel,
            tabs: ACCOUNTING_TABS.map((id) => ({
                id,
                label: frame.tabLabel({ id, label: input.tabs[id] }, "questions"),
            })),
            ribbon: {
                label: dashboard("ribbonAria"),
                slot: mapSlot(workbench.slot, () => items),
                placeholder: items,
                labels: slotLabels(t("loadFailedTitle")),
            },
            waiting: {
                slot: slotOfReads([workbench.read], () =>
                    waiting.props.rows.length === 0 ? undefined : waiting.props,
                ),
                placeholder: waiting.props,
                labels: slotLabels(t("questionsEmpty")),
            },
            upcoming: panelOf(workbench.slot, upcoming.props, slotLabels(t("loadFailedTitle"))),
            overview: panelOf(workbench.slot, overview.props, slotLabels(t("loadFailedTitle"))),
            evidence: panelOf(workbench.slot, evidence.props, slotLabels(t("invoicesEmpty"))),
            ledger: panelOf(workbench.slot, ledger.props, slotLabels(t("ledgerEmpty"))),
            questions: {
                ...panelOf(workbench.slot, questions.props, slotLabels(t("questionsEmpty"))),
                placeholder: accountingQuestionsPlaceholderOf(t),
            },
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retry: workbench.retry,
            waiting: waiting.on,
            upcoming: upcoming.on,
            overview: overview.on,
            evidence: evidence.on,
            ledger: ledger.on,
            questions: questions.on,
        },
    }
}
