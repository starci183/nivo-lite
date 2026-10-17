"use client"

import { useState } from "react"
import { useTranslations, useFormatter } from "next-intl"
import { matchesInboxFilter, isInboxFilter } from "@/hooks/chatbot"
import type { useChatbotActions, useChatbotThread } from "@/hooks/chatbot"
import type { useChatbotTextForm } from "@/hooks/rhf"
import type { navigation } from "@/modules/i18n"
import type { ChatbotConversation, ChatbotOverview, ChatbotThread } from "@/modules/types"
import { listViewOf, sideViewOf, threadViewOf } from "./chatbotView.shared"
import type { ChatbotFeedback } from "@/hooks/zustand/chatbot"
import type { ChatbotInboxInput, InboxView, InboxFilters } from "./useChatbotInbox"

/** Builds inbox panes and controls while retaining the list filter. */
export const useChatbotInboxView = (
    actionError: () => string | null,
    view: InboxView,
    input: ChatbotInboxInput,
    selectedId: string | null,
    overview: ChatbotOverview | undefined,
    thread: ChatbotThread | null,
    threadQuery: ReturnType<typeof useChatbotThread>,
    name: string,
    userName: string,
    replyDraft: string,
    replyForm: ReturnType<typeof useChatbotTextForm>,
    feedback: ChatbotFeedback | null,
    actions: ReturnType<typeof useChatbotActions>,
    answerDraft: string,
    answerForm: ReturnType<typeof useChatbotTextForm>,
    setView: import("react").Dispatch<import("react").SetStateAction<InboxView>>,
    startNavigation: import("react").TransitionStartFunction,
    router: ReturnType<typeof navigation.useRouter>,
    pathname: string,
    conversation: ChatbotConversation | null,
    escalation: ChatbotEscalation | null,
) => {
    const t = useTranslations("workbenchChatbot")
    const format = useFormatter()
    const [filters, setFilters] = useState<InboxFilters>({ filter: "all", query: "" })
    if (overview === undefined) return null
    const query = filters.query.trim().toLocaleLowerCase()
    const visible = overview.conversations.filter(
        (item) =>
            matchesInboxFilter(item, filters.filter, overview.nowIso) &&
            (query === "" || `${item.name} ${item.lastText}`.toLocaleLowerCase().includes(query)),
    )

    return {
        props: propsOf(
            t,
            actionError,
            view,
            input,
            selectedId,
            format,
            visible,
            overview,
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
        ),
        on: {
            query: (value: string) => setFilters((current) => ({ ...current, query: value })),
            filter: (value: string) =>
                setFilters((current) => ({ ...current, filter: isInboxFilter(value) ? value : current.filter })),
            select: (id: string) => {
                setView((current) => ({ ...current, pane: "thread", pickedId: id }))
                const params = new URLSearchParams(window.location.search)
                params.set("focus", id)
                startNavigation(() => router.replace(`${pathname}?${params.toString()}`))
            },
            back: () => setView((current) => ({ ...current, pane: "list" })),
            toggleInfo: () => setView((current) => ({ ...current, isInfoOpen: !current.isInfoOpen })),
            draft: replyForm.setDraft,
            send: () => {
                void replyForm.submit()
            },
            toggleHandling: () => {
                if (selectedId !== null && conversation !== null)
                    void actions.toggleHandling(selectedId, conversation.handledBy === null)
            },
            escalationDraft: answerForm.setDraft,
            answer: (send: boolean) => {
                if (send) void answerForm.submit()
                else if (selectedId !== null && escalation !== null)
                    void actions.sendAnswer(selectedId, escalation.workItemId, null)
            },
        },
    }
}

const propsOf = (
    t: ReturnType<typeof useTranslations<"workbenchChatbot">>,
    actionError: () => string | null,
    view: InboxView,
    input: ChatbotInboxInput,
    selectedId: string | null,
    format: ReturnType<typeof useFormatter>,
    visible: ChatbotConversation[],
    overview: ChatbotOverview,
    filters: InboxFilters,
    thread: ChatbotThread | null,
    threadQuery: ReturnType<typeof useChatbotThread>,
    name: string,
    userName: string,
    replyDraft: string,
    replyForm: ReturnType<typeof useChatbotTextForm>,
    feedback: ChatbotFeedback | null,
    actions: ReturnType<typeof useChatbotActions>,
    answerDraft: string,
    answerForm: ReturnType<typeof useChatbotTextForm>,
) => {
    return {
        title: t("title"),
        actionFailedTitle: t("actionFailed"),
        actionError: actionError(),
        pane: view.pane ?? (input.selectedId === null ? ("list" as const) : ("thread" as const)),
        hasSelection: selectedId !== null,
        pickTitle: t("pickTitle"),
        pickBody: t("pickBody"),
        list: listViewOf(t, format, {
            visible,
            total: overview.conversations.length,
            nowIso: overview.nowIso,
            query: filters.query,
            filter: filters.filter,
            selectedId,
        }),
        thread: threadViewOf(t, format, {
            thread,
            isResolving: selectedId !== null && thread === null && !threadQuery.error,
            name,
            nowIso: overview.nowIso,
            userName,
            isInfoOpen: view.isInfoOpen,
            draft: replyDraft,
            error: replyForm.error ?? (feedback?.kind === "reply" ? feedback.message : null),
            isSending: actions.busy !== null,
        }),
        sideLabel: t("customerTitle"),
        isInfoOpen: view.isInfoOpen,
        side: sideViewOf(t, {
            thread,
            name,
            userName,
            answerDraft,
            answerFailure: answerForm.error ?? (feedback?.kind === "answer" ? feedback.message : null),
            busy: actions.busy,
        }),
    }
}

type ChatbotEscalation = NonNullable<ChatbotThread["escalation"]>
