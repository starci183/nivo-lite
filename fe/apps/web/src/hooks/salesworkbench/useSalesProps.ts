"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import type { useChatbotWorkbench } from "@/hooks/chatbot"
import type { useChatbotInbox } from "@/hooks/chatbotView"
import { SALES_TABS } from "@/hooks/sales"
import type {
    useSalesActivityView,
    useSalesAttentionView,
    useSalesHandoffsView,
    useSalesWorkbench,
} from "@/hooks/sales"
import type { useSalesContractsView } from "@/hooks/salescontracts"
import type { useSalesDecisionsView } from "@/hooks/salesdecisions"
import { salesFiguresOf, salesFiguresPlaceholderOf } from "@/hooks/salesfigures"
import type { useSalesPipelineView } from "@/hooks/salesPipeline"
import type { useSalesWaiting } from "@/hooks/salesWaiting"
import { mapSlot, slotOfReads, useSlotLabels, WAITING_ROWS_PLACEHOLDER } from "@/hooks/slot"
import { workbenchRowDataOf } from "@/hooks/workbench"
import type { workbenchWaitingDataOf } from "@/hooks/workbench"
import { SALES_INBOX_TABS, type SalesArea } from "./salesworkbench.shared"
import type { useSalesOrdersView } from "./useSalesOrdersView"
import type { SalesWorkbenchViewData, WorkbenchAsideView } from "@/modules/types"

/** The existing Sales route identity and server-resolved tab labels. */
export interface SalesWorkbenchViewInput {
    readonly installationId: string | null
    readonly tab: string
    readonly focus: string | null
    readonly conversation: string | null
    readonly tabs: Readonly<Record<SalesArea, string>>
}

interface SalesPropsInput {
    readonly input: SalesWorkbenchViewInput
    readonly frame: ReturnType<typeof useAgentDashboardFrame>
    readonly tabs: ReturnType<typeof useAgentWorkbenchTabs<SalesArea>>
    readonly workbench: ReturnType<typeof useSalesWorkbench>
    readonly attention: ReturnType<typeof useSalesAttentionView>
    readonly pipeline: ReturnType<typeof useSalesPipelineView>
    readonly decisions: ReturnType<typeof useSalesDecisionsView>
    readonly handoffs: ReturnType<typeof useSalesHandoffsView>
    readonly orders: ReturnType<typeof useSalesOrdersView>
    readonly contracts: ReturnType<typeof useSalesContractsView>
    readonly activity: ReturnType<typeof useSalesActivityView>
    readonly inboxRead: ReturnType<typeof useChatbotWorkbench>
    readonly inbox: ReturnType<typeof useChatbotInbox>
    readonly waiting: ReturnType<typeof useSalesWaiting>
    readonly waitingData: ReturnType<typeof workbenchWaitingDataOf>
    readonly aside: WorkbenchAsideView
}

/** Resolves the desk's actual data regions, copy and tab strip after its domain owners have been read. */
export const useSalesProps = (source: SalesPropsInput): SalesWorkbenchViewData => {
    const t = useTranslations("workbenchSales")
    const dashboard = useTranslations("agentDashboard")
    const chatbot = useTranslations("workbenchChatbot")
    const format = useFormatter()
    const labels = useSlotLabels()
    const money = (amount: number | null) =>
        amount === null ? "-" : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const {
        input,
        frame,
        tabs,
        workbench,
        attention,
        pipeline,
        decisions,
        handoffs,
        orders,
        contracts,
        activity,
        inboxRead,
        inbox,
        waiting,
        waitingData,
        aside,
    } = source
    return {
        aside,
        why: frame.why,
        regions: frame.regions,
        selectedTab: tabs.selected,
        tabsLabel: frame.tabsLabel,
        tabs: (input.conversation === null ? SALES_TABS : SALES_INBOX_TABS).map((id) => ({
            id,
            label: frame.tabLabel({ id, label: input.tabs[id] }, "decisions"),
        })),
        gate: {
            slot: mapSlot(workbench.slot, () => true),
            placeholder: true,
            labels: labels(t("loadFailedTitle")),
            name: input.tabs[tabs.selected],
        },
        ribbon: {
            label: dashboard("ribbonAria"),
            slot: mapSlot(workbench.slot, (data) => salesFiguresOf(data.metrics, { t, money })),
            placeholder: salesFiguresPlaceholderOf(t),
            labels: labels(t("loadFailedTitle")),
        },
        waiting: {
            slot: waitingData.slot,
            placeholder: WAITING_ROWS_PLACEHOLDER.map(workbenchRowDataOf),
            labels: labels(dashboard("waitingEmpty")),
            list: {
                label: dashboard("waitingTitle"),
                count: waiting.count,
                more: waiting.more,
                emptyMessage: dashboard("waitingEmpty"),
                emptyDescription: dashboard("waitingEmptyBody"),
                seeWhyLabel: t("waitingSeeWhy"),
                moreLabel: t("waitingMoreMenu"),
            },
        },
        attention: attention.props,
        pipeline: pipeline.props,
        decisions: decisions.props,
        handoffs: handoffs.props,
        orders: orders.props,
        contracts: contracts.props,
        activity,
        inbox: {
            slot: slotOfReads(inboxRead.reads, () => inbox.props),
            placeholder: inbox.props,
            labels: labels(chatbot("title")),
        },
    }
}
