"use client"

import { useTranslations } from "next-intl"
import { useChatbotGaps } from "@/hooks/chatbot"
import { useChatbotInbox } from "@/hooks/chatbotView"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"
import { ChatbotWorkbenchOverviewBase } from "./component"

/** The instance and the conversation the route asks for. */
interface ChatbotWorkbenchOverviewProps {
    readonly installationId: string | undefined
    readonly focus: string | null
}

/** Connected workbench data and membership, with independent region failures and browser cache retries. */
export const ChatbotWorkbenchOverview = (props: ChatbotWorkbenchOverviewProps) => {
    const t = useTranslations("workbenchChatbot")
    const workbench = useChatbotWorkbench(props.installationId, props.focus)
    const gaps = useChatbotGaps(workbench.workspaceId, workbench.canFillGaps)
    const inbox = useChatbotInbox(workbench)
    return (
        <ChatbotWorkbenchOverviewBase
            props={{
                dashboard: workbench.dashboard,
                figures: workbench.figures,
                isLoading: workbench.isLoading,
                figuresFailed: workbench.figuresFailed,
                error: workbench.error,
                errorTitle: t("loadError"),
                reloadLabel: t("reload"),
                title: t("title"),
                gaps: gaps.view,
                inbox: inbox === null ? null : inbox.props,
            }}
            on={{
                reload: workbench.reload,
                reloadGaps: gaps.reload,
                dismissGap: (id) => {
                    void gaps.dismiss(id)
                },
                inboxQuery: (query) => inbox?.on.query(query),
                inboxFilter: (filter) => inbox?.on.filter(filter),
                inboxSelect: (id) => inbox?.on.select(id),
                inboxBack: () => inbox?.on.back(),
                inboxToggleInfo: () => inbox?.on.toggleInfo(),
                inboxDraft: (draft) => inbox?.on.draft(draft),
                inboxSend: () => inbox?.on.send(),
                inboxToggleHandling: () => inbox?.on.toggleHandling(),
                inboxEscalationDraft: (draft) => inbox?.on.escalationDraft(draft),
                inboxAnswer: (send) => inbox?.on.answer(send),
            }}
        />
    )
}
