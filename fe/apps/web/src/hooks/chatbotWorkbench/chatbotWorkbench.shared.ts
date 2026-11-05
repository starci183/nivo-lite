import type { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import type { useChatbotGaps, useChatbotWorkbench } from "@/hooks/chatbot"
import type { useChatbotCustomers } from "@/hooks/chatbotCustomers"
import type { useChatbotInbox } from "@/hooks/chatbotView"
import type { useChatbotWaiting } from "@/hooks/chatbotWaiting"
import type { workbenchWaitingDataOf } from "@/hooks/workbench"
import type { ChatbotWorkbenchActions, WorkbenchAsideActions } from "@/modules/types"

/** The owners whose commands the desk exposes. */
interface ChatbotOnInput {
    readonly tabs: ReturnType<typeof useAgentWorkbenchTabs>
    readonly frame: ReturnType<typeof useAgentDashboardFrame>
    readonly workbench: ReturnType<typeof useChatbotWorkbench>
    readonly customers: ReturnType<typeof useChatbotCustomers>
    readonly inbox: ReturnType<typeof useChatbotInbox>
    readonly waiting: ReturnType<typeof useChatbotWaiting>
    readonly waitingData: ReturnType<typeof workbenchWaitingDataOf>
    readonly gaps: ReturnType<typeof useChatbotGaps>
    readonly aside: WorkbenchAsideActions
}

/** The commands of the desk: every panel's own commands under the name of its panel. */
export const chatbotOnOf = ({
    tabs,
    frame,
    workbench,
    customers,
    inbox,
    waiting,
    waitingData,
    gaps,
    aside,
}: ChatbotOnInput): ChatbotWorkbenchActions => ({
    aside,
    selectTab: tabs.select,
    closeWhy: frame.closeWhy,
    retryDashboard: frame.reload,
    retry: workbench.reload,
    customers: {
        query: (value: string) => customers.setQuery(value),
        filter: customers.setFilter,
        retry: customers.reload,
    },
    inbox: { ...inbox.on, reload: workbench.reload },
    waiting: {
        ...waitingData.on,
        retry: waiting.reload,
        changeEdit: waiting.changeEdit,
        sendEdit: waiting.sendEdit,
        cancelEdit: waiting.cancelEdit,
    },
    gaps: {
        retry: gaps.reload,
        dismiss: (id: string) => {
            void gaps.dismiss(id)
        },
    },
})

/** The actual two Chatbot workbench areas. */
export { CHATBOT_WORKBENCH_TABS } from "@/modules/types"
