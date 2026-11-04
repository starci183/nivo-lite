"use client"

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
import { useSalesPipelineView } from "@/hooks/salesPipeline"
import { useSalesWaiting } from "@/hooks/salesWaiting"
import { workbenchWaitingDataOf } from "@/hooks/workbench"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useSalesOrdersView } from "./useSalesOrdersView"
import { SALES_INBOX_TABS, salesShapeOf, useSalesProps, type SalesWorkbenchViewInput } from "./useSalesProps"

type UseSalesWorkbenchViewResult = {
    shape: ReturnType<typeof salesShapeOf>
    props: ReturnType<typeof useSalesProps>
    on: ReturnType<typeof salesOnOf>
}

/** Owns the real Sales desk and the independent lifetimes of its six panels and optional customer conversation. */
export const useSalesWorkbenchView = (input: SalesWorkbenchViewInput): UseSalesWorkbenchViewResult => {
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
        on: salesOnOf({
            tabs,
            frame,
            workbench,
            waiting,
            waitingData,
            attention,
            pipeline,
            decisions,
            handoffs,
            orders,
            contracts,
            inbox,
            inboxRead,
        }),
    }
}

interface SalesOnInput {
    readonly tabs: ReturnType<typeof useAgentWorkbenchTabs>
    readonly frame: ReturnType<typeof useAgentDashboardFrame>
    readonly workbench: ReturnType<typeof useSalesWorkbench>
    readonly waiting: ReturnType<typeof useSalesWaiting>
    readonly waitingData: ReturnType<typeof workbenchWaitingDataOf>
    readonly attention: ReturnType<typeof useSalesAttentionView>
    readonly pipeline: ReturnType<typeof useSalesPipelineView>
    readonly decisions: ReturnType<typeof useSalesDecisionsView>
    readonly handoffs: ReturnType<typeof useSalesHandoffsView>
    readonly orders: ReturnType<typeof useSalesOrdersView>
    readonly contracts: ReturnType<typeof useSalesContractsView>
    readonly inbox: ReturnType<typeof useChatbotInbox>
    readonly inboxRead: ReturnType<typeof useChatbotWorkbench>
}

/** The commands of the desk: every panel's own commands under the name of its panel. */
const salesOnOf = ({
    tabs,
    frame,
    workbench,
    waiting,
    waitingData,
    attention,
    pipeline,
    decisions,
    handoffs,
    orders,
    contracts,
    inbox,
    inboxRead,
}: SalesOnInput) => ({
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
})
