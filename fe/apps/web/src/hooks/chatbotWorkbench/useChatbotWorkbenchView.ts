"use client"

import { useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { CHATBOT_GAPS_PLACEHOLDER, useChatbotGaps, useChatbotWorkbench } from "@/hooks/chatbot"
import { CHATBOT_CUSTOMERS_PLACEHOLDER, useChatbotCustomers } from "@/hooks/chatbotCustomers"
import { useChatbotInbox } from "@/hooks/chatbotView"
import { useChatbotWaiting } from "@/hooks/chatbotWaiting"
import { slotOfReads, useSlotLabels, WAITING_ROWS_PLACEHOLDER } from "@/hooks/slot"
import { useWorkbenchAside, workbenchRowDataOf, workbenchWaitingDataOf } from "@/hooks/workbench"
import { CHATBOT_WORKBENCH_TABS, chatbotOnOf } from "./chatbotWorkbench.shared"
import type { ChatbotWorkbenchActions, ChatbotWorkbenchViewData, WorkbenchAsideView } from "@/modules/types"

/** Existing route identity, focus and server-resolved area labels. */
interface ChatbotWorkbenchViewInput {
    readonly installationId: string | null
    readonly tab: string | null
    readonly focus: string | null
    readonly customersLabel: string
    readonly gapsLabel: string
}

/** The view `useChatbotWorkbenchView` returns. */
export interface ChatbotWorkbenchViewShape {
    shape: "gaps" | "conversation" | "customers"
    props: ChatbotWorkbenchViewData
    on: ChatbotWorkbenchActions
}

const useChatbotPanels = (
    input: ChatbotWorkbenchViewInput,
    workbench: ReturnType<typeof useChatbotWorkbench>,
    selected: (typeof CHATBOT_WORKBENCH_TABS)[number],
    scope: string,
) => {
    const customers = useChatbotCustomers(input.installationId, selected === "customers" && input.focus === null)
    const inbox = useChatbotInbox(workbench, selected === "customers" && input.focus !== null, scope)
    const waiting = useChatbotWaiting(input.installationId, true)
    const waitingData = workbenchWaitingDataOf(waiting.slot)
    const gaps = useChatbotGaps(workbench.workspaceId, workbench.canFillGaps, selected === "gaps", scope)
    return { customers, inbox, waiting, waitingData, gaps }
}

/** Owns the real Chatbot desk, with separate mounted customers, inbox, gaps and waiting-editor lifetimes. */
export const useChatbotWorkbenchView = (input: ChatbotWorkbenchViewInput): ChatbotWorkbenchViewShape => {
    const t = useTranslations("workbenchChatbot")
    const dashboard = useTranslations("agentDashboard")
    const slotLabels = useSlotLabels()
    const frame = useAgentDashboardFrame({ module: "chatbot", installationId: input.installationId, hasOwnGaps: true })
    const workbench = useChatbotWorkbench(input.installationId, input.focus, true)
    const scope = JSON.stringify([workbench.workspaceId, workbench.userId, input.installationId])
    const tabs = useAgentWorkbenchTabs({
        ids: CHATBOT_WORKBENCH_TABS,
        initialTab: input.focus === null ? input.tab : "customers",
        scope,
    })
    const panels = useChatbotPanels(input, workbench, tabs.selected, scope)
    const { customers, inbox, waiting, waitingData, gaps } = panels
    const aside = useWorkbenchAside(frame.why.workItemId !== null)
    return {
        shape: shapeOf(tabs.selected, input.focus),
        props: propsOf({
            input,
            t,
            dashboard,
            slotLabels,
            frame,
            tabs,
            workbench,
            customers,
            inbox,
            waiting,
            waitingData,
            gaps,
            aside: aside.view,
        }),
        on: chatbotOnOf({ tabs, frame, workbench, customers, inbox, waiting, waitingData, gaps, aside: aside.on }),
    }
}

const shapeOf = (tab: (typeof CHATBOT_WORKBENCH_TABS)[number], focus: string | null) => {
    if (tab === "gaps") return "gaps" as const
    return focus === null ? ("customers" as const) : ("conversation" as const)
}

interface ChatbotPropsInput {
    readonly input: ChatbotWorkbenchViewInput
    readonly t: ReturnType<typeof useTranslations<"workbenchChatbot">>
    readonly dashboard: ReturnType<typeof useTranslations<"agentDashboard">>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
    readonly frame: ReturnType<typeof useAgentDashboardFrame>
    readonly tabs: ReturnType<typeof useAgentWorkbenchTabs<(typeof CHATBOT_WORKBENCH_TABS)[number]>>
    readonly workbench: ReturnType<typeof useChatbotWorkbench>
    readonly customers: ReturnType<typeof useChatbotCustomers>
    readonly inbox: ReturnType<typeof useChatbotInbox>
    readonly waiting: ReturnType<typeof useChatbotWaiting>
    readonly waitingData: ReturnType<typeof workbenchWaitingDataOf>
    readonly gaps: ReturnType<typeof useChatbotGaps>
    readonly aside: WorkbenchAsideView
}

const customersOf = (
    t: ReturnType<typeof useTranslations<"workbenchChatbot">>,
    slotLabels: ReturnType<typeof useSlotLabels>,
    customers: ReturnType<typeof useChatbotCustomers>,
) => ({
    slot: customers.slot,
    placeholder: CHATBOT_CUSTOMERS_PLACEHOLDER,
    labels: slotLabels(t("customersEmpty")),
    words: {
        label: t("tabCustomers"),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("customersSearchPlaceholder"),
        clearLabel: t("clearSearch"),
        filtersLabel: t("customersFilters"),
        emptyMessage: t("customersEmpty"),
        emptyDescription: t("customersEmptyBody"),
        full: customers.full,
    },
    query: customers.query,
    filter: customers.filter,
    chips: customers.chips,
    isFull: customers.isFull,
})

const propsOf = (source: ChatbotPropsInput) => {
    const {
        input,
        t,
        dashboard,
        slotLabels,
        frame,
        tabs,
        workbench,
        customers,
        inbox,
        waiting,
        waitingData,
        gaps,
        aside,
    } = source
    return {
        aside,
        why: frame.why,
        regions: frame.regions,
        selectedTab: tabs.selected,
        tabsLabel: frame.tabsLabel,
        tabs: [
            { id: "customers", label: input.customersLabel },
            { id: "gaps", label: input.gapsLabel },
        ],
        ribbon: {
            label: dashboard("ribbonAria"),
            slot: slotOfReads(workbench.reads, () => workbench.figures),
            placeholder: workbench.figures,
            labels: slotLabels(t("loadError")),
        },
        waiting: {
            slot: waitingData.slot,
            placeholder: WAITING_ROWS_PLACEHOLDER.map(workbenchRowDataOf),
            labels: slotLabels(dashboard("waitingEmpty")),
            list: {
                label: dashboard("waitingTitle"),
                count: waiting.count,
                more: waiting.more,
                emptyMessage: dashboard("waitingEmpty"),
                emptyDescription: dashboard("waitingEmptyBody"),
                seeWhyLabel: t("waitingSeeWhy"),
                moreLabel: t("waitingMoreMenu"),
            },
            edit:
                waiting.editing === null
                    ? null
                    : {
                          workItemId: waiting.editing.workItemId,
                          text: waiting.editing.text,
                          label: t("waitingEditLabel"),
                          sendLabel: t("waitingEditSend"),
                          cancelLabel: t("waitingEditCancel"),
                          isBusy: waiting.isBusy,
                      },
        },
        customers: customersOf(t, slotLabels, customers),
        inbox: {
            slot: slotOfReads(workbench.reads, () => inbox.props),
            placeholder: inbox.props,
            labels: slotLabels(t("title")),
        },
        gaps: {
            slot: gaps.slot,
            placeholder: CHATBOT_GAPS_PLACEHOLDER,
            labels: slotLabels(gaps.emptyTitle),
            title: gaps.title,
            description: gaps.description,
            isPending: gaps.isPending,
            canFill: workbench.canFillGaps,
        },
    }
}
