"use client"

import { useChatbotInboxCommands } from "./useChatbotInboxCommands"

import { useChatbotInboxFilters } from "./useChatbotInboxFilters"
import { useTranslations, useFormatter } from "next-intl"
import { type useChatbotActions, type useChatbotThread, type InboxFilter, type ChatbotChipView } from "@/hooks/chatbot"
import type { useChatbotTextForm } from "@/hooks/rhf"
import type { navigation } from "@/modules/i18n"
import type { ChatbotConversation, ChatbotOverview, ChatbotThread, LeadStageId } from "@/modules/types"
import { CHATBOT_EMPTY_OVERVIEW, listViewOf, sideViewOf, threadViewOf } from "./chatbotView.shared"
import type { ChatbotFeedback } from "@/hooks/zustand/chatbot"
import type { ChatbotInboxInput, InboxView, InboxFilters } from "./useChatbotInbox"
import type { ChatbotThreadEntry } from "@/hooks/chatbotThread"

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
    readonly escalation: NonNullable<ChatbotThread["escalation"]> | null
    readonly activity: { readonly isActive: boolean; readonly scope: string }
}

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
        list: {
            title: string
            searchLabel: string
            searchPlaceholder: string
            clearLabel: string
            listLabel: string
            query: string
            filters: {
                value: InboxFilter
                label: string
            }[]
            selectedFilter: InboxFilter
            items: {
                id: string
                name: string
                preview: string
                time: string
                channel: string
                chips: readonly ChatbotChipView[]
            }[]
            hasConversations: boolean
            emptyListTitle: string
            emptyListBody: string
            emptyFilter: string
            selectedId: string | null
        }
        thread: {
            isResolving: boolean
            hasThread: boolean
            pickBody: string
            backLabel: string
            infoLabel: string
            isInfoOpen: boolean
            name: string
            channel: string
            chips: readonly ChatbotChipView[]
            entries: readonly ChatbotThreadEntry[]
            canReply: boolean
            lockedText: string
            composerLabel: string
            composerPlaceholder: string
            composerHint: string
            sendLabel: string
            draft: string
            notSentTitle: string
            error: string | null
            isSending: boolean
        }
        sideLabel: string
        closeSideLabel: string
        isInfoOpen: boolean
        side: {
            title: string
            closeLabel: string
            hasThread: boolean
            customerName: string
            channelLine: string
            escalation: {
                title: string
                askedLabel: string
                question: string
                assigned: string | null
                draftLabel: string
                draftHint: string
                draft: string
                sendLabel: string
                declineLabel: string
                isAnswering: boolean
                noticeTone: "negative" | null
                noticeTitle: string
                noticeText: string | null
            } | null
            stage: {
                title: string
                label: string
                steps: readonly {
                    readonly id: LeadStageId
                    readonly label: string
                }[]
                currentId: LeadStageId
            } | null
            handling: {
                title: string
                text: string
                buttonLabel: string
                hint: string | null
                isBusy: boolean
            }
            leadTitle: string
            leadNone: string
            lead: {
                name: string
                facts: readonly {
                    readonly id: string
                    readonly term: string
                    readonly description: string
                }[]
                openLabel: string
                openHref: string
            } | null
        }
    }
    on: {
        query: (value: string) => void
        filter: (value: string) => void
        select: (id: string) => void
        back: () => void
        toggleInfo: () => void
        draft: (text: string) => void
        send: () => void
        toggleHandling: () => void
        escalationDraft: (text: string) => void
        sendAnswer: () => void
        declineAnswer: () => void
    }
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
        props: propsOf({
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
/** The display inputs shared by the list, thread and side panes. */
interface ChatbotInboxPropsInput extends Omit<
    ChatbotInboxViewInput,
    "overview" | "setView" | "startNavigation" | "router" | "pathname" | "conversation" | "escalation" | "activity"
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
        closeSideLabel: t("infoClose"),
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
