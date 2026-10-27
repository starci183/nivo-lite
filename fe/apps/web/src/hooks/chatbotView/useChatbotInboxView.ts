"use client"

import { useChatbotInboxFilters } from "./useChatbotInboxFilters"
import { useTranslations, useFormatter } from "next-intl"
import { type useChatbotActions, type useChatbotThread } from "@/hooks/chatbot"
import type { useChatbotTextForm } from "@/hooks/rhf"
import type { navigation } from "@/modules/i18n"
import type { ChatbotConversation, ChatbotOverview, ChatbotThread } from "@/modules/types"
import { listViewOf, sideViewOf, threadViewOf } from "./chatbotView.shared"
import type { ChatbotFeedback } from "@/hooks/zustand/chatbot"
import type { ChatbotInboxInput, InboxView, InboxFilters } from "./useChatbotInbox"

/** The resolved inputs for chatbot inbox view input. */
interface ChatbotInboxViewInput {
    readonly actionError: () => string | null
    readonly view: InboxView
    readonly input: ChatbotInboxInput
    readonly selectedId: string | null
    readonly overview: ChatbotOverview | undefined
    readonly thread: ChatbotThread | null
    readonly threadQuery: ReturnType<typeof useChatbotThread>
    readonly name: string
    readonly userName: string
    readonly replyDraft: string
    readonly replyForm: ReturnType<typeof useChatbotTextForm>
    readonly feedback: ChatbotFeedback | null
    readonly actions: ReturnType<typeof useChatbotActions>
    readonly answerDraft: string
    readonly answerForm: ReturnType<typeof useChatbotTextForm>
    readonly setView: import("react").Dispatch<import("react").SetStateAction<InboxView>>
    readonly startNavigation: import("react").TransitionStartFunction
    readonly router: ReturnType<typeof navigation.useRouter>
    readonly pathname: string
    readonly conversation: ChatbotConversation | null
    readonly escalation: ChatbotEscalation | null
}

/** The overview before it is read: no conversations, so the panes keep their words and draw no rows. */
const EMPTY_OVERVIEW: ChatbotOverview = {
    workspaceId: "",
    nowIso: new Date(0).toISOString(),
    conversations: [],
    metrics: { today: 0, waiting: 0, p50FirstResponseMin: null, sample: 0, leadsCaptured7d: 0 },
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
}: ChatbotInboxViewInput) => {
    const t = useTranslations("workbenchChatbot")
    const format = useFormatter()
    const { filters, visible, setQuery, setFilter } = useChatbotInboxFilters(overview)

    return {
        props: propsOf({
            t,
            actionError,
            view,
            input,
            selectedId,
            format,
            visible,
            overview: overview ?? EMPTY_OVERVIEW,
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
        on: {
            query: setQuery,
            filter: setFilter,
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
            sendAnswer: () => {
                void answerForm.submit()
            },
            declineAnswer: () => {
                if (selectedId !== null && escalation !== null)
                    void actions.sendAnswer(selectedId, escalation.workItemId, null)
            },
        },
    }
}
/** The display inputs shared by the list, thread and side panes. */
interface ChatbotInboxPropsInput extends Omit<
    ChatbotInboxViewInput,
    "overview" | "setView" | "startNavigation" | "router" | "pathname" | "conversation" | "escalation"
> {
    readonly t: ReturnType<typeof useTranslations<"workbenchChatbot">>
    readonly format: ReturnType<typeof useFormatter>
    readonly visible: ChatbotConversation[]
    readonly overview: ChatbotOverview
    readonly filters: InboxFilters
}

const propsOf = ({
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
}: ChatbotInboxPropsInput) => {
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
