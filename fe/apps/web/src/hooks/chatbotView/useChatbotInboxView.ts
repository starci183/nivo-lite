"use client"

import { useChatbotInboxCommands } from "./useChatbotInboxCommands"
import { useChatbotInboxFilters } from "./useChatbotInboxFilters"
import { useTranslations, useFormatter } from "next-intl"
import { inboxPropsOf, type ChatbotInboxViewInput } from "@/hooks/chatbotInboxProps"
import type { ChatbotInboxActions } from "@/modules/types"
import { CHATBOT_EMPTY_OVERVIEW } from "./chatbotView.shared"
import type { ListViewOfResult, ThreadViewOfResult } from "@/hooks/chatbotInboxPanes"
import type { SideViewOfResult } from "@/hooks/chatbotSideView"

/** The view `useChatbotInboxView` returns. */
export interface ChatbotInboxViewShape {
    props: {
        title: string
        actionFailedTitle: string
        actionError: string | null
        pane: "thread" | "list"
        hasSelection: boolean
        pickTitle: string
        pickBody: string
        list: ListViewOfResult
        thread: ThreadViewOfResult
        sideLabel: string
        closeSideLabel: string
        isInfoOpen: boolean
        side: SideViewOfResult
    }
    on: ChatbotInboxActions
}

/** Builds inbox panes and controls while retaining the list filter. */
export const useChatbotInboxView = ({
    actionError,
    view,
    input,
    selectedId,
    overview,
    thread,
    threadQuery,
    name,
    userName,
    replyDraft,
    replyForm,
    feedback,
    actions,
    answerDraft,
    answerForm,
    setView,
    startNavigation,
    router,
    pathname,
    conversation,
    escalation,
    activity,
}: ChatbotInboxViewInput): ChatbotInboxViewShape => {
    const t = useTranslations("workbenchChatbot")
    const format = useFormatter()
    const { filters, visible, setQuery, setFilter } = useChatbotInboxFilters(
        overview,
        activity.isActive,
        activity.scope,
    )

    return {
        props: inboxPropsOf({
            t,
            actionError,
            view,
            input,
            selectedId,
            format,
            visible,
            overview: overview ?? CHATBOT_EMPTY_OVERVIEW,
            filters,
            thread,
            threadQuery,
            name,
            userName,
            replyDraft,
            replyForm,
            feedback,
            actions,
            answerDraft,
            answerForm,
        }),
        on: useChatbotInboxCommands({
            selectedId,
            conversation,
            escalation,
            actions,
            replyForm,
            answerForm,
            setView,
            startNavigation,
            router,
            pathname,
            setQuery,
            setFilter,
        }),
    }
}
