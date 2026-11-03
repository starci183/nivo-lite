import type { Dispatch, SetStateAction, TransitionStartFunction } from "react"
import type { useTranslations, useFormatter } from "next-intl"
import type { InboxFilter, useChatbotActions, useChatbotThread } from "@/hooks/chatbot"
import { sideViewOf } from "@/hooks/chatbotSideView"
import { listViewOf, threadViewOf, type ListViewOfResult, type ThreadViewOfResult } from "@/hooks/chatbotInboxPanes"
import type { useChatbotTextForm } from "@/hooks/rhf"
import type { ChatbotFeedback } from "@/hooks/zustand/chatbot"
import type { navigation } from "@/modules/i18n"
import type { ChatbotConversation, ChatbotOverview, ChatbotThread } from "@/modules/types"
import type { SideViewOfResult } from "@/hooks/chatbotSideView"

/** Who looks at the inbox, and which conversation the route asks for. */
export interface ChatbotInboxInput {
    readonly overview: ChatbotOverview | undefined
    readonly selectedId: string | null
    readonly userName: string
    readonly userId: string
}

/** The list pane or the thread pane, as far as the member chose; `undefined` while the member did not choose. */
export interface InboxView {
    readonly pane: "list" | "thread" | undefined
    readonly isInfoOpen: boolean
    readonly pickedId: string | null
}

/** The filter and the text typed in the search box. */
export interface InboxFilters {
    readonly filter: InboxFilter
    readonly query: string
}

/** The resolved inputs for chatbot inbox view input. */
export interface ChatbotInboxViewInput {
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
    readonly setView: Dispatch<SetStateAction<InboxView>>
    readonly startNavigation: TransitionStartFunction
    readonly router: ReturnType<typeof navigation.useRouter>
    readonly pathname: string
    readonly conversation: ChatbotConversation | null
    readonly escalation: NonNullable<ChatbotThread["escalation"]> | null
    readonly activity: { readonly isActive: boolean; readonly scope: string }
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

/** What `inboxPropsOf` returns. */
export interface InboxPropsOfResult {
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

/** The props of the inbox: the list, the open thread and the customer pane, worded from the resolved inputs. */
export const inboxPropsOf = ({
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
}: ChatbotInboxPropsInput): InboxPropsOfResult => {
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
