"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { useChatbotWorkbench } from "@/hooks/chatbot"
import { useChatbotInbox } from "@/hooks/chatbotView"
import { useMember } from "@/hooks/member"
import {
    SALES_TABS,
    useSalesActivityView,
    useSalesAttentionView,
    useSalesHandoffsView,
    useSalesWorkbench,
} from "@/hooks/sales"
import { useSalesContractsView } from "@/hooks/salescontracts"
import { useSalesDecisionsView } from "@/hooks/salesdecisions"
import { salesFiguresOf, salesFiguresPlaceholderOf } from "@/hooks/salesfigures"
import { useSalesPipelineView } from "@/hooks/salesPipeline"
import { useSalesWaiting } from "@/hooks/salesWaiting"
import { mapSlot, slotOfReads, useSlotLabels, WAITING_ROWS_PLACEHOLDER } from "@/hooks/slot"
import { workbenchRowDataOf, workbenchWaitingDataOf } from "@/hooks/workbench"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useSalesOrdersView } from "./useSalesOrdersView"

const SALES_INBOX_TABS = [...SALES_TABS, "conversation"] as const
type SalesArea = (typeof SALES_INBOX_TABS)[number]

/** The existing Sales route identity and server-resolved tab labels. */
interface SalesWorkbenchViewInput {
    readonly installationId: string | null
    readonly tab: string
    readonly focus: string | null
    readonly conversation: string | null
    readonly tabs: Readonly<Record<SalesArea, string>>
}

/** Owns the real Sales desk and the independent lifetimes of its six panels and optional customer conversation. */
export const useSalesWorkbenchView = (input: SalesWorkbenchViewInput) => {
    const me = useMember()
    const { activeWorkspaceId } = useActiveWorkspace()
    const scope = JSON.stringify([activeWorkspaceId, me?.userId, input.installationId])
    const tabs = useAgentWorkbenchTabs({
        ids: input.conversation === null ? SALES_TABS : SALES_INBOX_TABS,
        initialTab: input.tab,
        scope,
    })
    const frame = useAgentDashboardFrame({ module: "sales", installationId: input.installationId, hasOwnGaps: false })
    const isOverview = frame.why.workItemId === null
    const workbench = useSalesWorkbench(isOverview)
    const ready = isOverview && "items" in workbench.slot
    const attention = useSalesAttentionView(workbench.data, ready && tabs.selected === "attention", scope)
    const pipeline = useSalesPipelineView(workbench.data, ready && tabs.selected === "pipeline", scope)
    const decisions = useSalesDecisionsView(workbench.data, ready && tabs.selected === "decisions", scope, input.focus)
    const handoffs = useSalesHandoffsView(workbench.data, ready && tabs.selected === "handoff", scope)
    const orders = useSalesOrdersView(ready && tabs.selected === "handoff")
    const contracts = useSalesContractsView(workbench, ready && tabs.selected === "contracts", scope)
    const activity = useSalesActivityView(workbench.data)
    const inboxIsActive = isOverview && tabs.selected === "conversation" && input.conversation !== null
    const inboxRead = useChatbotWorkbench(null, input.conversation, inboxIsActive)
    const inbox = useChatbotInbox(inboxRead, inboxIsActive, scope)
    const waiting = useSalesWaiting(isOverview, scope)
    const waitingData = workbenchWaitingDataOf(waiting.slot)
    return {
        shape: salesShapeOf(tabs.selected, isOverview),
        props: useSalesProps({
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
        }),
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retry: workbench.retry,
            waiting: { ...waitingData.on, retry: waiting.reload },
            attention: attention.on,
            pipeline: pipeline.on,
            decisions: decisions.on,
            handoffs: handoffs.on,
            orders: orders.on,
            contracts: contracts.on,
            inbox: { ...inbox.on, reload: inboxRead.reload },
        },
    }
}

/** The optional conversation and explanation remain actual product drawings, not data-status shapes. */
const salesShapeOf = (tab: SalesArea, isOverview: boolean): SalesArea | "explanation" =>
    isOverview ? tab : "explanation"

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
}

/** Resolves the desk's actual data regions and copy after its domain owners have been read. */
const useSalesProps = (source: SalesPropsInput) => {
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
    } = source
    return {
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
